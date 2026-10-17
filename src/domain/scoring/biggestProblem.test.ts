import { describe, expect, it } from 'vitest';
import { biggestProblem } from './biggestProblem';
import type { Score } from './score';

describe('biggestProblem', () => {
  it('最大の減点を返し、同点なら deductions の順で選ぶ', () => {
    // Arrange
    const score: Score = { total: 60, deducted: 40, deductions: [
      { rule: 'line-limit', count: 1, points: 10 },
      { rule: 'cycle', count: 1, points: 20 },
      { rule: 'responsibility', count: 2, points: 20 },
    ] };

    // Act
    const result = biggestProblem(score);

    // Assert
    expect(result).toBe('cycle');
  });

  it('points が0の減点を選ばず、減点が無い場合は undefined を返す', () => {
    // Arrange
    const score: Score = { total: 100, deducted: 0, deductions: [{ rule: 'cycle', count: 0, points: 0 }] };

    // Act
    const result = biggestProblem(score);

    // Assert
    expect(result).toBeUndefined();
  });
});
