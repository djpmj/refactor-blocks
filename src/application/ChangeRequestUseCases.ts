import { bossCounterfactual, type BossCounterfactual } from '../domain/change/bossCounterfactual';
import { changeKindOf, type ChangeError, type ChangeRequest } from '../domain/change/ChangeRequest';
import { measureChange } from '../domain/change/measureChange';
import { measurePlacement, type PlacementError } from '../domain/change/measurePlacement';
import { sampleImplementation, type SampleImplementation } from '../domain/change/sampleImplementation';
import { scoreChange, type ChangeAssessment } from '../domain/change/scoreChange';
import { scorePlacement, type PlacementAssessment } from '../domain/change/scorePlacement';
import type { Codebase } from '../domain/codebase/Codebase';
import { err, ok, type Result } from '../domain/shared/Result';
import type { Stage } from '../domain/stage/Stage';

export type ChangeOutcome = {
  readonly request: ChangeRequest;
  /** プレイヤーの実装(置き方)の採点。 */
  readonly placement: PlacementAssessment;
  /** 挑戦前のコードでの解答例(置き先と点数)。置き先の候補がなければ undefined。 */
  readonly sample: SampleImplementation | undefined;
  /** 挑戦前のコードに依頼を当てたときの変更コスト。'extend' の依頼では null(追加で済むかは placement で測るため)。 */
  readonly current: ChangeAssessment | null;
  /** 初期状態のコードでの変更コスト(比較用)。'extend' では null。 */
  readonly initial: ChangeAssessment | null;
  /** ボスの依頼のときだけ。組み替える前のコードに入れていたら。 */
  readonly bossCounterfactual?: BossCounterfactual;
};

export type ImplementationError = ChangeError | PlacementError;

function measureCosts(
  stage: Pick<Stage, 'limits' | 'codebase'>,
  design: Codebase,
  request: ChangeRequest,
): Result<Pick<ChangeOutcome, 'current' | 'initial'>, ChangeError> {
  if (changeKindOf(request) === 'extend') return ok({ current: null, initial: null });
  const current = measureChange(design, request, stage.limits);
  if (!current.ok) return err(current.error);
  const initial = measureChange(stage.codebase, request, stage.limits);
  if (!initial.ok) return err(initial.error);
  return ok({
    current: { impact: current.value, score: scoreChange(current.value) },
    initial: { impact: initial.value, score: scoreChange(initial.value) },
  });
}

function withBossCounterfactual(stage: Pick<Stage, 'limits' | 'codebase'>, request: ChangeRequest): Pick<ChangeOutcome, 'bossCounterfactual'> {
  const counterfactual = bossCounterfactual(stage, request);
  return counterfactual === undefined ? {} : { bossCounterfactual: counterfactual };
}

/** 「実装を終える」操作。design は変更コスト、base は置き方を測るコード、sampleBase は解答例を求めるコード(前の依頼を解答例どおりに置いたもの)。 */
export function evaluateImplementationUseCase(
  stage: Pick<Stage, 'limits' | 'codebase'>,
  codebases: Readonly<{ design: Codebase; base: Codebase; sampleBase: Codebase; implemented: Codebase }>,
  request: ChangeRequest,
): Result<ChangeOutcome, ImplementationError> {
  const costs = measureCosts(stage, codebases.design, request);
  if (!costs.ok) return err(costs.error);
  const placement = measurePlacement(codebases.base, codebases.implemented, request);
  if (!placement.ok) return err(placement.error);
  return ok({
    request,
    placement: { placement: placement.value, score: scorePlacement(placement.value, changeKindOf(request)) },
    sample: sampleImplementation(codebases.sampleBase, request),
    ...costs.value,
    ...withBossCounterfactual(stage, request),
  });
}

/**
 * 変更依頼をすべて確定し、どの依頼も解答例と同じ点以上で置けたか。
 * 解答例が無い依頼(sample が undefined)は、比べる相手が無いので満たしたとみなす。
 */
/** 判定に使う ChangeOutcome の部分。 */
type ClearableOutcome = { readonly placement: { readonly score: { readonly total: number } }; readonly sample: { readonly score: number } | undefined };

export function isChangeChallengeCleared(outcomes: readonly ClearableOutcome[], requestCount: number): boolean {
  return requestCount > 0 && outcomes.length === requestCount && outcomes.every((outcome) => outcome.placement.score.total >= (outcome.sample?.score ?? 0));
}
