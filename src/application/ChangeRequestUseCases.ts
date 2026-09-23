import { changeKindOf, type ChangeError, type ChangeRequest } from '../domain/change/ChangeRequest';
import { measureChange } from '../domain/change/measureChange';
import { measurePlacement, type PlacementError } from '../domain/change/measurePlacement';
import { scoreChange, type ChangeAssessment } from '../domain/change/scoreChange';
import { scorePlacement, type PlacementAssessment } from '../domain/change/scorePlacement';
import type { Codebase } from '../domain/codebase/Codebase';
import { err, ok, type Result } from '../domain/shared/Result';
import type { Stage } from '../domain/stage/Stage';

export type ChangeOutcome = {
  readonly request: ChangeRequest;
  /** プレイヤーの実装(置き方)の採点。 */
  readonly placement: PlacementAssessment;
  /** 挑戦前のコードに依頼を当てたときの変更コスト。'extend' の依頼では null(追加で済むかは placement で測るため)。 */
  readonly current: ChangeAssessment | null;
  /** 初期状態のコードでの変更コスト(比較用)。'extend' では null。 */
  readonly initial: ChangeAssessment | null;
};

export type ImplementationError = ChangeError | PlacementError;

function measureCosts(
  stage: Pick<Stage, 'limits' | 'codebase'>,
  base: Codebase,
  request: ChangeRequest,
): Result<Pick<ChangeOutcome, 'current' | 'initial'>, ChangeError> {
  if (changeKindOf(request) === 'extend') return ok({ current: null, initial: null });
  const current = measureChange(base, request, stage.limits);
  if (!current.ok) return err(current.error);
  const initial = measureChange(stage.codebase, request, stage.limits);
  if (!initial.ok) return err(initial.error);
  return ok({
    current: { impact: current.value, score: scoreChange(current.value) },
    initial: { impact: initial.value, score: scoreChange(initial.value) },
  });
}

/** 「実装を終える」操作。base は挑戦前のコード、implemented は部品を置いたあとのコード。 */
export function evaluateImplementationUseCase(
  stage: Pick<Stage, 'limits' | 'codebase'>,
  base: Codebase,
  implemented: Codebase,
  request: ChangeRequest,
): Result<ChangeOutcome, ImplementationError> {
  const costs = measureCosts(stage, base, request);
  if (!costs.ok) return err(costs.error);
  const placement = measurePlacement(base, implemented, request);
  if (!placement.ok) return err(placement.error);
  return ok({
    request,
    placement: { placement: placement.value, score: scorePlacement(placement.value, changeKindOf(request)) },
    ...costs.value,
  });
}
