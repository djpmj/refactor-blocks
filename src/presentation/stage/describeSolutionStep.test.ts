import { describe, expect, it } from 'vitest';
import { describeSolutionStep } from './describeSolutionStep';

describe('describeSolutionStep', () => {
  it('extractのヒントで自動命名を案内する', () => {
    // Arrange
    const codebase = { files: [] };

    // Act
    const result = describeSolutionStep(codebase, { extract: { from: 'work', fragmentIds: ['a', 'b'], name: 'combine' } });

    // Assert
    expect(result).toBe('work から「a・b」をExtract Methodで取り出そう(名前は自動で combine になる)');
    expect(result).not.toContain('という名前にしよう');
  });

  it('extract元のクラス名をヒントに含める', () => {
    // Arrange
    const codebase = { files: [] };

    // Act
    const result = describeSolutionStep(codebase, { extract: { from: 'work', fromClass: 'Service', fragmentIds: ['a'], name: 'extractA' } });

    // Assert
    expect(result).toBe('Service の work から「a」をExtract Methodで取り出そう(名前は自動で extractA になる)');
  });

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
