import { describe, expect, it } from 'vitest';
import { biggestProblem } from '../../domain/scoring/biggestProblem';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import { scoreCodebase, type Score } from '../../domain/scoring/score';
import { clearConditions, worstMeasures } from '../../domain/stage/clearConditions';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { describeCondition } from '../stage/describeCondition';
import { RULE_LABEL } from '../stage/describeScore';
import { RULE_WHY } from '../stage/ruleWhy';
import { describeFallbackCritique } from './describeFallbackCritique';

const NOTE = '※ AIの講評ではありません。採点の内訳から自動で作った簡易講評です。';
const [stage] = stages;
const initial = scoreCodebase(stage.codebase, stage);
const unmet = clearConditions(initial, initial, findLineLimitViolations(stage.codebase, stage.limits)).filter((condition) => condition.count > 0);

describe('describeFallbackCritique', () => {
  it('1行目は、AIの講評ではない旨の注記', () => {
    // Arrange
    const input = { stage, codebase: stage.codebase, initial, current: initial };

    // Act
    const text = describeFallbackCritique(input);

    // Assert
    expect(text.split('\n')[0]).toBe(NOTE);
  });

  it('クリア条件の達成数/全体数を出す', () => {
    // Arrange
    const conditions = clearConditions(initial, initial, findLineLimitViolations(stage.codebase, stage.limits));
    const met = conditions.filter((condition) => condition.count === 0).length;

    // Act
    const text = describeFallbackCritique({ stage, codebase: stage.codebase, initial, current: initial });

    // Assert
    expect(text).toContain(`クリア条件: ${met}/${conditions.length} 達成`);
  });

  it('未達成の条件を、条件の数だけ「・」付きで並べる', () => {
    // Arrange
    const measures = worstMeasures(stage.codebase, stage);

    // Act
    const lines = describeFallbackCritique({ stage, codebase: stage.codebase, initial, current: initial }).split('\n');

    // Assert
    expect(unmet.length).toBeGreaterThan(0);
    expect(lines).toContain('まだ達成していない条件:');
    const bullets = lines.filter((line) => line.startsWith('・'));
    expect(bullets).toHaveLength(unmet.length);
    unmet.forEach((condition, index) => {
      const { goal, current } = describeCondition(condition, stage, measures, stage.codebase);
      expect(bullets[index]).toBe(current === null ? `・${goal}` : `・${goal}(${current})`);
    });
  });

  it('現在の状況がある条件は「・目標(今の状況)」の形にする', () => {
    // Arrange
    const measures = worstMeasures(stage.codebase, stage);
    const withCurrent = unmet.find((condition) => describeCondition(condition, stage, measures, stage.codebase).current !== null);
    const description = withCurrent === undefined ? undefined : describeCondition(withCurrent, stage, measures, stage.codebase);

    // Act
    const text = describeFallbackCritique({ stage, codebase: stage.codebase, initial, current: initial });

    // Assert
    expect(description?.current).toEqual(expect.any(String));
    expect(text).toContain(`・${description?.goal ?? ''}(${description?.current ?? ''})`);
  });

  it('減点があれば、いちばん大きい減点と困る理由を続けて出す', () => {
    // Arrange
    const rule = biggestProblem(initial);
    if (rule === undefined) throw new Error('初期状態に減点がありません');
    const points = initial.deductions.find((deduction) => deduction.rule === rule)?.points ?? 0;

    // Act
    const text = describeFallbackCritique({ stage, codebase: stage.codebase, initial, current: initial });

    // Assert
    expect(text).toContain(`いちばん大きい減点: ${RULE_LABEL[rule]} -${points}点\n${RULE_WHY[rule].trouble}`);
  });

  it('減点が同点なら、deductions の順で先のものを選ぶ', () => {
    // Arrange
    const current: Score = {
      total: 80,
      deducted: 20,
      deductions: [
        { rule: 'coupling', count: 1, points: 10 },
        { rule: 'line-limit', count: 1, points: 10 },
      ],
    };

    // Act
    const text = describeFallbackCritique({ stage, codebase: stage.codebase, initial, current });

    // Assert
    expect(text).toContain(`いちばん大きい減点: ${RULE_LABEL.coupling} -10点`);
    expect(text).not.toContain(`いちばん大きい減点: ${RULE_LABEL['line-limit']}`);
  });

  it('減点なしなら、褒める一文だけを出す', () => {
    // Arrange
    const current: Score = { total: 100, deducted: 0, deductions: [] };

    // Act
    const text = describeFallbackCritique({ stage, codebase: stage.codebase, initial, current });

    // Assert
    expect(text.split('\n')[0]).toBe(NOTE);
    expect(text).toContain('減点はありません。今の分け方でクリア条件をすべて満たしています。');
    expect(text).not.toContain('まだ達成していない条件:');
    expect(text).not.toContain('いちばん大きい減点:');
  });
});
