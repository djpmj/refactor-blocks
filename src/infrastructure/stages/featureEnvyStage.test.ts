import { describe, expect, it } from 'vitest';
import { measureChange } from '../../domain/change/measureChange';
import { scoreChange } from '../../domain/change/scoreChange';
import { allClasses, findClass } from '../../domain/codebase/Codebase';
import { deleteClass } from '../../domain/codebase/deleteClass';
import { classDependencies } from '../../domain/codebase/dependencies';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'intermediate-feature-envy');
if (stage === undefined) throw new Error('中級6 (intermediate-feature-envy) がありません');
const solution = sampleAnswerSteps[stage.id];
if (solution === undefined) throw new Error('中級6の模範解答がありません');

describe('中級6: 他人のデータばかり触るメソッド', () => {
  it('初期状態は40点(行数・責務の混在・Feature Envy 2件・カプセル化の破れ2件)', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const score = scoreCodebase(codebase, stage);

    // Assert
    expect(score.total).toBe(40);
    expect(score.deductions.find((d) => d.rule === 'line-limit')?.count).toBe(1);
    expect(score.deductions.find((d) => d.rule === 'responsibility')?.count).toBe(1);
    expect(score.deductions.find((d) => d.rule === 'feature-envy')?.count).toBe(2);
    expect(score.deductions.find((d) => d.rule === 'encapsulation')?.count).toBe(2);
  });

  it('模範解答の2手目まで適用すると、Subscription と BillingService の依存が両方 cyclic', () => {
    // Arrange
    const partial = applySolutionSteps(stage.codebase, solution.slice(0, 2));

    // Act
    const dependencies = classDependencies(partial);
    const cyclicPairs = dependencies.filter((dependency) => dependency.cyclic);

    // Assert
    expect(cyclicPairs).toHaveLength(2);
    expect(cyclicPairs.some((d) => d.from === 'class-subscription' && d.to === 'class-billing-service')).toBe(true);
    expect(cyclicPairs.some((d) => d.from === 'class-billing-service' && d.to === 'class-subscription')).toBe(true);
  });

  it('模範解答の3手目まで適用すると循環依存が消える', () => {
    // Arrange
    const partial = applySolutionSteps(stage.codebase, solution.slice(0, 3));

    // Act
    const cyclic = classDependencies(partial).filter((dependency) => dependency.cyclic);

    // Assert
    expect(cyclic).toEqual([]);
  });

  it('模範解答のあと、trialDays が Subscription にあり、BillingService の依存先は Subscription だけ', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const subscription = findClass(solved, 'class-subscription');
    const billingDependencies = classDependencies(solved).filter((dependency) => dependency.from === 'class-billing-service');

    // Assert
    expect(subscription?.fields?.some((field) => field.name === 'trialDays')).toBe(true);
    expect(billingDependencies.map((dependency) => dependency.to)).toEqual(['class-subscription']);
  });

  it('初期状態で Subscription を削除しようとすると has-fields になる', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const result = deleteClass(codebase, 'class-subscription');

    // Assert
    expect(result).toEqual({ ok: false, error: 'has-fields' });
  });

  it('変更依頼2件は、初期75点・模範解答のあと95点で、classesTouched は増えない', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act & Assert
    for (const request of stage.changeRequests) {
      const before = measureChange(stage.codebase, request, stage.limits);
      const after = measureChange(solved, request, stage.limits);
      if (!before.ok || !after.ok) throw new Error('measureChange に失敗しました');
      expect(scoreChange(before.value).total).toBe(75);
      expect(scoreChange(after.value).total).toBe(95);
      expect(before.value.classesTouched).toBe(1);
      expect(after.value.classesTouched).toBe(1);
    }
  });

  it('解答例のコードベースには Subscription・BillingService のクラスがある', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const names = allClasses(solved).map((codeClass) => codeClass.name);

    // Assert
    expect(names).toEqual(expect.arrayContaining(['Subscription', 'BillingService']));
  });
});
