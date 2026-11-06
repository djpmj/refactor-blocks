import { describe, expect, it } from 'vitest';
import { overlapArea, placeCallout, type Rect } from './calloutPlacement';

const viewport = { width: 1440, height: 900 };
const size = { width: 360, height: 200 };
const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom });
const boxAt = (position: { left: number; top: number }): Rect => rect(position.left, position.top, position.left + size.width, position.top + size.height);

describe('overlapArea', () => {
  it('一部が重なる2矩形は重なった部分の面積', () => {
    // Arrange
    const a = rect(0, 0, 100, 100);
    const b = rect(50, 60, 150, 150);
    // Act
    const area = overlapArea(a, b);
    // Assert
    expect(area).toBe(50 * 40);
  });

  it('一方が他方を含むときは小さい方の面積', () => {
    // Arrange
    const outer = rect(0, 0, 100, 100);
    const inner = rect(10, 10, 30, 40);
    // Act
    const area = overlapArea(outer, inner);
    // Assert
    expect(area).toBe(20 * 30);
  });

  it('辺で接しているだけなら0', () => {
    // Arrange
    const a = rect(0, 0, 100, 100);
    const b = rect(100, 0, 200, 100);
    // Act
    const area = overlapArea(a, b);
    // Assert
    expect(area).toBe(0);
  });

  it('離れていれば0', () => {
    // Arrange
    const a = rect(0, 0, 10, 10);
    const b = rect(50, 50, 60, 60);
    // Act
    const area = overlapArea(a, b);
    // Assert
    expect(area).toBe(0);
  });
});

describe('placeCallout', () => {
  it('小さな対象が画面上部にあれば、対象の下・左揃え', () => {
    // Arrange
    const anchor = rect(100, 50, 300, 100);
    // Act
    const position = placeCallout({ anchor, avoid: [], size, viewport });
    // Assert
    expect(position).toEqual({ left: 100, top: 112 });
  });

  it('対象が画面下端にあり下に入らなければ、対象の上', () => {
    // Arrange
    const anchor = rect(100, 800, 300, 880);
    // Act
    const position = placeCallout({ anchor, avoid: [], size, viewport });
    // Assert
    expect(position).toEqual({ left: 100, top: 800 - 12 - 200 });
  });

  it('対象が画面の高さいっぱいで右に空きがあれば、対象の右で重なり0', () => {
    // Arrange
    const anchor = rect(0, 0, 400, 900);
    // Act
    const position = placeCallout({ anchor, avoid: [], size, viewport });
    // Assert
    expect(position).toEqual({ left: 412, top: 16 });
    expect(overlapArea(boxAt(position), anchor)).toBe(0);
  });

  it('対象の下がavoidに重なるとき、avoidの下に置く(症状c)', () => {
    // Arrange
    const anchor = rect(100, 50, 400, 100);
    const avoid = rect(100, 50, 1300, 200);
    // Act
    const position = placeCallout({ anchor, avoid: [avoid], size, viewport });
    // Assert
    expect(position).toEqual({ left: 100, top: 212 });
    expect(overlapArea(boxAt(position), avoid)).toBe(0);
  });

  it('対象の上がavoidに重なるとき、重なり0の位置に置く(症状a)', () => {
    // Arrange
    const anchor = rect(300, 400, 1000, 880);
    const avoid = rect(300, 100, 1000, 390);
    // Act
    const position = placeCallout({ anchor, avoid: [avoid], size, viewport });
    // Assert
    expect(overlapArea(boxAt(position), avoid)).toBe(0);
    expect(overlapArea(boxAt(position), anchor)).toBe(0);
  });

  it('対象が画面全体で左にavoidがあるとき、avoidと重ならない(症状b)', () => {
    // Arrange
    const anchor = rect(0, 0, 1440, 900);
    const avoid = rect(0, 0, 360, 900);
    // Act
    const position = placeCallout({ anchor, avoid: [avoid], size, viewport });
    // Assert
    expect(overlapArea(boxAt(position), avoid)).toBe(0);
  });

  it('画面右端の対象でも、吹き出しは画面内に収まる', () => {
    // Arrange
    const anchor = rect(1300, 50, 1440, 100);
    // Act
    const position = placeCallout({ anchor, avoid: [], size, viewport });
    // Assert
    expect(position.left).toBe(viewport.width - size.width - 16);
  });

  it('画面が吹き出しより狭いとき、leftは16', () => {
    // Arrange
    const anchor = rect(10, 50, 200, 100);
    // Act
    const position = placeCallout({ anchor, avoid: [], size, viewport: { width: 300, height: 900 } });
    // Assert
    expect(position.left).toBe(16);
  });
});
