import { describe, expect, it } from 'vitest';
import { autoViewport } from './autoViewport';

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
