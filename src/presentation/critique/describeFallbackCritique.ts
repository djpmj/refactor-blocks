import type { Codebase } from '../../domain/codebase/Codebase';
import { biggestProblem } from '../../domain/scoring/biggestProblem';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import type { Score } from '../../domain/scoring/score';
import { clearConditions, worstMeasures } from '../../domain/stage/clearConditions';
import type { Stage } from '../../domain/stage/Stage';
import { describeCondition } from '../stage/describeCondition';
import { RULE_LABEL } from '../stage/describeScore';
import { RULE_WHY } from '../stage/ruleWhy';

const NOTE = '※ AIの講評ではありません。採点の内訳から自動で作った簡易講評です。';

/** AI講評を取れなかったときの代わりに、採点の内訳とクリア条件の達成状況から作る簡易講評。 */
export function describeFallbackCritique(input: Readonly<{
  stage: Stage;
  codebase: Codebase;
  initial: Score;
  current: Score;
}>): string {
  const { stage, codebase, initial, current } = input;
  const conditions = clearConditions(initial, current, findLineLimitViolations(codebase, stage.limits));
  const unmet = conditions.filter((condition) => condition.count > 0);
  const lines = [NOTE, `クリア条件: ${conditions.length - unmet.length}/${conditions.length} 達成`];
  const rule = biggestProblem(current);
  if (current.deducted === 0 || rule === undefined) {
    return [...lines, '減点はありません。今の分け方でクリア条件をすべて満たしています。'].join('\n');
  }
  if (unmet.length > 0) {
    const measures = worstMeasures(codebase, stage);
    lines.push('まだ達成していない条件:');
    for (const condition of unmet) {
      const { goal, current: status } = describeCondition(condition, stage, measures, codebase);
      lines.push(status === null ? `・${goal}` : `・${goal}(${status})`);
    }
  }
  const points = current.deductions.find((deduction) => deduction.rule === rule)?.points ?? 0;
  lines.push(`いちばん大きい減点: ${RULE_LABEL[rule]} -${points}点`, RULE_WHY[rule].trouble);
  return lines.join('\n');
}
