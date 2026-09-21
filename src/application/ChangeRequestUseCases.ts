import type { ChangeError, ChangeRequest } from '../domain/change/ChangeRequest';
import { checkInvestigation, type InvestigationResult } from '../domain/change/checkInvestigation';
import { measureChange, type ChangeImpact } from '../domain/change/measureChange';
import { scoreChange, type ChangeScore } from '../domain/change/scoreChange';
import type { Codebase } from '../domain/codebase/Codebase';
import { err, ok, type Result } from '../domain/shared/Result';
import type { Stage } from '../domain/stage/Stage';

export type ChangeAssessment = { readonly impact: ChangeImpact; readonly score: ChangeScore };

export type ChangeOutcome = {
  readonly request: ChangeRequest;
  readonly investigation: InvestigationResult;
  /** 今のコードに依頼を当てた結果。調査の漏れ・余計な選択も減点に含む。 */
  readonly current: ChangeAssessment;
  /** 初期状態のコードに同じ依頼を当てた結果(比較用)。調査の減点はなし。 */
  readonly initial: ChangeAssessment;
};

/** プレイヤーの「調査を終える」操作。今のコードと初期状態のコードに同じ依頼を当てて、コストを比べられるようにする。 */
export function evaluateChangeRequestUseCase(
  stage: Pick<Stage, 'limits' | 'codebase'>,
  codebase: Codebase,
  request: ChangeRequest,
  selectedMethodIds: readonly string[],
): Result<ChangeOutcome, ChangeError> {
  const current = measureChange(codebase, request, stage.limits);
  const initial = measureChange(stage.codebase, request, stage.limits);
  if (!current.ok) return err(current.error);
  if (!initial.ok) return err(initial.error);
  const investigation = checkInvestigation(selectedMethodIds, current.value.sites);
  return ok({
    request,
    investigation,
    current: { impact: current.value, score: scoreChange(current.value, investigation) },
    initial: { impact: initial.value, score: scoreChange(initial.value) },
  });
}
