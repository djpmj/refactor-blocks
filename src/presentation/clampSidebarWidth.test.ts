import { describe, expect, it } from 'vitest';
import { clampSidebarWidth } from './clampSidebarWidth';

describe('clampSidebarWidth', () => {
  it.each([
    { name: '範囲内の幅はそのまま返す', width: 360, expected: 360 },
    { name: '最小幅より小さい値は最小幅に収める', width: 200, expected: 280 },
    { name: '最大幅より大きい値は最大幅に収める', width: 800, expected: 640 },
  ])('$name', ({ width, expected }) => {
    // Arrange
    const minimumWidth = 280;
    const maximumWidth = 640;

    // Act
    const clamped = clampSidebarWidth(width, minimumWidth, maximumWidth);

    // Assert
    expect(clamped).toBe(expected);
  });
});
