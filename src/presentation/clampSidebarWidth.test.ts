import { describe, expect, it } from 'vitest';
import { clampSidebarWidth, sidebarWidthBounds, widthAfterDrag } from './clampSidebarWidth';

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

describe('sidebarWidthBounds', () => {
  it.each([
    { name: '701〜1023px では右パネルの上限を画面幅の30%にする', side: 'right', viewport: 800, min: 280, max: 640, expected: { min: 240, max: 240 } },
    { name: '701〜1023px では左パネルの上限も画面幅の30%にする', side: 'left', viewport: 800, min: 200, max: 280, expected: { min: 200, max: 240 } },
    { name: '1023px は30%の上限を使う', side: 'right', viewport: 1023, min: 280, max: 640, expected: { min: 280, max: 306 } },
    { name: '1024px 以上は呼び出し元の範囲のまま', side: 'right', viewport: 1024, min: 280, max: 640, expected: { min: 280, max: 640 } },
    { name: '701px は最小幅も上限に収める', side: 'right', viewport: 701, min: 280, max: 640, expected: { min: 210, max: 210 } },
    { name: '700px 以下の左パネルは今の式のまま', side: 'left', viewport: 375, min: 200, max: 480, expected: { min: 120, max: 150 } },
    { name: '700px 以下の右パネルは呼び出し元の範囲のまま', side: 'right', viewport: 375, min: 280, max: 640, expected: { min: 280, max: 640 } },
    { name: '30%より maxWidth が小さければ maxWidth を使う', side: 'left', viewport: 1000, min: 200, max: 250, expected: { min: 200, max: 250 } },
  ] as const)('$name', ({ side, viewport, min, max, expected }) => {
    // Arrange
    // (it.each の入力)

    // Act
    const bounds = sidebarWidthBounds(side, viewport, min, max);

    // Assert
    expect(bounds).toEqual(expected);
  });
});
