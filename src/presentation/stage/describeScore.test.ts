import { describe, expect, it } from 'vitest';
import { describeScore, describeScoreShort } from './describeScore';

describe('describeScoreShort', () => {
  it('減点なしでは「減点なし」だけを返す', () => {
    // Arrange
    const score = { total: 100, deducted: 0, deductions: [] };

    // Act
    const description = describeScoreShort(score);

    // Assert
    expect(description).toBe('✅ 減点なし');
  });

  it('減点ありではルールの数と合計だけを返す', () => {
    // Arrange
    const score = {
      total: 50,
      deducted: 50,
      deductions: [
        { rule: 'line-limit' as const, count: 2, points: 20 },
        { rule: 'responsibility' as const, count: 2, points: 20 },
        { rule: 'empty' as const, count: 1, points: 10 },
      ],
    };

    // Act
    const description = describeScoreShort(score);

    // Assert
    expect(description).toBe('減点 3項目(-50)');
  });

  it('0点(100を超えて切り捨て)でも同じ形で、0点のルールは数えない', () => {
    // Arrange
    const score = {
      total: 0,
      deducted: 140,
      deductions: [
        { rule: 'line-limit' as const, count: 6, points: 60 },
        { rule: 'responsibility' as const, count: 3, points: 30 },
        { rule: 'empty' as const, count: 1, points: 10 },
        { rule: 'cycle' as const, count: 2, points: 20 },
        { rule: 'coupling' as const, count: 2, points: 20 },
        { rule: 'unused' as const, count: 1, points: 0 },
      ],
    };

    // Act
    const description = describeScoreShort(score);

    // Assert
    expect(description).toBe('減点 5項目(-140)');
  });
});

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
