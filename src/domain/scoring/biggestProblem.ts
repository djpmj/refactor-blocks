import type { Score, ScoreRule } from './score';

/** いちばん大きい減点のルールを返す。同点は deductions の順で選び、減点が無ければ undefined。 */
export function biggestProblem(score: Score): ScoreRule | undefined {
  let biggest: ScoreRule | undefined;
  let biggestPoints = 0;
  for (const deduction of score.deductions) {
    if (deduction.points > biggestPoints) {
      biggest = deduction.rule;
      biggestPoints = deduction.points;
    }
  }
  return biggest;
}
