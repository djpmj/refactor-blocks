import { allClasses, type Codebase, type Method } from '../codebase/Codebase';
import { classDependencies } from '../codebase/dependencies';
import { findLineLimitViolations, type LineLimits } from '../scoring/lineLimits';
import { err, ok, type Result } from '../shared/Result';
import { applyChangeRequest } from './applyChangeRequest';
import type { ChangeError, ChangeRequest } from './ChangeRequest';
import { findChangeSites } from './findChangeSites';

export type ChangeImpact = {
  /** 変更したメソッドのID。 */
  readonly sites: readonly string[];
  /** 散らばり: 変更が必要なクラスの数。 */
  readonly classesTouched: number;
  /** PRの大きさ: 変更が必要なファイルの数。 */
  readonly filesTouched: number;
  readonly linesAdded: number;
  /** 波及: 変更したクラスを呼んでいる、変更対象ではないクラスのID(直接の依存元だけ)。 */
  readonly rippleClasses: readonly string[];
  /** 巻き込み: 変更箇所のメソッドに同居している、依頼と無関係な責務の種類数の合計。 */
  readonly mixedResponsibilities: number;
  /** 触ったメソッド・クラス・ファイルのうち、変更後に行数の上限を超えているものの数。 */
  readonly overLimitTouched: number;
};

/** 抽出で入る呼び出し行は処理そのものではないので、責務としては数えない。 */
export const CALL_RESPONSIBILITY = 'call';

function unrelatedResponsibilities(method: Method, request: ChangeRequest): number {
  const others = method.fragments
    .map((fragment) => fragment.responsibility)
    .filter((responsibility) => responsibility !== request.responsibility && responsibility !== CALL_RESPONSIBILITY);
  return new Set(others).size;
}

/** 変更依頼を今のコードに当てたとき、どれだけ手間と影響が出るかを数える。 */
export function measureChange(codebase: Codebase, request: ChangeRequest, limits: LineLimits): Result<ChangeImpact, ChangeError> {
  const sites = findChangeSites(codebase, request);
  const applied = applyChangeRequest(codebase, request);
  if (!applied.ok) return err(applied.error);
  const classes = allClasses(codebase);
  const touchedClasses = classes.filter((codeClass) => codeClass.methods.some((method) => sites.includes(method.id)));
  const touchedClassIds = touchedClasses.map((codeClass) => codeClass.id);
  const touchedFiles = codebase.files.filter((file) => file.classes.some((codeClass) => touchedClassIds.includes(codeClass.id)));
  const touchedIds = new Set([...sites, ...touchedClassIds, ...touchedFiles.map((file) => file.id)]);
  const rippleClasses = classDependencies(codebase)
    .filter((dependency) => touchedClassIds.includes(dependency.to) && !touchedClassIds.includes(dependency.from))
    .map((dependency) => dependency.from);
  return ok({
    sites,
    classesTouched: touchedClasses.length,
    filesTouched: touchedFiles.length,
    linesAdded: sites.length * request.linesPerSite,
    rippleClasses: [...new Set(rippleClasses)],
    mixedResponsibilities: classes
      .flatMap((codeClass) => codeClass.methods)
      .filter((method) => sites.includes(method.id))
      .reduce((sum, method) => sum + unrelatedResponsibilities(method, request), 0),
    overLimitTouched: findLineLimitViolations(applied.value, limits).filter((violation) => touchedIds.has(violation.targetId)).length,
  });
}
