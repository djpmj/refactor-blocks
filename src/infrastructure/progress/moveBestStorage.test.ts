import { describe, expect, it } from 'vitest';
import { isMoveBests } from './moveBestStorage';

describe('isMoveBests', () => {
  it('文字列キーと0以上の整数の組ならtrue', () => {
    // Arrange・Act・Assert
    expect(isMoveBests({})).toBe(true);
    expect(isMoveBests({ a: 0, b: 12 })).toBe(true);
  });

  it('オブジェクト以外はfalse', () => {
    // Arrange・Act・Assert
    expect(isMoveBests(null)).toBe(false);
    expect(isMoveBests([])).toBe(false);
    expect(isMoveBests('abc')).toBe(false);
  });

  it('負数・小数・NaN・文字列の値を含むとfalse', () => {
    // Arrange・Act・Assert
    expect(isMoveBests({ a: -1 })).toBe(false);
    expect(isMoveBests({ a: 1.5 })).toBe(false);
    expect(isMoveBests({ a: Number.NaN })).toBe(false);
    expect(isMoveBests({ a: '3' })).toBe(false);
  });
});
