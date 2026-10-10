import { describe, expect, it } from 'vitest';
import { describeSolutionStep } from './describeSolutionStep';

describe('describeSolutionStep', () => {
  it('inline手順を呼び出し元へ戻す操作として案内する', () => {
    // Arrange
    const codebase = { files: [] };

    // Act
    const result = describeSolutionStep(codebase, { inline: { method: 'placeOrder', fromClass: 'OrderManager' } });

    // Assert
    expect(result).toContain('OrderManager の placeOrder');
    expect(result).toContain('呼び出し元へ戻す');
  });
});
