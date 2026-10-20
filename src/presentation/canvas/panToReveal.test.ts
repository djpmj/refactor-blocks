import { describe, expect, it } from 'vitest';
import { panToReveal } from './panToReveal';

describe('panToReveal', () => {
  it('viewport内のmargin帯にある箱はパンしない', () => {
    // Arrange
    const box = { x: 1, y: 23, width: 100, height: 80 };
    const viewport = { x: 0, y: 0, width: 500, height: 400 };

    // Act
    const movement = panToReveal(box, viewport, 24);

    // Assert
    expect(movement).toEqual({ dx: 0, dy: 0 });
  });

  it('viewportからはみ出した箱にはmarginを加えてパンする', () => {
    // Arrange
    const box = { x: -1, y: -1, width: 100, height: 80 };
    const viewport = { x: 0, y: 0, width: 500, height: 400 };

    // Act
    const movement = panToReveal(box, viewport, 24);

    // Assert
    expect(movement).toEqual({ dx: 25, dy: 25 });
  });

  it('viewport内でmargin帯に入っている箱は動かさない', () => {
    // Arrange
    const box = { x: 10, y: 12, width: 100, height: 80 };
    const viewport = { x: 0, y: 0, width: 500, height: 400 };

    // Act
    const movement = panToReveal(box, viewport, 24);

    // Assert
    expect(movement).toEqual({ dx: 0, dy: 0 });
  });

  it('収まっている箱は動かさない', () => {
    // Arrange
    const box = { x: 100, y: 100, width: 200, height: 100 };
    const viewport = { x: 0, y: 0, width: 500, height: 400 };

    // Act
    const movement = panToReveal(box, viewport, 24);

    // Assert
    expect(movement).toEqual({ dx: 0, dy: 0 });
  });

  it('下と右にはみ出した量に余白を足して反対方向へ動かす', () => {
    // Arrange
    const box = { x: 400, y: 350, width: 150, height: 150 };
    const viewport = { x: 0, y: 0, width: 500, height: 400 };

    // Act
    const movement = panToReveal(box, viewport, 24);

    // Assert
    expect(movement).toEqual({ dx: -74, dy: -124 });
  });

  it('上と左にはみ出した量だけ正方向へ動かす', () => {
    // Arrange
    const box = { x: -30, y: -20, width: 100, height: 100 };
    const viewport = { x: 0, y: 0, width: 500, height: 400 };

    // Act
    const movement = panToReveal(box, viewport, 24);

    // Assert
    expect(movement).toEqual({ dx: 54, dy: 44 });
  });

  it('箱が表示領域より大きい場合は左上を優先して表示する', () => {
    // Arrange
    const box = { x: 100, y: 100, width: 700, height: 600 };
    const viewport = { x: 0, y: 0, width: 500, height: 400 };

    // Act
    const movement = panToReveal(box, viewport, 24);

    // Assert
    expect(movement).toEqual({ dx: -76, dy: -76 });
  });
});
