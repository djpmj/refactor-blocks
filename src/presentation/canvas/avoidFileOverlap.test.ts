import { describe, expect, it } from 'vitest';
import { avoidFileOverlap } from './avoidFileOverlap';

const size = { width: 100, height: 50 };

describe('avoidFileOverlap', () => {
  it('returns the position as is when there are no existing files', () => {
    // Arrange
    const position = { x: 10, y: 20 };

    // Act
    const result = avoidFileOverlap(position, size, [], 60);

    // Assert
    expect(result).toEqual(position);
  });

  it('returns the position as is when it does not overlap', () => {
    // Arrange
    const existing = [{ x: 300, y: 0, width: 100, height: 100 }];

    // Act
    const result = avoidFileOverlap({ x: 10, y: 20 }, size, existing, 60);

    // Assert
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('moves right to the overlapped file right edge plus gap, keeping y', () => {
    // Arrange
    const existing = [{ x: 0, y: 0, width: 200, height: 100 }];

    // Act
    const result = avoidFileOverlap({ x: 150, y: 20 }, size, existing, 60);

    // Assert
    expect(result).toEqual({ x: 260, y: 20 });
  });

  it('keeps moving when the new spot overlaps another file', () => {
    // Arrange
    const existing = [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 250, y: 0, width: 100, height: 100 },
    ];

    // Act
    const result = avoidFileOverlap({ x: 150, y: 20 }, size, existing, 60);

    // Assert
    expect(result).toEqual({ x: 410, y: 20 });
  });

  it('keeps the position when only touching the left side with a gap smaller than gap', () => {
    // Arrange
    const existing = [{ x: 110, y: 0, width: 100, height: 100 }];

    // Act
    const result = avoidFileOverlap({ x: 10, y: 20 }, size, existing, 60);

    // Assert
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('detects a vertical overlap caused by a tall box', () => {
    // Arrange: 低い箱なら下に収まるが、高い箱は既存と縦方向に交差する
    const existing = [{ x: 0, y: 100, width: 200, height: 100 }];
    const tall = { width: 100, height: 300 };

    // Act
    const low = avoidFileOverlap({ x: 50, y: 20 }, size, existing, 60);
    const high = avoidFileOverlap({ x: 50, y: 20 }, tall, existing, 60);

    // Assert
    expect(low).toEqual({ x: 50, y: 20 });
    expect(high).toEqual({ x: 260, y: 20 });
  });

  it('skips several files in a row for a tall box', () => {
    // Arrange: 2つ目・3つ目は下の方にあり、高い箱だけがぶつかる
    const existing = [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 160, y: 200, width: 100, height: 50 },
      { x: 320, y: 250, width: 100, height: 50 },
    ];

    // Act
    const result = avoidFileOverlap({ x: 50, y: 10 }, { width: 100, height: 300 }, existing, 60);

    // Assert
    expect(result).toEqual({ x: 480, y: 10 });
  });
});
