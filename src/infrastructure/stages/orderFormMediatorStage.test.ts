import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { measurePain } from '../../domain/change/changePain';
import { allClasses } from '../../domain/codebase/Codebase';
import { classDependencies } from '../../domain/codebase/dependencies';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'intermediate-order-form-mediator');
if (stage === undefined) throw new Error('中級13(Mediator)がありません');
const solution = sampleAnswerSteps[stage.id] ?? [];

describe('中級13: 呼び合う画面部品の Mediator', () => {
  it('模範解答は8手で、初期10点から100点になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const initial = scoreCodebase(stage.codebase, stage);
    const final = scoreCodebase(solved, stage);
    // Assert
    expect(stages.filter((item) => item.level === 'intermediate').at(-1)?.id).toBe(stage.id);
    expect(solution).toHaveLength(8);
    expect(initial.total).toBe(10);
    expect(final.total).toBe(100);
  });

  it('初期の減点は cycle 6件と responsibility 3件だけ', () => {
    // Arrange / Act
    const deductions = scoreCodebase(stage.codebase, stage).deductions.filter((deduction) => deduction.count > 0);
    // Assert
    expect(deductions.map((deduction) => [deduction.rule, deduction.count])).toEqual([['cycle', 6], ['responsibility', 3]]);
  });

  it('解答後の依存は仲介役から3部品への3本だけで、循環しない', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    const names = new Map(allClasses(solved).map((codeClass) => [codeClass.id, codeClass.name]));
    // Act
    const dependencies = classDependencies(solved).map((dependency) => [names.get(dependency.from), names.get(dependency.to), dependency.cyclic]);
    // Assert
    expect(dependencies.map(([from, to]) => `${String(from)}->${String(to)}`).sort((a, b) => a.localeCompare(b))).toEqual([
      'OrderFormMediator->CartList',
      'OrderFormMediator->CouponInput',
      'OrderFormMediator->ShippingSelector',
    ]);
    expect(dependencies.every(([, , cyclic]) => cyclic === false)).toBe(true);
  });

  it('解答後は仲介役が3つの入口を持ち、どのクラスも責務は1種類だけ', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const classes = allClasses(solved);
    const mediator = classes.find((codeClass) => codeClass.name === 'OrderFormMediator');
    // Assert
    expect(mediator?.methods.map((method) => method.name).sort((a, b) => a.localeCompare(b))).toEqual(['applyCoupon', 'changeQuantity', 'selectShipping']);
    for (const codeClass of classes) {
      const responsibilities = codeClass.methods.flatMap((method) => method.fragments).map((fragment) => fragment.responsibility).filter((name) => name !== 'call');
      expect(new Set(responsibilities).size).toBe(1);
    }
    const mediatorResponsibilities = mediator?.methods.flatMap((method) => method.fragments).map((fragment) => fragment.responsibility).filter((name) => name !== 'call');
    expect(new Set(mediatorResponsibilities)).toEqual(new Set(['coordination']));
  });

  it('最後の move を抜くと100点にならない', () => {
    // Arrange
    const incomplete = solution.slice(0, -1);
    // Act
    const score = scoreCodebase(applySolutionSteps(stage.codebase, incomplete), stage);
    // Assert
    expect(score.total).toBeLessThan(100);
  });

  it('注文ボタンの依頼は、3クラスの変更が仲介役1クラスになる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const pain = measurePain(stage, solved);
    // Assert
    expect(pain?.request.id).toBe('req-order-button');
    expect(pain?.initial.classes).toBe(3);
    expect(pain?.current.classes).toBe(1);
  });

  it('依頼は modify 2件で2件目だけがうわさを持ち、理解度チェックは最長の選択肢が正解でない', () => {
    // Arrange / Act
    const kinds = stage.changeRequests.map(changeKindOf);
    // Assert
    expect(kinds).toEqual(['modify', 'modify']);
    expect(stage.changeRequests.map((request) => request.rumor !== undefined)).toEqual([false, true]);
    for (const check of stage.checks) {
      expect(check.choices[check.answer].text.length).toBeLessThan(Math.max(...check.choices.map((choice) => choice.text.length)));
    }
  });
});
