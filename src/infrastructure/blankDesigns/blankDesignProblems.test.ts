import { describe, expect, it } from 'vitest';
import { modelAnswerCodebase, reviewBlankDesign } from '../../domain/blank/reviewBlankDesign';
import { applySolutionSteps } from '../../domain/stage/sampleAnswer';
import { findUnplacedParts, TRAY_FILE_ID } from '../../domain/blank/tray';
import { blankDesignProblems } from './blankDesignProblems';

describe.each(blankDesignProblems)('$id', (problem) => {
  it('問題IDは重複しない', () => {
    // Arrange & Act
    const matches = blankDesignProblems.filter((candidate) => candidate.id === problem.id);

    // Assert
    expect(matches).toHaveLength(1);
  });

  it('codebase は部品置き場だけ(ファイル1つ、IDがTRAY_FILE_ID)', () => {
    // Arrange & Act & Assert
    expect(problem.codebase.files).toHaveLength(1);
    expect(problem.codebase.files[0].id).toBe(TRAY_FILE_ID);
  });

  it('模範解答が全部品を配置している', () => {
    // Arrange & Act
    const unplaced = findUnplacedParts(problem.codebase, modelAnswerCodebase(problem));

    // Assert
    expect(unplaced).toEqual([]);
  });

  it('模範解答は100点になる', () => {
    // Arrange & Act
    const result = reviewBlankDesign(problem, modelAnswerCodebase(problem));

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.model.score.total).toBe(100);
  });
});

describe('blank-order-shipping', () => {
  const problem = blankDesignProblems.find((candidate) => candidate.id === 'blank-order-shipping');
  if (problem === undefined) throw new Error('blank-order-shipping が見つかりません');

  it('機能(注文・発送)ごとに分けた設計は、模範解答より設計スコアも変更容易性スコアも低い', () => {
    // Arrange: 「注文」「発送」という機能の流れで、税・保存・メールの処理をまとめてしまった設計
    const functionGrouped = applySolutionSteps(problem.codebase, [
      { addFile: 'src/order/OrderService.ts' },
      { addFile: 'src/shipping/ShippingService.ts' },
      { addClass: { name: 'OrderService', file: 'src/order/OrderService.ts' } },
      { addClass: { name: 'ShippingService', file: 'src/shipping/ShippingService.ts' } },
      { move: { method: 'placeOrder', toClass: 'OrderService' } },
      { move: { method: 'calculateOrderTax', toClass: 'OrderService' } },
      { move: { method: 'saveOrder', toClass: 'OrderService' } },
      { move: { method: 'sendOrderConfirmMail', toClass: 'OrderService' } },
      { move: { method: 'shipOrder', toClass: 'ShippingService' } },
      { move: { method: 'updateShippingStatus', toClass: 'ShippingService' } },
      { move: { method: 'sendShippedMail', toClass: 'ShippingService' } },
    ]);

    // Act
    const grouped = reviewBlankDesign(problem, functionGrouped);
    const model = reviewBlankDesign(problem, modelAnswerCodebase(problem));

    // Assert
    if (!grouped.ok || !model.ok) throw new Error('unexpected error');
    // OrderService・ShippingServiceとも、流れ・税(または保存)・メールの3責務が同居して責務の混在×2(-20点)になる
    expect(grouped.value.player.score.total).toBe(80);
    expect(model.value.player.score.total).toBe(100);
    expect(grouped.value.player.score.total).toBeLessThan(model.value.player.score.total);
    expect(grouped.value.player.changeScore).toBeLessThanOrEqual(model.value.player.changeScore);
  });
});
