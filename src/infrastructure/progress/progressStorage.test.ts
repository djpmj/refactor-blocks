import { describe, expect, it } from 'vitest';
import { isProgress } from './progressStorage';

describe('isProgress', () => {
  it('文字列キーと0〜100の数値の組ならtrue', () => {
    // Arrange
    const value = { 'stage-1': 80, 'stage-2': 100 };

    // Act & Assert
    expect(isProgress(value)).toBe(true);
  });

  it('空オブジェクトはtrue', () => {
    // Arrange
    const value = {};

    // Act & Assert
    expect(isProgress(value)).toBe(true);
  });

  it('値が数値でなければfalse', () => {
    // Arrange
    const value = { 'stage-1': '80' };

    // Act & Assert
    expect(isProgress(value)).toBe(false);
  });

  it('値が範囲外の数値ならfalse', () => {
    // Arrange
    const value = { 'stage-1': 150 };

    // Act & Assert
    expect(isProgress(value)).toBe(false);
  });

  it('null・配列・プリミティブはfalse', () => {
    expect(isProgress(null)).toBe(false);
    expect(isProgress([1, 2])).toBe(false);
    expect(isProgress('not an object')).toBe(false);
    expect(isProgress(42)).toBe(false);
  });
});
