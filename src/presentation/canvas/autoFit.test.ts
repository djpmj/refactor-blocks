import { describe, expect, it } from 'vitest';
import { shouldRefit, type AutoFitState } from './autoFit';

describe('shouldRefit', () => {
  it('初回は自動で合わせる', () => {
    // Arrange
    const state: AutoFitState = { userMoved: false, lastSize: null };

    // Act
    const result = shouldRefit(state, { width: 800, height: 600 });

    // Assert
    expect(result).toBe(true);
  });

  it('幅が1px以上変わったら合わせる', () => {
    // Arrange
    const state: AutoFitState = { userMoved: false, lastSize: { width: 800, height: 600 } };

    // Act
    const result = shouldRefit(state, { width: 801, height: 600 });

    // Assert
    expect(result).toBe(true);
  });

  it('大きさが同じなら合わせない', () => {
    // Arrange
    const state: AutoFitState = { userMoved: false, lastSize: { width: 800, height: 600 } };

    // Act
    const result = shouldRefit(state, { width: 800, height: 600 });

    // Assert
    expect(result).toBe(false);
  });

  it('プレイヤーが動かしたあとは大きさが変わっても合わせない', () => {
    // Arrange
    const state: AutoFitState = { userMoved: true, lastSize: { width: 800, height: 600 } };

    // Act
    const result = shouldRefit(state, { width: 801, height: 600 });

    // Assert
    expect(result).toBe(false);
  });
});
