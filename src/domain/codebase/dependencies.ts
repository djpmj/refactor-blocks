import { allClasses, type CodeClass, type Codebase } from './Codebase';

export type ClassDependency = {
  readonly from: string;
  readonly to: string;
  /** 依存先からたどって依存元に戻れる(循環の一部である)とき true。 */
  readonly cyclic: boolean;
};

/** 各メソッドIDから、それを持つクラスのIDを引けるMapを作る。 */
export function methodOwnerMap(codebase: Codebase): ReadonlyMap<string, string> {
  return new Map(
    allClasses(codebase).flatMap((codeClass) => codeClass.methods.map((method) => [method.id, codeClass.id] as const)),
  );
}

/** クラスが呼び出している別クラスのIDを、見つかった順に重複なく返す。 */
function dependencyTargets(codeClass: CodeClass, classIdByMethodId: ReadonlyMap<string, string>): string[] {
  const targets = codeClass.methods
    .flatMap((method) => method.fragments)
    .flatMap((fragment) => fragment.uses ?? [])
    .map((methodId) => classIdByMethodId.get(methodId))
    .filter((classId): classId is string => classId !== undefined && classId !== codeClass.id);
  return [...new Set(targets)];
}

function canReach(graph: ReadonlyMap<string, readonly string[]>, start: string, goal: string): boolean {
  const visited = new Set<string>();
  const stack = [start];
  for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
    if (current === goal) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(graph.get(current) ?? []));
  }
  return false;
}

/** Fragment の uses からクラス間の依存を算出する。同じクラス内の呼び出しと存在しないメソッドIDは無視する。 */
export function classDependencies(codebase: Codebase): ClassDependency[] {
  const classes = allClasses(codebase);
  const classIdByMethodId = methodOwnerMap(codebase);
  const graph = new Map(classes.map((codeClass) => [codeClass.id, dependencyTargets(codeClass, classIdByMethodId)]));
  // ponytail: 依存1本ごとに到達判定するので O(E·(V+E))。ステージが数百クラス規模になったら強連結成分分解に置き換える。
  return [...graph].flatMap(([from, targets]) => targets.map((to) => ({ from, to, cyclic: canReach(graph, to, from) })));
}

/** 循環している依存の from/to に含まれるクラスIDの集合を返す。ノードの強調表示に使う。 */
export function cyclicClassIds(dependencies: readonly ClassDependency[]): ReadonlySet<string> {
  const cyclic = dependencies.filter((dependency) => dependency.cyclic);
  return new Set(cyclic.flatMap((dependency) => [dependency.from, dependency.to]));
}
