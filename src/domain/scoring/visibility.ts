import { resolvesToOwnDeclaration } from '../codebase/overrides';
import { allClasses, extendsChainIds, findMethod, type Codebase } from '../codebase/Codebase';
import { methodOwnerMap } from '../codebase/dependencies';

export type VisibilityViolation = {
  readonly methodId: string;
  readonly callerClassId: string;
  readonly kind: 'private' | 'protected';
};

export type VisibilityViolationDependency = {
  readonly from: string;
  readonly to: string;
  readonly kind: 'private' | 'protected';
  readonly methodIds: readonly string[];
};

/** 呼び出しが届かないかどうか。private は自クラス以外なら届かない。protected は持ち主の子孫(自分を含む)でなければ届かない。 */
function violationKind(codebase: Codebase, ownerClassId: string, callerClassId: string, visibility: string | undefined): 'private' | 'protected' | undefined {
  if (visibility === 'private') return 'private';
  // ponytail: 抽象宣言のない親→子の protected 呼び出しは違反のまま。デフォルト実装付きフックを扱うときに見直す
  if (visibility === 'protected' && !extendsChainIds(codebase, callerClassId).has(ownerClassId)) return 'protected';
  return undefined;
}

/**
 * private / protected のメソッドが、届かないクラスから呼ばれている箇所を見つかった順に重複なく列挙する。
 * 「子孫」の判定は、呼ぶ側のクラスの extends の先祖(自分を含む)に持ち主が入っているか(implementsは実装を継承しないので数えない)。
 */
export function findVisibilityViolations(codebase: Codebase): VisibilityViolation[] {
  const owners = methodOwnerMap(codebase);
  const seen = new Set<string>();
  const violations: VisibilityViolation[] = [];
  for (const codeClass of allClasses(codebase)) {
    const usedMethodIds = codeClass.methods.flatMap((method) => method.fragments).flatMap((fragment) => fragment.uses ?? []);
    for (const methodId of usedMethodIds) {
      const callerClassId = codeClass.id;
      const ownerClassId = owners.get(methodId);
      if (ownerClassId === undefined || ownerClassId === callerClassId) continue;
      if (resolvesToOwnDeclaration(codebase, callerClassId, methodId)) continue;
      const kind = violationKind(codebase, ownerClassId, callerClassId, findMethod(codebase, methodId)?.visibility);
      if (kind === undefined) continue;
      const key = `${methodId} ${callerClassId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({ methodId, callerClassId, kind });
    }
  }
  return violations;
}

/**
 * 採点に数える違反。visibilityEnforced のステージは private/protected とも全件、そうでないステージは
 * protected の越境だけ(ユーザー決定: protected の越境は全ステージで数える)。
 */
export function countedVisibilityViolations(codebase: Codebase, visibilityEnforced: boolean | undefined): VisibilityViolation[] {
  const violations = findVisibilityViolations(codebase);
  return visibilityEnforced === true ? violations : violations.filter((violation) => violation.kind === 'protected');
}

/** 採点対象の越境呼び出しを、呼び出し元・持ち主クラスごとにまとめる。 */
export function visibilityViolationDependencies(
  codebase: Codebase,
  visibilityEnforced: boolean | undefined,
): VisibilityViolationDependency[] {
  const owners = methodOwnerMap(codebase);
  const grouped = new Map<string, { from: string; to: string; kind: 'private' | 'protected'; methodIds: string[] }>();
  for (const violation of countedVisibilityViolations(codebase, visibilityEnforced)) {
    const to = owners.get(violation.methodId);
    if (to === undefined) continue;
    const key = `${violation.callerClassId}\u0000${to}`;
    const group = grouped.get(key);
    if (group === undefined) {
      grouped.set(key, { from: violation.callerClassId, to, kind: violation.kind, methodIds: [violation.methodId] });
      continue;
    }
    if (violation.kind === 'private') group.kind = 'private';
    if (!group.methodIds.includes(violation.methodId)) group.methodIds.push(violation.methodId);
  }
  return [...grouped.values()];
}
