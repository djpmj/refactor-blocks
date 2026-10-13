import { resolvesToOwnDeclaration } from './overrides';
import { allClasses, fieldsOf, touchedFieldIds, type CodeClass, type Codebase } from './Codebase';

export type ClassDependency = {
  readonly from: string;
  readonly to: string;
  /** 依存先からたどって依存元に戻れる(循環の一部である)とき true。 */
  readonly cyclic: boolean;
};

/** 循環する強連結成分をクラスの出現順で返す。 */
export function findCycles(dependencies: readonly ClassDependency[]): readonly (readonly string[])[] {
  const nodes = [...new Set(dependencies.flatMap(({ from, to }) => [from, to]))];
  const graph = new Map(nodes.map((node) => [node, dependencies.filter(({ from }) => from === node).map(({ to }) => to)]));
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const visit = (node: string): void => {
    indexes.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    const targets = graph.get(node) ?? [];
    targets.forEach((target) => {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, lowLinks.get(target) ?? 0));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, indexes.get(target) ?? 0));
      }
    });
    if (lowLinks.get(node) !== indexes.get(node)) return;
    const component: string[] = [];
    for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    if (component.length > 1) components.push(component);
  };
  nodes.forEach((node) => { if (!indexes.has(node)) visit(node); });
  const order = new Map(nodes.map((node, index) => [node, index]));
  return components
    .map((component) => component.toSorted((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)))
    .sort((left, right) => (order.get(left[0] ?? '') ?? 0) - (order.get(right[0] ?? '') ?? 0));
}

/** SCC内を依存方向に一周する順序。全クラスを一周できない場合は undefined。 */
export function cyclePath(dependencies: readonly ClassDependency[], cycle: readonly string[]): readonly string[] | undefined {
  const start = cycle[0];
  const members = new Set(cycle);
  const graph = new Map<string, string[]>();
  dependencies.forEach(({ from, to }) => {
    if (members.has(from) && members.has(to)) graph.set(from, [...(graph.get(from) ?? []), to]);
  });
  const search = (current: string, path: readonly string[]): readonly string[] | undefined => {
    const targets = graph.get(current) ?? [];
    for (const target of targets) {
      if (target === start && path.length === cycle.length) return path;
      if (!path.includes(target)) {
        const result = search(target, [...path, target]);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  };
  return search(start, [start]);
}

/** 各メソッドIDから、それを持つクラスのIDを引けるMapを作る。 */
export function methodOwnerMap(codebase: Codebase): ReadonlyMap<string, string> {
  return new Map(
    allClasses(codebase).flatMap((codeClass) => codeClass.methods.map((method) => [method.id, codeClass.id] as const)),
  );
}

/** 各フィールドIDから、それを宣言しているクラスのIDを引けるMapを作る。 */
export function fieldOwnerMap(codebase: Codebase): ReadonlyMap<string, string> {
  return new Map(
    allClasses(codebase).flatMap((codeClass) => fieldsOf(codeClass).map((field) => [field.id, codeClass.id] as const)),
  );
}

/** クラスが呼び出している・フィールドを読み書きしている別クラスのIDを、見つかった順に重複なく返す。 */
function dependencyTargets(
  codebase: Codebase,
  codeClass: CodeClass,
  classIdByMethodId: ReadonlyMap<string, string>,
  classIdByFieldId: ReadonlyMap<string, string>,
): string[] {
  const fragments = codeClass.methods.flatMap((method) => method.fragments);
  const methodTargets = fragments.flatMap((fragment) => fragment.uses ?? [])
    .filter((methodId) => !resolvesToOwnDeclaration(codebase, codeClass.id, methodId))
    .map((methodId) => classIdByMethodId.get(methodId));
  const fieldTargets = fragments.flatMap((fragment) => touchedFieldIds(fragment)).map((fieldId) => classIdByFieldId.get(fieldId));
  const targets = [...methodTargets, ...fieldTargets].filter(
    (classId): classId is string => classId !== undefined && classId !== codeClass.id,
  );
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

/** Fragment の uses と、読み書きするフィールドから算出する。同じクラス内の参照と存在しないIDは無視する。 */
export function classDependencies(codebase: Codebase): ClassDependency[] {
  const classes = allClasses(codebase);
  const classIdByMethodId = methodOwnerMap(codebase);
  const classIdByFieldId = fieldOwnerMap(codebase);
  const graph = new Map(classes.map((codeClass) => [codeClass.id, dependencyTargets(codebase, codeClass, classIdByMethodId, classIdByFieldId)]));
  // ponytail: 依存1本ごとに到達判定するので O(E·(V+E))。ステージが数百クラス規模になったら強連結成分分解に置き換える。
  return [...graph].flatMap(([from, targets]) => targets.map((to) => ({ from, to, cyclic: canReach(graph, to, from) })));
}

/** 循環している依存の from/to に含まれるクラスIDの集合を返す。ノードの強調表示に使う。 */
export function cyclicClassIds(dependencies: readonly ClassDependency[]): ReadonlySet<string> {
  const cyclic = dependencies.filter((dependency) => dependency.cyclic);
  return new Set(cyclic.flatMap((dependency) => [dependency.from, dependency.to]));
}
