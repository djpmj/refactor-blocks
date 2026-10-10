import { describe, expect, it } from 'vitest';
import { clampSidebarWidth } from './clampSidebarWidth';
import { widthAfterDrag } from './clampSidebarWidth';

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

describe('widthAfterDrag', () => {
  it.each([
    { side: 'left' as const, startX: 100, currentX: 140, expected: 300 },
    { side: 'right' as const, startX: 140, currentX: 100, expected: 300 },
    { side: 'left' as const, startX: 100, currentX: 60, expected: 220 },
    { side: 'left' as const, startX: 100, currentX: -500, expected: 200 },
    { side: 'left' as const, startX: 100, currentX: 500, expected: 480 },
    { side: 'left' as const, startX: 100, currentX: 100, expected: 260 },
  ])('$side sidebar drag from $startX to $currentX', ({ side, startX, currentX, expected }) => {
    // Arrange
    const startWidth = 260;

    // Act
    const width = widthAfterDrag(side, startWidth, startX, currentX, 200, 480);

    // Assert
    expect(width).toBe(expected);
  });

  it('clamps widths below a 200px minimum to 200px', () => {
    // Arrange
    const width = 199;

    // Act
    const clamped = clampSidebarWidth(width, 200, 480);

    // Assert
    expect(clamped).toBe(200);
  });
});
