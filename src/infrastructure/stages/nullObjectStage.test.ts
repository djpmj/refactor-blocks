import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { measureExtendPain, measurePain } from '../../domain/change/changePain';
import { allClasses } from '../../domain/codebase/Codebase';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'advanced-null-object');
if (stage === undefined) throw new Error('上級13(Null Object)がありません');
const solution = sampleAnswerSteps[stage.id] ?? [];

describe('上級13: クーポンの Null Object', () => {
  it('模範解答は11手で初期70点から100点になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const initial = scoreCodebase(stage.codebase, stage);
    const final = scoreCodebase(solved, stage);
    // Assert
    expect(stages.filter((item) => item.level === 'advanced').at(-1)?.id).toBe(stage.id);
    expect(solution).toHaveLength(11);
    expect(initial.total).toBe(70);
    expect(final.total).toBe(100);
  });

  it('初期の減点は責務の混在だけで、3クラス', () => {
    // Arrange / Act
    const deductions = scoreCodebase(stage.codebase, stage).deductions.filter((deduction) => deduction.count > 0);
    // Assert
    expect(deductions.map((deduction) => deduction.rule)).toEqual(['responsibility']);
    expect(deductions[0].count).toBe(3);
  });

  it('解答後は NoCoupon が Coupon を実装し、呼び出し側には呼び出し行だけが残る', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const classes = allClasses(solved);
    const contract = classes.find((codeClass) => codeClass.name === 'Coupon');
    const noCoupon = classes.find((codeClass) => codeClass.name === 'NoCoupon');
    // Assert
    expect(noCoupon?.interfaceIds).toContain(contract?.id);
    expect(noCoupon?.methods.map((method) => method.name).sort((a, b) => a.localeCompare(b))).toEqual(['applyDiscount', 'describe']);
    const responsibilities = noCoupon?.methods.flatMap((method) => method.fragments).map((fragment) => fragment.responsibility);
    expect(new Set(responsibilities)).toEqual(new Set(['no-coupon']));
    for (const name of ['CheckoutService', 'CartService', 'ReceiptService']) {
      const caller = classes.find((codeClass) => codeClass.name === name);
      const remaining = caller?.methods.flatMap((method) => method.fragments).filter((fragment) => fragment.responsibility === 'no-coupon');
      expect(remaining).toEqual([]);
    }
  });

  it('インターフェースの実装を抜くと100点にならない', () => {
    // Arrange
    const incomplete = solution.filter((step) => !('addInterface' in step));
    // Act
    const score = scoreCodebase(applySolutionSteps(stage.codebase, incomplete), stage);
    // Assert
    expect(score.total).toBeLessThan(100);
  });

  it('送料無料クーポンは新クラスで足せ、クーポンなしの案内は3クラス→1クラスの変更になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const extend = measureExtendPain(stage, solved, stage.changeRequests[0]);
    const modify = measurePain(stage, solved);
    // Assert
    expect(extend?.currentModified).toEqual([]);
    expect(extend?.currentTarget).toEqual({ kind: 'new-class', implementing: 'Coupon' });
    expect(modify?.request.id).toBe('req-no-coupon-guidance');
    expect(modify?.initial.classes).toBe(3);
    expect(modify?.current.classes).toBe(1);
  });

  it('依頼は extend・modify・modify で3件目だけがうわさを持ち、理解度チェックは最長の選択肢が正解でない', () => {
    // Arrange / Act
    const kinds = stage.changeRequests.map(changeKindOf);
    // Assert
    expect(kinds).toEqual(['extend', 'modify', 'modify']);
    expect(stage.changeRequests.map((request) => request.rumor !== undefined)).toEqual([false, false, true]);
    for (const check of stage.checks) {
      expect(check.choices[check.answer].text.length).toBeLessThan(Math.max(...check.choices.map((choice) => choice.text.length)));
    }
  });
});
