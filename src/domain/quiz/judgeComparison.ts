import type { ChangeError } from '../change/ChangeRequest';
import { measureChange } from '../change/measureChange';
import { scoreChange, type ChangeAssessment } from '../change/scoreChange';
import type { Codebase } from '../codebase/Codebase';
import { err, ok, type Result } from '../shared/Result';
import type { ComparisonQuiz, DesignChoice } from './ComparisonQuiz';

export type ComparisonVerdict = {
  readonly choice: DesignChoice;
  /** 変更依頼のスコアが高い方。 */
  readonly answer: DesignChoice;
  readonly correct: boolean;
  readonly assessments: Readonly<Record<DesignChoice, ChangeAssessment>>;
};

export type JudgeError = ChangeError | 'tie';

function assess(quiz: ComparisonQuiz, codebase: Codebase): Result<ChangeAssessment, ChangeError> {
  const impact = measureChange(codebase, quiz.changeRequest, quiz.limits);
  return impact.ok ? ok({ impact: impact.value, score: scoreChange(impact.value) }) : impact;
}

/** 設計A・Bに同じ変更依頼を当て、点数の高い方を正解としてプレイヤーの選択を判定する。 */
export function judgeComparison(quiz: ComparisonQuiz, choice: DesignChoice): Result<ComparisonVerdict, JudgeError> {
  const a = assess(quiz, quiz.designs.a.codebase);
  if (!a.ok) return a;
  const b = assess(quiz, quiz.designs.b.codebase);
  if (!b.ok) return b;
  if (a.value.score.total === b.value.score.total) return err('tie');
  const answer: DesignChoice = a.value.score.total > b.value.score.total ? 'a' : 'b';
  return ok({ choice, answer, correct: choice === answer, assessments: { a: a.value, b: b.value } });
}
