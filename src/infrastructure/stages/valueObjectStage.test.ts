import { describe, expect, it } from 'vitest';
import { measureChange } from '../../domain/change/measureChange';
import { scoreChange } from '../../domain/change/scoreChange';
import { allClasses, type CodeClass } from '../../domain/codebase/Codebase';
import { findLowCohesionClasses } from '../../domain/scoring/cohesion';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'advanced-value-object');
if (stage === undefined) throw new Error('上級7 (advanced-value-object) がありません');
const solution = sampleAnswerSteps[stage.id];
if (solution === undefined) throw new Error('上級7の模範解答がありません');

function hasMoneyArithmetic(codeClass: CodeClass): boolean {
  return codeClass.methods.flatMap((method) => method.fragments).some((fragment) => fragment.responsibility === 'money-arithmetic');
}

describe('上級7: 金額と通貨を Money にまとめる', () => {
  it('初期状態は50点(行数1・責務の混在1・Feature Envy 3)で、凝集度は0', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const score = scoreCodebase(codebase, stage);

    // Assert
    expect(score.total).toBe(50);
    expect(score.deductions.find((d) => d.rule === 'line-limit')?.count).toBe(1);
    expect(score.deductions.find((d) => d.rule === 'responsibility')?.count).toBe(1);
    expect(score.deductions.find((d) => d.rule === 'feature-envy')?.count).toBe(3);
    expect(score.deductions.find((d) => d.rule === 'cohesion')?.count).toBe(0);
    expect(score.deductions.find((d) => d.rule === 'encapsulation')?.count).toBe(0);
    expect(score.deductions.find((d) => d.rule === 'coupling')?.count).toBe(0);
  });

  it('payOut のコード例は合計→整形→振込の順で、振込は合計の結果を使い true を返す', () => {
    // Arrange
    const payOut = allClasses(stage.codebase).flatMap((codeClass) => codeClass.methods).find((method) => method.name === 'payOut');

    // Act
    const ids = payOut?.fragments.map((fragment) => fragment.id);
    const transferCode = payOut?.fragments.find((fragment) => fragment.id === 'frag-payout-transfer')?.code?.csharp;

    // Assert
    expect(ids).toEqual(['frag-payout-sum-money', 'frag-payout-format-money', 'frag-payout-transfer']);
    expect(transferCode).toContain('result.Amount');
    expect(transferCode).toMatch(/return true;$/);
  });

  it('各 duplicateGroup がちょうど2つの処理に付いている', () => {
    // Arrange
    const fragments = allClasses(stage.codebase).flatMap((codeClass) => codeClass.methods).flatMap((method) => method.fragments);

    // Act
    const counts = new Map<string, number>();
    for (const fragment of fragments) {
      if (fragment.duplicateGroup === undefined) continue;
      counts.set(fragment.duplicateGroup, (counts.get(fragment.duplicateGroup) ?? 0) + 1);
    }

    // Assert
    expect([...counts.values()]).toEqual([2, 2, 2]);
  });

  it('模範解答のあと: Money に amount・currency と3メソッドがあり、どの処理も amount・currency を writes に持たず、Expense は1塊で100点', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const score = scoreCodebase(solved, stage);
    const money = allClasses(solved).find((codeClass) => codeClass.name === 'Money');
    const expenseCohesion = findLowCohesionClasses(solved).find((item) => item.classId === 'class-expense');
    const writesToMoneyFields = allClasses(solved)
      .flatMap((codeClass) => codeClass.methods)
      .flatMap((method) => method.fragments)
      .flatMap((fragment) => fragment.writes ?? [])
      .filter((fieldId) => fieldId === 'field-amount' || fieldId === 'field-currency');

    // Assert
    expect(score.total).toBe(100);
    expect(money?.fields?.map((field) => field.name)).toEqual(['amount', 'currency']);
    expect(money?.methods.map((method) => method.name).sort()).toEqual(['add', 'format', 'validate']);
    expect(writesToMoneyFields).toEqual([]);
    expect(expenseCohesion).toBeUndefined();
  });

  it('模範解答のあと: 金額の計算(money-arithmetic)は Money だけに残り、ApprovalService・PayoutService には残らない', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const classesWithArithmetic = allClasses(solved)
      .filter(hasMoneyArithmetic)
      .map((codeClass) => codeClass.name);

    // Assert
    expect(classesWithArithmetic).toEqual(['Money']);
  });

  it('変更依頼2件は、初期・模範解答のあとで表どおりの点数になる', () => {
    // Arrange
    const { codebase, limits, changeRequests } = stage;
    const solved = applySolutionSteps(codebase, solution);
    const [acceptEuroRequest, hideYenDecimalsRequest] = changeRequests;

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
    expect(acceptEuroRequest.id).toBe('req-accept-euro');
    expect(hideYenDecimalsRequest.id).toBe('req-hide-yen-decimals');
    // 実測: accept-euroはPayoutServiceを触らない(money-validationはPayoutServiceに存在しない)ため
    // 上限超えの件数がhide-yen-decimalsと異なる(仕様書は両方35点の見込みだったが、処理名コメントを行数に数えるようになった今は15点・5点。ApprovalService の戻り値 return と PayoutService の振込の return true を元の処理のまま残したので、処理名コメントの行が増えて触る処理の上限超えが各1件増えた)
    expect(scoresBefore.map((score) => score.total)).toEqual([15, 5]);
    expect(scoresAfter.map((score) => score.total)).toEqual([55, 55]);
  });
});

