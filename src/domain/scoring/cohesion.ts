import { allClasses, fieldsOf, touchedFieldIds, type CodeClass, type Codebase } from '../codebase/Codebase';

export type LowCohesion = {
  readonly classId: string;
  /** 塊ごとの、触られている自クラスのフィールドID(宣言順)。塊の並びは、塊の中で最初に宣言されたフィールドの順。 */
  readonly fieldGroups: readonly (readonly string[])[];
};

/** 素朴なUnion-Find。クラス1つぶんのメソッドの塊(連結成分)を数えるのに使う。 */
class UnionFind {
  private readonly parent = new Map<string, string>();

  find(id: string): string {
    const parent = this.parent.get(id);
    if (parent === undefined || parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/** メソッドIDごとに、そのメソッドが触っている自クラスのフィールドID(重複なし)。 */
function ownFieldsByMethod(codeClass: CodeClass, ownFieldIds: ReadonlySet<string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const method of codeClass.methods) {
    const fieldIds = method.fragments.flatMap((fragment) => touchedFieldIds(fragment)).filter((id) => ownFieldIds.has(id));
    map.set(method.id, [...new Set(fieldIds)]);
  }
  return map;
}

/** 同じフィールドを触るメソッド同士を結ぶ。 */
function unionByFields(unionFind: UnionFind, fieldsByMethod: ReadonlyMap<string, readonly string[]>): void {
  const methodIdsByField = new Map<string, string[]>();
  for (const [methodId, fieldIds] of fieldsByMethod) {
    for (const fieldId of fieldIds) {
      const existing = methodIdsByField.get(fieldId);
      if (existing === undefined) methodIdsByField.set(fieldId, [methodId]);
      else existing.push(methodId);
    }
  }
  for (const methodIds of methodIdsByField.values()) {
    for (let i = 1; i < methodIds.length; i += 1) unionFind.union(methodIds[0], methodIds[i]);
  }
}

/** 自クラス内のメソッド呼び出し(uses)で、呼ぶ側と呼ばれる側を結ぶ(向きは問わない)。 */
function unionByCalls(unionFind: UnionFind, codeClass: CodeClass): void {
  const methodIds = new Set(codeClass.methods.map((method) => method.id));
  for (const method of codeClass.methods) {
    for (const usedId of method.fragments.flatMap((fragment) => fragment.uses ?? [])) {
      if (methodIds.has(usedId)) unionFind.union(method.id, usedId);
    }
  }
}

/** 連結成分ごとに、触られている自クラスのフィールドの集合を集める(フィールドを触らない成分は数えない)。 */
function fieldSetsByComponent(codeClass: CodeClass, unionFind: UnionFind, fieldsByMethod: ReadonlyMap<string, readonly string[]>): Set<string>[] {
  const fieldsByRoot = new Map<string, Set<string>>();
  for (const method of codeClass.methods) {
    const fieldIds = fieldsByMethod.get(method.id) ?? [];
    if (fieldIds.length === 0) continue;
    const root = unionFind.find(method.id);
    const existing = fieldsByRoot.get(root) ?? new Set<string>();
    for (const fieldId of fieldIds) existing.add(fieldId);
    fieldsByRoot.set(root, existing);
  }
  return [...fieldsByRoot.values()];
}

/** クラス1つぶんの塊(フィールドを触る連結成分)を、宣言順のフィールドIDの配列として返す。 */
function fieldGroupsOf(codeClass: CodeClass): readonly (readonly string[])[] {
  const ownFieldIds = new Set(fieldsOf(codeClass).map((field) => field.id));
  if (ownFieldIds.size === 0) return [];
  const fieldsByMethod = ownFieldsByMethod(codeClass, ownFieldIds);
  const unionFind = new UnionFind();
  unionByFields(unionFind, fieldsByMethod);
  unionByCalls(unionFind, codeClass);
  const fieldOrder = fieldsOf(codeClass).map((field) => field.id);
  const groups = fieldSetsByComponent(codeClass, unionFind, fieldsByMethod).map((fieldSet) => fieldOrder.filter((id) => fieldSet.has(id)));
  return groups.sort((a, b) => fieldOrder.indexOf(a[0]) - fieldOrder.indexOf(b[0]));
}

/**
 * 自クラスのフィールドを触るメソッドの塊(フィールド共有・自クラス内の呼び出しでつながる連結成分)が2つ以上あるクラスを、出現順に返す。
 * ponytail: 自クラスのフィールドと自クラス内の呼び出しだけで見るLCOM4の素朴版。継承元のフィールドや未使用フィールドを採点したくなったら足す
 */
export function findLowCohesionClasses(codebase: Codebase): LowCohesion[] {
  return allClasses(codebase)
    .map((codeClass): LowCohesion => ({ classId: codeClass.id, fieldGroups: fieldGroupsOf(codeClass) }))
    .filter((item) => item.fieldGroups.length >= 2);
}
