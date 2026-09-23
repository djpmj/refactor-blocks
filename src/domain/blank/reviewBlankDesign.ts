import type { ChangeError } from '../change/ChangeRequest';
import { measureChange } from '../change/measureChange';
import { averageScore, scoreChange, type ChangeAssessment } from '../change/scoreChange';
import type { Codebase } from '../codebase/Codebase';
import { scoreCodebase, type Score } from '../scoring/score';
import { applySolutionSteps } from '../stage/sampleAnswer';
import { err, ok, type Result } from '../shared/Result';
import type { BlankDesignProblem } from './BlankDesignProblem';
import { findUnplacedParts, withoutTray } from './tray';

/** 1つの設計(プレイヤー・模範解答のどちらか)を採点した結果。 */
export type DesignReview = {
  /** 採点したコードベース(部品置き場を取り除いたもの)。減点理由のクラス名・メソッド名の表示に使う。 */
  readonly codebase: Codebase;
  readonly score: Score;
  /** problem.changeRequests と同じ順。調査の減点はなし。 */
  readonly changes: readonly ChangeAssessment[];
  /** changes の点数の平均。 */
  readonly changeScore: number;
};

export type BlankDesignReview = { readonly player: DesignReview; readonly model: DesignReview };

export type ReviewError = 'unplaced-parts' | ChangeError;

/** 模範解答を適用して部品置き場を取り除いたコードベース。「模範解答の図」にも使う。 */
export function modelAnswerCodebase(problem: BlankDesignProblem): Codebase {
  return withoutTray(applySolutionSteps(problem.codebase, problem.modelAnswer));
}

/** 変更依頼を順に当て、途中で失敗したらそこで打ち切る。 */
function assessChanges(codebase: Codebase, problem: BlankDesignProblem): Result<ChangeAssessment[], ChangeError> {
  return problem.changeRequests.reduce<Result<ChangeAssessment[], ChangeError>>((acc, request) => {
    if (!acc.ok) return acc;
    const impact = measureChange(codebase, request, problem.limits);
    if (!impact.ok) return err(impact.error);
    return ok([...acc.value, { impact: impact.value, score: scoreChange(impact.value) }]);
  }, ok([]));
}

function reviewDesign(problem: BlankDesignProblem, codebase: Codebase): Result<DesignReview, ChangeError> {
  const design = withoutTray(codebase);
  const changes = assessChanges(design, problem);
  if (!changes.ok) return err(changes.error);
  return ok({
    codebase: design,
    score: scoreCodebase(design, problem),
    changes: changes.value,
    changeScore: averageScore(changes.value.map((change) => change.score)),
  });
}

/** プレイヤーの設計と模範解答を、同じ採点ルール・同じ変更依頼で採点して並べる。 */
export function reviewBlankDesign(problem: BlankDesignProblem, codebase: Codebase): Result<BlankDesignReview, ReviewError> {
  if (findUnplacedParts(problem.codebase, codebase).length > 0) return err('unplaced-parts');
  const player = reviewDesign(problem, codebase);
  if (!player.ok) return err(player.error);
  const model = reviewDesign(problem, modelAnswerCodebase(problem));
  if (!model.ok) return err(model.error);
  return ok({ player: player.value, model: model.value });
}
