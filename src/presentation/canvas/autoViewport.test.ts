import { describe, expect, it } from 'vitest';
import { autoViewport, revealInViewport } from './autoViewport';

const options = { minZoom: 0.6, maxZoom: 2, padding: 0.1 };

describe('autoViewport', () => {
  it('小さな図は全体を収める倍率で中央に置く', () => {
    // Arrange
    const bounds = { x: 0, y: 0, width: 400, height: 200 };
    const size = { width: 1000, height: 1000 };
    // Act
    const viewport = autoViewport(bounds, size, { ...options, padding: 0 });
    // Assert
    expect(viewport.zoom).toBe(2);
    expect(viewport.x).toBe(100);
    expect(viewport.y).toBe(300);
  });

  it('大きな図は倍率を minZoom にして、左上を padding の位置に置く', () => {
    // Arrange
    const bounds = { x: 50, y: 20, width: 2000, height: 1000 };
    const size = { width: 700, height: 500 };
    // Act
    const viewport = autoViewport(bounds, size, options);
    // Assert
    expect(viewport.zoom).toBeCloseTo(0.6);
    expect(bounds.x * viewport.zoom + viewport.x).toBeCloseTo(50);
    expect(bounds.y * viewport.zoom + viewport.y).toBeCloseTo(50);
  });

  it('全体を収める倍率が maxZoom を超えるときは maxZoom にする', () => {
    // Arrange
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    // Act
    const viewport = autoViewport(bounds, { width: 1000, height: 1000 }, { ...options, padding: 0 });
    // Assert
    expect(viewport.zoom).toBe(2);
  });

  it('全体を収める倍率がちょうど minZoom のときは全体を中央に収める', () => {
    // Arrange
    const bounds = { x: 0, y: 0, width: 1000, height: 500 };
    const size = { width: 600, height: 600 };
    // Act
    const viewport = autoViewport(bounds, size, { ...options, padding: 0 });
    // Assert
    expect(viewport.zoom).toBeCloseTo(0.6);
    expect(viewport.x).toBeCloseTo(0);
    expect(viewport.y).toBeCloseTo(150);
  });
});

describe('revealInViewport', () => {
  const size = { width: 600, height: 600 };
  const margin = 24;

  it('箱が収まっているなら viewport をそのまま返す', () => {
    // Arrange
    const viewport = { x: 10, y: 10, zoom: 0.6 };
    const box = { x: 0, y: 0, width: 200, height: 200 };
    // Act
    const result = revealInViewport(viewport, box, size, margin);
    // Assert
    expect(result).toEqual(viewport);
  });

  it('箱が右にはみ出すなら、x だけ はみ出し量+margin 左へ動かす', () => {
    // Arrange
    const viewport = { x: 0, y: 0, zoom: 0.6 };
    const wide = { x: 800, y: 0, width: 250, height: 100 }; // 画面上 480〜630 → 30px はみ出す
    // Act
    const result = revealInViewport(viewport, wide, size, margin);
    // Assert
    expect(result).toEqual({ x: -(30 + margin), y: 0, zoom: 0.6 });
  });

  it('箱が下にはみ出すなら、y だけ負の向きに動く', () => {
    // Arrange
    const viewport = { x: 0, y: 0, zoom: 0.5 };
    const box = { x: 0, y: 1100, width: 200, height: 200 }; // 画面上 550〜650 で下に 50px はみ出す
    // Act
    const result = revealInViewport(viewport, box, size, margin);
    // Assert
    expect(result.x).toBe(0);
    expect(result.y).toBe(-(50 + margin));
    expect(result.zoom).toBe(0.5);
  });

  it('箱がキャンバスより横に大きいなら、左端を margin の位置に置く', () => {
    // Arrange
    const viewport = { x: 100, y: 0, zoom: 1 };
    const box = { x: 0, y: 0, width: 700, height: 100 };
    // Act
    const result = revealInViewport(viewport, box, size, margin);
    // Assert
    expect(result.x).toBe(margin);
  });
});
