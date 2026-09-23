import { allClasses, findClass, mapClasses, type CodeClass, type Codebase, type Method } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type SetSuperclassError = 'class-not-found' | 'superclass-not-found' | 'self-inheritance' | 'inheritance-cycle';

/** 指定した親クラス・種類(extends/implements)が、今の設定とまったく同じかを見る。 */
function matchesCurrent(target: CodeClass, superclassId: string, kind: 'extends' | 'implements'): boolean {
  return target.superclassId === superclassId && (target.superclassKind ?? 'extends') === kind;
}

/** superclassId を親から親へ辿って classId に戻れるかを見る。壊れたデータで輪になっていても無限ループしないよう訪問済みで止める。 */
function reachesSelf(codebase: Codebase, fromClassId: string, classId: string): boolean {
  const visited = new Set<string>();
  let current: string | undefined = fromClassId;
  while (current !== undefined && !visited.has(current)) {
    if (current === classId) return true;
    visited.add(current);
    current = findClass(codebase, current)?.superclassId;
  }
  return false;
}

/**
 * 新しく親になったクラスのprivateメソッドのうち、子クラス自身がすでに呼んでいるものをprotectedへ広げる。
 * Move Methodは可視性を変えないので、privateメソッドを先に親クラスへ移してから継承関係を結ぶと、
 * privateのままでは子クラスから届かない(実際のコードではコンパイルが通らない)状態が残ってしまう。
 * implementsは実装を継承しないので対象外。
 */
function promoteCalledPrivateMethods(codebase: Codebase, subclassId: string, superclassId: string): Codebase {
  const subclass = findClass(codebase, subclassId);
  if (subclass === undefined) return codebase;
  const calledMethodIds = new Set(subclass.methods.flatMap((method) => method.fragments).flatMap((fragment) => fragment.uses ?? []));
  return mapClasses(codebase, (codeClass) => {
    if (codeClass.id !== superclassId) return codeClass;
    return {
      ...codeClass,
      methods: codeClass.methods.map((method): Method =>
        method.visibility === 'private' && calledMethodIds.has(method.id) ? { ...method, visibility: 'protected' } : method,
      ),
    };
  });
}

/** クラスの親クラスを設定・解除する。相手はIDではなくクラス名で指定する(名前の変更・追加と同じ規則)。 */
export function setSuperclass(
  codebase: Codebase,
  classId: string,
  superclassName: string | null,
  kind: 'extends' | 'implements' = 'extends',
): Result<Codebase, SetSuperclassError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');

  const name = superclassName?.trim() ?? '';
  if (name === '') {
    if (target.superclassId === undefined) return ok(codebase);
    return ok(replaceSuperclass(codebase, classId, undefined, undefined));
  }

  const superclass = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (superclass === undefined) return err('superclass-not-found');
  if (superclass.id === classId) return err('self-inheritance');
  if (matchesCurrent(target, superclass.id, kind)) return ok(codebase);
  if (reachesSelf(codebase, superclass.id, classId)) return err('inheritance-cycle');

  const withSuperclass = replaceSuperclass(codebase, classId, superclass.id, kind);
  return ok(kind === 'extends' ? promoteCalledPrivateMethods(withSuperclass, classId, superclass.id) : withSuperclass);
}

/** 親クラス・実装インターフェースとして選べるクラス一覧(自分自身・循環になる相手を除く)。 */
export function availableSuperclasses(codebase: Codebase, classId: string): CodeClass[] {
  return allClasses(codebase).filter(
    (codeClass) => codeClass.id !== classId && !reachesSelf(codebase, codeClass.id, classId),
  );
}

function replaceSuperclass(
  codebase: Codebase,
  classId: string,
  superclassId: string | undefined,
  kind: 'extends' | 'implements' | undefined,
): Codebase {
  return mapClasses(codebase, (codeClass) =>
    codeClass.id === classId ? { ...codeClass, superclassId, superclassKind: superclassId === undefined ? undefined : kind } : codeClass,
  );
}
