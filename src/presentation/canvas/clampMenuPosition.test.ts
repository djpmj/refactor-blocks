import { describe, expect, it } from 'vitest';
import { clampMenuPosition } from './clampMenuPosition';

describe('clampMenuPosition', () => {
  it('ビューポート内に収まっていれば、クリック位置のまま返す', () => {
    // Arrange
    const point = { x: 100, y: 100 };
    const menuSize = { width: 200, height: 150 };
    const viewport = { width: 1280, height: 720 };

    // Act
    const clamped = clampMenuPosition(point, menuSize, viewport);

    // Assert
    expect(clamped).toEqual({ x: 100, y: 100 });
  });

  it('右端からはみ出す場合は、はみ出さない位置まで内側へ収める', () => {
    // Arrange
    const point = { x: 1200, y: 100 };
    const menuSize = { width: 200, height: 150 };
    const viewport = { width: 1280, height: 720 };

    // Act
    const clamped = clampMenuPosition(point, menuSize, viewport);

    // Assert
    expect(clamped).toEqual({ x: 1080, y: 100 });
  });

  it('下端からはみ出す場合は、はみ出さない位置まで内側へ収める', () => {
    // Arrange
    const point = { x: 100, y: 700 };
    const menuSize = { width: 200, height: 150 };
    const viewport = { width: 1280, height: 720 };

    // Act
    const clamped = clampMenuPosition(point, menuSize, viewport);

    // Assert
    expect(clamped).toEqual({ x: 100, y: 570 });
  });

  it('メニューがビューポートより大きいときは、負の位置にせず0に寄せる', () => {
    // Arrange
    const point = { x: 50, y: 50 };
    const menuSize = { width: 2000, height: 1000 };
    const viewport = { width: 1280, height: 720 };

    // Act
    const clamped = clampMenuPosition(point, menuSize, viewport);

    // Assert
    expect(clamped).toEqual({ x: 0, y: 0 });
  });
});
