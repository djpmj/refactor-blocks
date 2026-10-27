import { describe, expect, it } from 'vitest';
import { updateMoveBest } from './moveBests';

describe('updateMoveBest', () => {
  it('記録が無ければ今回の手数を記録する', () => {
    // Arrange・Act・Assert
    expect(updateMoveBest({}, 'a', 3)).toEqual({ a: 3 });
  });

  it('今回のほうが少なければ更新する', () => {
    // Arrange・Act・Assert
    expect(updateMoveBest({ a: 5 }, 'a', 3)).toEqual({ a: 3 });
  });

  it('自己ベスト以上なら同じ参照を返す', () => {
    // Arrange
    const bests = { a: 3 };

    // Act・Assert
    expect(updateMoveBest(bests, 'a', 3)).toBe(bests);
    expect(updateMoveBest(bests, 'a', 5)).toBe(bests);
  });

  it('0手も記録し、他のステージの記録は残す', () => {
    // Arrange・Act・Assert
    expect(updateMoveBest({ b: 2 }, 'a', 0)).toEqual({ a: 0, b: 2 });
  });
});
