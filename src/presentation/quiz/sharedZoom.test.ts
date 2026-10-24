import { describe, expect, it } from 'vitest';
import { sharedZoom } from './sharedZoom';

describe('sharedZoom', () => {
  it('小さい方が下限を下回るときは下限にする', () => {
    // Arrange
    const [zoomA, zoomB, floor] = [1.0, 0.5, 0.6];

    // Act
    const zoom = sharedZoom(zoomA, zoomB, floor);

    // Assert
    expect(zoom).toBeCloseTo(0.6, 5);
  });

  it('下限以上なら小さい方にそろえる', () => {
    // Arrange
    const [zoomA, zoomB, floor] = [0.9, 0.8, 0.6];

    // Act
    const zoom = sharedZoom(zoomA, zoomB, floor);

    // Assert
    expect(zoom).toBeCloseTo(0.8, 5);
  });

  it('2つが同じ縮尺ならそのまま使う', () => {
    // Arrange
    const [zoomA, zoomB, floor] = [0.7, 0.7, 0.6];

    // Act
    const zoom = sharedZoom(zoomA, zoomB, floor);

    // Assert
    expect(zoom).toBeCloseTo(0.7, 5);
  });
});
