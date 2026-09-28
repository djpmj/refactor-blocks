import { resolvesToOwnDeclaration } from '../codebase/overrides';
import { allClasses, extendsChainIds, findMethod, type Codebase } from '../codebase/Codebase';
import { methodOwnerMap } from '../codebase/dependencies';

export type VisibilityViolation = {
  readonly methodId: string;
  readonly callerClassId: string;
  readonly kind: 'private' | 'protected';
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
