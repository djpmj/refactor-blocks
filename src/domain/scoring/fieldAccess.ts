import { accessorFieldAccess, allClasses, extendsChainIds, findClassOfField, findField, isAccessorMethod, touchedFieldIds, type CodeClass, type Codebase, type Method } from '../codebase/Codebase';
import { methodOwnerMap } from '../codebase/dependencies';

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

/** メソッドが触ったフィールド(直接の reads/writes と、getter/setter越しのアクセス)を、宣言しているクラスごとに数える(存在しないIDは無視)。 */
function fieldCountsByClass(codebase: Codebase, method: Method): Map<string, number> {
  const accessed = method.fragments.flatMap((fragment) => {
    const { reads, writes } = accessorFieldAccess(codebase, fragment);
    return [...touchedFieldIds(fragment), ...reads, ...writes];
  });
  const fieldIds = new Set(accessed);
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
  const selfIds = extendsChainIds(codebase, ownerClassId);
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
  const selfIds = extendsChainIds(codebase, codeClass.id);
  const fragments = codeClass.methods.flatMap((method) => method.fragments);
  const accessorWrites = fragments.flatMap((fragment) => accessorFieldAccess(codebase, fragment).writes);
  const candidates = [
    ...fragments.flatMap((fragment) => fragment.writes ?? []).filter((fieldId) => isWriteViolation(codebase, fieldId, selfIds)),
    ...accessorWrites.filter((fieldId) => isWriteViolation(codebase, fieldId, selfIds)),
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

/** メソッドIDごとに、それを呼んでいる Fragment を持つクラスのID集合。 */
function callerClassIdsOf(codebase: Codebase): Map<string, Set<string>> {
  const callers = new Map<string, Set<string>>();
  for (const codeClass of allClasses(codebase)) {
    for (const methodId of codeClass.methods.flatMap((method) => method.fragments).flatMap((fragment) => fragment.uses ?? [])) {
      const existing = callers.get(methodId);
      if (existing === undefined) callers.set(methodId, new Set([codeClass.id]));
      else existing.add(codeClass.id);
    }
  }
  return callers;
}

/**
 * 持ち主以外のどのクラスからも呼ばれていない、private でない setter(isAccessorMethod で writes を持つ)のメソッドIDを出現順に返す。
 * 外から書き換えられる窓口が開いたまま。他クラスから呼ばれている setter は、呼ぶ側の書き換え(findEncapsulationViolations)で数えるのでここでは数えない。
 */
export function findOpenSetters(codebase: Codebase): string[] {
  const owners = methodOwnerMap(codebase);
  const callerClassIds = callerClassIdsOf(codebase);
  const setters: string[] = [];
  for (const method of allClasses(codebase).flatMap((codeClass) => codeClass.methods)) {
    if (method.visibility === 'private' || !isAccessorMethod(method)) continue;
    const hasWrite = method.fragments.some((fragment) => (fragment.writes ?? []).length > 0);
    if (!hasWrite) continue;
    const ownerId = owners.get(method.id);
    const callers = callerClassIds.get(method.id) ?? new Set<string>();
    const calledFromOtherClass = [...callers].some((callerClassId) => callerClassId !== ownerId);
    if (!calledFromOtherClass) setters.push(method.id);
  }
  return setters;
}
