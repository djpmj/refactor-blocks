import { allClasses, findClass, isInterfaceLike, isStubMethod, parentIds, type CodeClass, type Codebase } from '../codebase/Codebase';

/** isStubMethodなメソッドのIDを出現順に返す。 */
export function findStubMethods(codebase: Codebase): string[] {
  return allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .filter((method) => isStubMethod(method))
    .map((method) => method.id);
}

/** クラス自身と、extends(superclassId)を辿った先祖が持つメソッド名。輪になっていても訪問済みで止まる。 */
function extendsChainMethodNames(codebase: Codebase, classId: string): Set<string> {
  const names = new Set<string>();
  const visited = new Set<string>();
  let current: CodeClass | undefined = findClass(codebase, classId);
  while (current !== undefined && !visited.has(current.id)) {
    visited.add(current.id);
    for (const method of current.methods) names.add(method.name);
    current = current.superclassId === undefined ? undefined : findClass(codebase, current.superclassId);
  }
  return names;
}

/**
 * 実装漏れ: クラスが implements しているインターフェース役のメソッド名のうち、自分と extends の先祖の
 * どれも同名のメソッドを持たないもの1つにつき、実装クラスのID。空実装も「持っている」に数える。
 */
function findMissingImplementations(codebase: Codebase): string[] {
  const violations: string[] = [];
  for (const codeClass of allClasses(codebase)) {
    const ownNames = extendsChainMethodNames(codebase, codeClass.id);
    for (const interfaceId of codeClass.interfaceIds ?? []) {
      const interfaceClass = findClass(codebase, interfaceId);
      if (interfaceClass === undefined || !isInterfaceLike(interfaceClass)) continue;
      for (const method of interfaceClass.methods) {
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

/** 実装漏れ・インターフェースの外の契約メソッド・実装の宣言漏れをまとめて返す(1件 = 1要素)。 */
export function findContractViolations(codebase: Codebase): string[] {
  return [...findMissingImplementations(codebase), ...findContractMethodsOutsideInterfaces(codebase), ...findUndeclaredImplementations(codebase)];
}
