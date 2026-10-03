import { allClasses, extendsChainIds, findClass, isAbstractLike, isInterfaceLike, isStubMethod, parentIds, type CodeClass, type Codebase } from '../codebase/Codebase';

/** isStubMethodなメソッドのIDを出現順に返す。 */
export function findStubMethods(codebase: Codebase): string[] {
  return allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .filter((method) => isStubMethod(method))
    .map((method) => method.id);
}

/** クラス自身と、実装を持つextends先祖が持つメソッド名。 */
function extendsChainMethodNames(codebase: Codebase, classId: string): Set<string> {
  const names = new Set<string>();
  for (const id of extendsChainIds(codebase, classId)) {
    const current = findClass(codebase, id);
    if (current === undefined || (id !== classId && isInterfaceLike(current))) continue;
    for (const method of current.methods) names.add(method.name);
  }
  return names;
}

/** implementsした契約元に、具象クラスならextends先祖のインターフェース役も順に加える。 */
function contractSourcesOf(codebase: Codebase, codeClass: CodeClass): CodeClass[] {
  const sources = new Map<string, CodeClass>();
  for (const id of codeClass.interfaceIds ?? []) {
    const source = findClass(codebase, id);
    if (source !== undefined && isInterfaceLike(source)) sources.set(source.id, source);
  }
  if (isInterfaceLike(codeClass)) return [...sources.values()];
  const chainIds = extendsChainIds(codebase, codeClass.id);
  chainIds.delete(codeClass.id);
  for (const id of chainIds) {
    const source = findClass(codebase, id);
    if (source !== undefined && isInterfaceLike(source)) sources.set(source.id, source);
  }
  return [...sources.values()];
}

/**
 * 実装漏れ: implementsしたインターフェース役と、具象クラスならextends先祖のインターフェース役の契約を調べる。
 * 自分とextends先祖の実装メソッド名が契約に無いもの1つにつきクラスIDを返す。空実装も「持っている」に数える。
 * インターフェース役自身のextends先祖契約は調べず、契約メソッド自体も実装として数えない。
 */
function findMissingImplementations(codebase: Codebase): string[] {
  const violations: string[] = [];
  for (const codeClass of allClasses(codebase)) {
    const ownNames = extendsChainMethodNames(codebase, codeClass.id);
    for (const source of contractSourcesOf(codebase, codeClass)) {
      // ponytail: extends の途中のクラスも契約をすべて持つ必要がある(抽象クラスを表す項目が無いため)。abstract を表せるようになったら、子孫が持てば数えない形に見直す
      for (const method of source.methods) {
        if (!ownNames.has(method.name)) violations.push(codeClass.id);
      }
    }
  }
  return violations;
}

/** インターフェースの外の契約メソッド: インターフェース役でないクラスが持つ、publicでfragments: []のメソッドのID。 */
function findContractMethodsOutsideInterfaces(codebase: Codebase): string[] {
  return allClasses(codebase)
    .filter((codeClass) => !isInterfaceLike(codeClass))
    .flatMap((codeClass) => codeClass.methods)
    .filter((method) => method.visibility === 'public' && method.fragments.length === 0)
    .map((method) => method.id);
}

/** classId から parentIds(継承元→実装先)を辿って届く先祖ID(classId自身は含まない)。輪になっていても訪問済みで止まる。 */
function reachableParentIds(codebase: Codebase, classId: string): Set<string> {
  const visited = new Set<string>([classId]);
  const start = findClass(codebase, classId);
  const stack = start === undefined ? [] : [...parentIds(start)];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    const codeClass = findClass(codebase, current);
    if (codeClass !== undefined) stack.push(...parentIds(codeClass));
  }
  visited.delete(classId);
  return visited;
}

/**
 * 実装の宣言漏れ: インターフェース役でないクラスが、あるインターフェース役のクラスの契約メソッドと同名の
 * publicメソッドを持つのに、parentIdsを辿ってもそのインターフェースに届かないとき、1インターフェースにつき
 * そのクラスのID。
 *
 * ponytail: 実装しているかは名前だけで見る(引数の型は持っていない)。別々のインターフェースに同名の契約があると
 * 過剰に数える。そういう題材を作るときに見直す
 */
function findUndeclaredImplementations(codebase: Codebase): string[] {
  const interfaceClasses = allClasses(codebase).filter(isInterfaceLike);
  const violations: string[] = [];
  for (const codeClass of allClasses(codebase)) {
    if (isInterfaceLike(codeClass)) continue;
    const ownPublicNames = new Set(codeClass.methods.filter((method) => method.visibility === 'public').map((method) => method.name));
    const reachable = reachableParentIds(codebase, codeClass.id);
    for (const interfaceClass of interfaceClasses) {
      if (reachable.has(interfaceClass.id)) continue;
      if (interfaceClass.methods.some((method) => ownPublicNames.has(method.name))) violations.push(codeClass.id);
    }
  }
  return violations;
}

function nearestOwnerOf(codebase: Codebase, classId: string, name: string): CodeClass | undefined {
  const visited = new Set<string>([classId]);
  let current = findClass(codebase, classId);
  while (current?.superclassId !== undefined && !visited.has(current.superclassId)) {
    visited.add(current.superclassId);
    current = findClass(codebase, current.superclassId);
    if (current?.methods.some((method) => method.name === name)) return current;
  }
  return undefined;
}

function reachableContractNames(codebase: Codebase, classId: string): Set<string> {
  const names = new Set<string>();
  for (const id of reachableParentIds(codebase, classId)) {
    const parent = findClass(codebase, id);
    if (parent === undefined || !isInterfaceLike(parent)) continue;
    for (const method of parent.methods) names.add(method.name);
  }
  return names;
}

function isBorrowedContract(codebase: Codebase, codeClass: CodeClass, name: string): boolean {
  if (codeClass.methods.some((method) => method.name === name)) return false;
  const owner = nearestOwnerOf(codebase, codeClass.id, name);
  return owner !== undefined && !isInterfaceLike(owner) && !isAbstractLike(owner);
}

function findBorrowedContracts(codebase: Codebase): string[] {
  // ponytail: 抽象かどうかは isInterfaceLike / isAbstractLike で推すだけ(abstract を表す項目が無い)。protected の空宣言を足して抽象役に見せかける手は塞がない。abstract を表せるようになったらそれで見る
  const violations: string[] = [];
  for (const codeClass of allClasses(codebase)) {
    if (isInterfaceLike(codeClass)) continue;
    const contractNames = reachableContractNames(codebase, codeClass.id);
    for (const name of contractNames) {
      if (isBorrowedContract(codebase, codeClass, name)) violations.push(codeClass.id);
    }
  }
  return violations;
}

/** 実装漏れ・インターフェースの外の契約メソッド・実装の宣言漏れ・具象の先祖からの契約の借用をまとめて返す(1件 = 1要素)。 */
export function findContractViolations(codebase: Codebase): string[] {
  return [...findMissingImplementations(codebase), ...findContractMethodsOutsideInterfaces(codebase), ...findUndeclaredImplementations(codebase), ...findBorrowedContracts(codebase)];
}
