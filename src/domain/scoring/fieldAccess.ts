import { allClasses, findClass, findClassOfField, findField, touchedFieldIds, type CodeClass, type Codebase, type Method } from '../codebase/Codebase';

export type FeatureEnvy = {
  readonly methodId: string;
  /** いちばん多くフィールドを触っている他クラスのID。 */
  readonly enviedClassId: string;
};

export type EncapsulationViolation = {
  readonly fieldId: string;
  /** フィールドに触っている処理があるクラスのID。 */
  readonly accessorClassId: string;
};

/** 「他クラスのフィールドを何個以上、自分側より多く触っていたら Feature Envy か」の下限。 */
const ENVY_THRESHOLD = 2;

/** クラス自身と、extends(superclassId)を辿った先祖のクラスID集合。輪になっていても訪問済みで止まる。 */
function selfClassIds(codebase: Codebase, classId: string): Set<string> {
  const ids = new Set<string>();
  let current: CodeClass | undefined = findClass(codebase, classId);
  while (current !== undefined && !ids.has(current.id)) {
    ids.add(current.id);
    current = current.superclassId === undefined ? undefined : findClass(codebase, current.superclassId);
  }
  return ids;
}

/** メソッドが触ったフィールドを、宣言しているクラスごとに数える(存在しないIDは無視)。 */
function fieldCountsByClass(codebase: Codebase, method: Method): Map<string, number> {
  const fieldIds = new Set(method.fragments.flatMap((fragment) => touchedFieldIds(fragment)));
  const counts = new Map<string, number>();
  for (const fieldId of fieldIds) {
    const ownerClass = findClassOfField(codebase, fieldId);
    if (ownerClass === undefined) continue;
    counts.set(ownerClass.id, (counts.get(ownerClass.id) ?? 0) + 1);
  }
  return counts;
}

/**
 * ponytail: 閾値は「他クラスのフィールドを2つ以上、かつ自分より多く」の素朴な判定。
 * Lanza-Marinescu 式(ATFD/LAA/FDP)が必要になったら置き換える
 */
function findEnviedClass(codebase: Codebase, method: Method, ownerClassId: string): string | undefined {
  const counts = fieldCountsByClass(codebase, method);
  const selfIds = selfClassIds(codebase, ownerClassId);
  const selfCount = [...counts].filter(([classId]) => selfIds.has(classId)).reduce((sum, [, count]) => sum + count, 0);
  let enviedClassId: string | undefined;
  let maxCount = 0;
  for (const codeClass of allClasses(codebase)) {
    if (selfIds.has(codeClass.id)) continue;
    const count = counts.get(codeClass.id) ?? 0;
    if (count > maxCount) {
      maxCount = count;
      enviedClassId = codeClass.id;
    }
  }
  return enviedClassId !== undefined && maxCount >= ENVY_THRESHOLD && maxCount > selfCount ? enviedClassId : undefined;
}

/** 他クラスのフィールドを、自分側(自クラス + extends の先祖)より多く(かつ2つ以上)触っているメソッドを出現順に返す。 */
export function findFeatureEnvy(codebase: Codebase): FeatureEnvy[] {
  const violations: FeatureEnvy[] = [];
  for (const codeClass of allClasses(codebase)) {
    for (const method of codeClass.methods) {
      const enviedClassId = findEnviedClass(codebase, method, codeClass.id);
      if (enviedClassId !== undefined) violations.push({ methodId: method.id, enviedClassId });
    }
  }
  return violations;
}

/** 書き換え: 他クラス(自分側でない)のフィールドを writes に持てば、可視性を問わず違反。 */
function isWriteViolation(codebase: Codebase, fieldId: string, selfIds: ReadonlySet<string>): boolean {
  const ownerClass = findClassOfField(codebase, fieldId);
  return ownerClass !== undefined && !selfIds.has(ownerClass.id);
}

/** 読み取り: 他クラス(自分側でない)の public でないフィールドを reads に持てば違反。 */
function isReadViolation(codebase: Codebase, fieldId: string, selfIds: ReadonlySet<string>): boolean {
  const ownerClass = findClassOfField(codebase, fieldId);
  if (ownerClass === undefined || selfIds.has(ownerClass.id)) return false;
  const field = findField(codebase, fieldId);
  return field !== undefined && field.visibility !== 'public';
}

/** クラス1つぶんの違反を、(フィールド, クラス) の組の重複を除きながら集める。 */
function collectClassViolations(
  codebase: Codebase,
  codeClass: CodeClass,
  seen: Set<string>,
  violations: EncapsulationViolation[],
): void {
  const selfIds = selfClassIds(codebase, codeClass.id);
  const fragments = codeClass.methods.flatMap((method) => method.fragments);
  const candidates = [
    ...fragments.flatMap((fragment) => fragment.writes ?? []).filter((fieldId) => isWriteViolation(codebase, fieldId, selfIds)),
    ...fragments.flatMap((fragment) => fragment.reads ?? []).filter((fieldId) => isReadViolation(codebase, fieldId, selfIds)),
  ];
  for (const fieldId of candidates) {
    const key = `${fieldId}|${codeClass.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({ fieldId, accessorClassId: codeClass.id });
  }
}

/** 他クラスのフィールドを書き換えている・public でない他クラスのフィールドを読んでいる箇所を、(フィールド, クラス) の組で重複なく出現順に返す。 */
export function findEncapsulationViolations(codebase: Codebase): EncapsulationViolation[] {
  const violations: EncapsulationViolation[] = [];
  const seen = new Set<string>();
  for (const codeClass of allClasses(codebase)) collectClassViolations(codebase, codeClass, seen, violations);
  return violations;
}
