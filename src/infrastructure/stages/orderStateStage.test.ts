import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { measureExtendPain } from '../../domain/change/changePain';
import { allClasses } from '../../domain/codebase/Codebase';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'advanced-order-state');
if (stage === undefined) throw new Error('上級9がありません');
const solution = sampleAnswerSteps[stage.id] ?? [];

describe('上級9: 注文の状態', () => {
  it('模範解答は27手で初期40点から100点になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const initialScore = scoreCodebase(stage.codebase, stage);
    const finalScore = scoreCodebase(solved, stage);
    // Assert
    expect(solution).toHaveLength(27);
    expect(initialScore.total).toBe(40);
    expect(finalScore.total).toBe(100);
  });

  it('初期の3操作は行数を超え、解答後は状態ごとのクラスが契約を実装する', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const violations = findLineLimitViolations(stage.codebase, stage.limits);
    const classes = allClasses(solved);
    // Assert
    for (const operation of ['pay', 'ship', 'cancel']) {
      expect(violations).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'method', targetId: `method-order-${operation}` })]));
    }
    const contract = classes.find((codeClass) => codeClass.name === 'OrderState');
    for (const state of ['Unpaid', 'Paid', 'Shipped']) {
      const codeClass = classes.find((candidate) => candidate.name === `${state}State`);
      expect(codeClass?.interfaceIds).toContain(contract?.id);
      expect(codeClass?.methods.map((method) => method.name).sort()).toEqual(['handleCancel', 'handlePay', 'handleShip']);
      const responsibilities = codeClass?.methods.flatMap((method) => method.fragments).map((fragment) => fragment.responsibility);
      expect(new Set(responsibilities).size).toBe(1);
    }
    const order = classes.find((codeClass) => codeClass.name === 'Order');
    expect(order?.methods.flatMap((method) => method.fragments).every((fragment) => fragment.responsibility === 'call')).toBe(true);
  });

  it('インターフェースを実装しないと100点にならない', () => {
    // Arrange
    const incomplete = solution.filter((step) => !('addInterface' in step));
    // Act
    const score = scoreCodebase(applySolutionSteps(stage.codebase, incomplete), stage);
    // Assert
    expect(score.total).toBeLessThan(100);
  });

  it('返品の状態は新クラスとして追加できる', () => {
    // Arrange
    const request = stage.changeRequests[0];
    // Act
    const pain = measureExtendPain(stage, applySolutionSteps(stage.codebase, solution), request);
    // Assert
    expect(pain?.initialModified.length).toBeGreaterThanOrEqual(1);
    expect(pain?.currentModified).toEqual([]);
    expect(pain?.currentTarget).toEqual({ kind: 'new-class', implementing: 'OrderState' });
  });

  it('変更依頼とうわさ、選択肢の配置が仕様どおり', () => {
    // Arrange / Act
    const kinds = stage.changeRequests.map(changeKindOf);
    // Assert
    expect(kinds).toEqual(['extend', 'modify', 'modify']);
    expect(stage.changeRequests.map((request) => request.rumor !== undefined)).toEqual([false, false, true]);
    for (const check of stage.checks) {
      const correct = check.choices[check.answer];
      expect(correct.text.length).toBeLessThan(Math.max(...check.choices.map((choice) => choice.text.length)));
    }
  });
});
