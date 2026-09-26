import { describe, expect, it } from 'vitest';
import { measureChange } from '../../domain/change/measureChange';
import { scoreChange } from '../../domain/change/scoreChange';
import { changeVisibility } from '../../domain/codebase/changeVisibility';
import { classDependencies } from '../../domain/codebase/dependencies';
import { findClass } from '../../domain/codebase/Codebase';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'intermediate-anemic-domain-model');
if (stage === undefined) throw new Error('中級7 (intermediate-anemic-domain-model) がありません');
const solution = sampleAnswerSteps[stage.id];
if (solution === undefined) throw new Error('中級7の模範解答がありません');

describe('中級7: getter/setter だけの口座クラス', () => {
  it('初期状態は40点(行数1・Feature Envy 2件・カプセル化の破れ2件・凝集度1件)', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const score = scoreCodebase(codebase, stage);

    // Assert
    expect(score.total).toBe(40);
    expect(score.deductions.find((d) => d.rule === 'line-limit')?.count).toBe(1);
    expect(score.deductions.find((d) => d.rule === 'feature-envy')?.count).toBe(2);
    expect(score.deductions.find((d) => d.rule === 'encapsulation')?.count).toBe(2);
    expect(score.deductions.find((d) => d.rule === 'cohesion')?.count).toBe(1);
    expect(score.deductions.find((d) => d.rule === 'responsibility')?.count).toBe(0);
    expect(score.deductions.find((d) => d.rule === 'visibility')?.count).toBe(0);
    expect(score.deductions.find((d) => d.rule === 'coupling')?.count).toBe(0);
  });

  it('模範解答の1手目のあとに debit を public にしようとすると widening-not-needed', () => {
    // Arrange
    const afterExtract = applySolutionSteps(stage.codebase, solution.slice(0, 1));
    const debitId = findClass(afterExtract, 'class-account-service')?.methods.find((method) => method.name === 'debit')?.id;
    if (debitId === undefined) throw new Error('debit が見つかりません');

    // Act
    const result = changeVisibility(afterExtract, debitId, 'public');

    // Assert
    expect(result).toEqual({ ok: false, error: 'widening-not-needed' });
  });

  it('模範解答の2手目のあとにアクセス制御の違反が1件出て、3手目で消える', () => {
    // Arrange
    const afterMove = applySolutionSteps(stage.codebase, solution.slice(0, 2));
    const afterPublic = applySolutionSteps(stage.codebase, solution.slice(0, 3));

    // Act
    const scoreAfterMove = scoreCodebase(afterMove, stage);
    const scoreAfterPublic = scoreCodebase(afterPublic, stage);

    // Assert
    expect(scoreAfterMove.deductions.find((d) => d.rule === 'visibility')?.count).toBe(1);
    expect(scoreAfterPublic.deductions.find((d) => d.rule === 'visibility')?.count).toBe(0);
  });

  it('模範解答のあと: withdraw は Feature Envy にならず、AccountService の依存先は Account だけ。setBalance・setDailyWithdrawn は private', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const score = scoreCodebase(solved, stage);
    const accountService = findClass(solved, 'class-account-service');
    const account = findClass(solved, 'class-account');
    const dependencies = classDependencies(solved).filter((dependency) => dependency.from === 'class-account-service');

    // Assert
    expect(score.total).toBe(100);
    expect(dependencies.map((dependency) => dependency.to)).toEqual(['class-account']);
    expect(accountService?.methods.find((method) => method.name === 'withdraw')?.visibility).toBe('public');
    expect(account?.methods.find((method) => method.name === 'setBalance')?.visibility).toBe('private');
    expect(account?.methods.find((method) => method.name === 'setDailyWithdrawn')?.visibility).toBe('private');
  });

  it('変更依頼2件は、初期・模範解答のあとで表どおりの点数になる', () => {
    // Arrange
    const { codebase, limits, changeRequests } = stage;
    const solved = applySolutionSteps(codebase, solution);
    const [premiumLimitRequest, depositWhileFrozenRequest] = changeRequests;

    // Act
    const scoresBefore = changeRequests.map((request) => {
      const impact = measureChange(codebase, request, limits);
      if (!impact.ok) throw new Error('変更依頼の測定に失敗しました');
      return scoreChange(impact.value);
    });
    const scoresAfter = changeRequests.map((request) => {
      const impact = measureChange(solved, request, limits);
      if (!impact.ok) throw new Error('変更依頼の測定に失敗しました');
      return scoreChange(impact.value);
    });

    // Assert
    expect(premiumLimitRequest.id).toBe('req-premium-daily-limit');
    expect(depositWhileFrozenRequest.id).toBe('req-deposit-while-frozen');
    expect(scoresBefore.map((score) => score.total)).toEqual([70, 60]);
    expect(scoresAfter.map((score) => score.total)).toEqual([85, 80]);
  });
});
