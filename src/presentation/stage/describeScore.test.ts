import { describe, expect, it } from 'vitest';
import { describeScore } from './describeScore';

describe('describeScore', () => {
  it('0点では減点の合計を内訳の先頭に表示する', () => {
    // Arrange
    const score = {
      total: 0,
      deducted: 100,
      deductions: [
        { rule: 'line-limit' as const, count: 6, points: 60 },
        { rule: 'responsibility' as const, count: 3, points: 30 },
        { rule: 'empty' as const, count: 1, points: 10 },
      ],
    };

    // Act
    const description = describeScore(score);

    // Assert
    expect(description).toBe('0点(減点の合計 -100 / 行数 -60 / 責務の混在 -30 / 空のクラス・ファイル -10)');
  });

  it('1点以上では従来の文を維持する', () => {
    // Arrange
    const score = { total: 70, deducted: 30, deductions: [{ rule: 'line-limit' as const, count: 3, points: 30 }] };

    // Act
    const description = describeScore(score);

    // Assert
    expect(description).toBe('70点(行数 -30)');
  });
});
