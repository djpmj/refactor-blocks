import { allClasses, findClass, findClassOfField, findClassOfMethod, findField, isInterfaceLike, parentIds, touchedFieldIds, type CodeClass, type Codebase, type Fragment } from './Codebase';
import type { BuildIssue } from './buildIssues';
import { fieldOwnerMap, methodOwnerMap } from './dependencies';
import { resolvesToOwnDeclaration } from './overrides';

/** クラスが別クラスから受け取る相手。fieldName は `_` + 型名の先頭を小文字にしたもの。 */
export type Collaborator = { readonly classId: string; readonly typeName: string; readonly fieldName: string };

/** `Program.cs` で `new` する1クラス分。args はコンストラクタに渡す変数名(決められないものは `null`)。 */
export type CompositionStep = { readonly classId: string; readonly className: string; readonly variable: string; readonly args: readonly string[] };

/** 循環の辺。組み立てたあとに `<variable>.<property> = <value>;` で渡す。 */
export type LateAssignment = { readonly variable: string; readonly property: string; readonly value: string };

export type CompositionPlan = {
  readonly steps: readonly CompositionStep[];
  readonly lateAssignments: readonly LateAssignment[];
  readonly issues: readonly BuildIssue[];
};

type Use = { readonly collaborator: Collaborator; readonly methodId: string };

function lowerFirst(name: string): string {
  return name.slice(0, 1).toLowerCase() + name.slice(1);
}

/** 親(継承・実装)をたどった先祖のクラスID。輪になっていても訪問済みで止まる。 */
function ancestorIds(codebase: Codebase, codeClass: CodeClass): ReadonlySet<string> {
  const ids = new Set<string>();
  const queue = parentIds(codeClass);
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (ids.has(id)) continue;
    ids.add(id);
    const parent = findClass(codebase, id);
    if (parent !== undefined) queue.push(...parentIds(parent));
  }
  return ids;
}

/** 別クラスのメンバーを使うたびの (相手, 使ったメソッドID)。使われた順。先祖のメンバーは同じクラスの一部として数えない。 */
function usesOf(codebase: Codebase, codeClass: CodeClass): Use[] {
  const methodOwners = methodOwnerMap(codebase);
  const fieldOwners = fieldOwnerMap(codebase);
  const ancestors = ancestorIds(codebase, codeClass);
  return codeClass.methods.flatMap((method) => method.fragments.flatMap((fragment) => {
    const methodOwnerIds = (fragment.uses ?? [])
      .filter((id) => !resolvesToOwnDeclaration(codebase, codeClass.id, id))
      .map((id) => methodOwners.get(id));
    const fieldOwnerIds = touchedFieldIds(fragment).map((id) => fieldOwners.get(id));
    return [...methodOwnerIds, ...fieldOwnerIds]
      .flatMap((ownerId) => ownerId === undefined || ownerId === codeClass.id || ancestors.has(ownerId) ? [] : [findClass(codebase, ownerId)])
      .flatMap((owner) => owner === undefined ? [] : [{ collaborator: { classId: owner.id, typeName: owner.name, fieldName: `_${lowerFirst(owner.name)}` }, methodId: method.id }]);
  }));
}

/** そのクラスの処理が呼ぶ・読む・書く、別クラスのメンバーの持ち主。最初に使われた順で、同じクラスは1件。 */
export function collaboratorsOf(codebase: Codebase, classId: string): readonly Collaborator[] {
  const codeClass = findClass(codebase, classId);
  if (codeClass === undefined) return [];
  const unique = new Map(usesOf(codebase, codeClass).map(({ collaborator }) => [collaborator.classId, collaborator]));
  return [...unique.values()];
}

/** 型に代入できるインスタンスを作れるクラス。インターフェース役ならそれを継承・実装した具象クラス、具象クラスならそれ自身。 */
function implementersOf(codebase: Codebase, classId: string): readonly CodeClass[] {
  const target = findClass(codebase, classId);
  if (target === undefined) return [];
  if (!isInterfaceLike(target)) return [target];
  return allClasses(codebase).filter((codeClass) => !isInterfaceLike(codeClass) && ancestorIds(codebase, codeClass).has(classId));
}

const edgeKey = (fromId: string, toId: string): string => `${fromId}>${toId}`;

/**
 * 循環を断つために、コンストラクタではなくプロパティで渡す辺(`from>to`)。深さ優先でたどって、いま辿っている途中のクラスへ戻る辺を選ぶ。
 * インターフェース越しの辺は、実装クラスが何であっても同じ結果になるよう、すべての実装クラスで調べる(bindings に左右されない)。
 */
function lateEdges(codebase: Codebase): ReadonlySet<string> {
  const edges = new Map(allClasses(codebase).map((codeClass) => [codeClass.id, collaboratorsOf(codebase, codeClass.id)]));
  const state = new Map<string, 'visiting' | 'done'>();
  const late = new Set<string>();
  const visit = (classId: string): void => {
    state.set(classId, 'visiting');
    (edges.get(classId) ?? []).forEach(({ classId: toId }) => {
      implementersOf(codebase, toId).forEach((target) => {
        const status = state.get(target.id);
        if (status === 'visiting') late.add(edgeKey(classId, toId));
        else if (status === undefined) visit(target.id);
      });
    });
    state.set(classId, 'done');
  };
  allClasses(codebase).forEach((codeClass) => { if (!state.has(codeClass.id)) visit(codeClass.id); });
  return late;
}

/** 相手を受け取るメンバー名。コンストラクタ注入ならフィールド名、循環の辺ならプロパティ名(型名)。 */
function memberName(collaborator: Collaborator, isLate: boolean): string {
  return isLate ? collaborator.typeName : collaborator.fieldName;
}

export type ClassWiring = {
  /** フィールド・プロパティ・コンストラクタの宣言(インデント付き)。相手がいなければ空。 */
  readonly declarations: readonly string[];
  /** 相手のクラスID → 呼び出しの受け手(`_taxCalculator` など)。 */
  readonly receivers: ReadonlyMap<string, string>;
};

/** クラスが別クラスを受け取るための宣言と、呼び出しの受け手を決める。 */
export function wiringOf(codebase: Codebase, classId: string): ClassWiring {
  const codeClass = findClass(codebase, classId);
  const collaborators = collaboratorsOf(codebase, classId);
  if (codeClass === undefined || collaborators.length === 0) return { declarations: [], receivers: new Map() };
  const late = lateEdges(codebase);
  const isLate = (collaborator: Collaborator): boolean => late.has(edgeKey(classId, collaborator.classId));
  const injected = collaborators.filter((collaborator) => !isLate(collaborator));
  const members = collaborators.map((collaborator) => isLate(collaborator)
    ? `    public ${collaborator.typeName} ${collaborator.typeName} { private get; set; }`
    : `    private readonly ${collaborator.typeName} ${collaborator.fieldName};`);
  const parameters = injected.map(({ typeName }) => `${typeName} ${lowerFirst(typeName)}`).join(', ');
  const constructor = injected.length === 0 ? [] : [
    '',
    `    public ${codeClass.name}(${parameters})`,
    '    {',
    ...injected.map(({ typeName, fieldName }) => `        ${fieldName} = ${lowerFirst(typeName)};`),
    '    }',
  ];
  return {
    declarations: [...members, ...constructor],
    receivers: new Map(collaborators.map((collaborator) => [collaborator.classId, memberName(collaborator, isLate(collaborator))])),
  };
}

/** 呼ぶメソッドの持ち主が別クラスなら、その受け手。同じクラス(または先祖)のメソッドなら undefined。 */
export function receiverOfMethod(codebase: Codebase, receivers: ReadonlyMap<string, string>, methodId: string): string | undefined {
  const ownerId = findClassOfMethod(codebase, methodId)?.id;
  return ownerId === undefined ? undefined : receivers.get(ownerId);
}

const identifierPattern = /"(?:[^"\\\n]|\\.)*"|(?<![.\w])[A-Za-z_]\w*/g;

/**
 * 処理のコードに出てくる別クラスのフィールド名を、受け手付き(`_orderService._repository`)に置き換える。
 * 名前の一部だけが一致する識別子・`.` のあとの名前・文字列リテラルの中は置き換えない。
 * ponytail: 文字列は `"..."` だけを見る。`@"..."`・`$"..."`・文字リテラル `'"'` を使うコードを扱うときは字句解析に置き換える。
 */
export function qualifyForeignMembers(code: string, replacements: ReadonlyMap<string, string>): string {
  return code.replace(identifierPattern, (token) => (token.startsWith('"') ? token : replacements.get(token) ?? token));
}

/** 処理が読み書きする別クラスのフィールドに、受け手を付けたコード。 */
export function qualifyFragmentCode(codebase: Codebase, receivers: ReadonlyMap<string, string>, fragment: Fragment, code: string): string {
  const replacements = new Map(touchedFieldIds(fragment).flatMap((fieldId) => {
    const field = findField(codebase, fieldId);
    const ownerId = findClassOfField(codebase, fieldId)?.id;
    const receiver = ownerId === undefined ? undefined : receivers.get(ownerId);
    return field === undefined || receiver === undefined ? [] : [[field.name, `${receiver}.${field.name}`] as const];
  }));
  return replacements.size === 0 ? code : qualifyForeignMembers(code, replacements);
}

type Resolver = (collaborator: Collaborator) => CodeClass | undefined;

function bindingResolver(codebase: Codebase, bindings: Readonly<Record<string, string>>): Resolver {
  return (collaborator) => {
    const implementers = implementersOf(codebase, collaborator.classId);
    if (implementers.length <= 1) return implementers[0];
    return implementers.find((codeClass) => codeClass.name === bindings[collaborator.typeName]);
  };
}

/** 依存を先に組み立てる順(深さ優先の帰りがけ)。コンストラクタ注入の辺だけをたどる。 */
function constructionOrder(classes: readonly CodeClass[], injectedTargets: (classId: string) => readonly CodeClass[]): CodeClass[] {
  const done = new Set<string>();
  const order: CodeClass[] = [];
  const visit = (codeClass: CodeClass): void => {
    if (done.has(codeClass.id)) return;
    done.add(codeClass.id);
    injectedTargets(codeClass.id).forEach(visit);
    order.push(codeClass);
  };
  classes.forEach(visit);
  return order;
}

/**
 * `Program.cs` で `new` する順番と、コンストラクタ・プロパティに渡すものを決める。
 * インターフェース型の依存は、実装が1つならそれ、複数なら bindings(インターフェース名 → クラス名)で決める。決まらなければ 'ambiguous-binding' の問題にする(実装が1つもないときは問題にせず `null` を渡す)。
 */
export function compositionOrder(codebase: Codebase, bindings: Readonly<Record<string, string>> = {}): CompositionPlan {
  const concrete = allClasses(codebase).filter((codeClass) => !isInterfaceLike(codeClass));
  const late = lateEdges(codebase);
  const resolve = bindingResolver(codebase, bindings);
  const uses = new Map(concrete.map((codeClass) => [codeClass.id, usesOf(codebase, codeClass)]));
  const collaboratorsById = new Map(concrete.map((codeClass) => [codeClass.id, collaboratorsOf(codebase, codeClass.id)]));
  const injectedOf = (classId: string): Collaborator[] => (collaboratorsById.get(classId) ?? []).filter((collaborator) => !late.has(edgeKey(classId, collaborator.classId)));
  const injectedTargets = (classId: string): CodeClass[] => injectedOf(classId).flatMap((collaborator) => resolve(collaborator) ?? []);
  const variableOf = (codeClass: CodeClass): string => lowerFirst(codeClass.name);
  const valueOf = (collaborator: Collaborator): string => {
    const target = resolve(collaborator);
    return target === undefined ? 'null' : variableOf(target);
  };
  const steps = constructionOrder(concrete, injectedTargets).map((codeClass) => ({
    classId: codeClass.id,
    className: codeClass.name,
    variable: variableOf(codeClass),
    args: injectedOf(codeClass.id).map(valueOf),
  }));
  const lateAssignments = concrete.flatMap((codeClass) => (collaboratorsById.get(codeClass.id) ?? [])
    .filter((collaborator) => late.has(edgeKey(codeClass.id, collaborator.classId)))
    .map((collaborator) => ({ variable: variableOf(codeClass), property: collaborator.typeName, value: valueOf(collaborator) })));
  const issues = concrete.flatMap((codeClass) => [...new Map((uses.get(codeClass.id) ?? [])
    .filter(({ collaborator }) => resolve(collaborator) === undefined && implementersOf(codebase, collaborator.classId).length > 1)
    .map((use) => [use.collaborator.classId, use])).values()]
    .map(({ collaborator, methodId }): BuildIssue => ({ classId: codeClass.id, methodId, memberName: collaborator.typeName, ownerClassId: collaborator.classId, reason: 'ambiguous-binding' })));
  return { steps, lateAssignments, issues };
}
