import { describe, expect, it } from 'vitest';
import { updateProgress } from './updateProgress';
import type { Progress } from './Progress';

describe('updateProgress', () => {
  it('記録がないステージは、そのままスコアを記録する', () => {
    // Arrange
    const progress: Progress = {};

    // Act
    const next = updateProgress(progress, 'stage-1', 80);

    // Assert
    expect(next).toEqual({ 'stage-1': 80 });
  });

  it('自己ベストより高いスコアなら更新する', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 60 };

    // Act
    const next = updateProgress(progress, 'stage-1', 90);

    // Assert
    expect(next).toEqual({ 'stage-1': 90 });
  });

  it('自己ベスト以下のスコアなら、同じ参照のまま変えない', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 90 };

    // Act
    const next = updateProgress(progress, 'stage-1', 70);

    // Assert
    expect(next).toBe(progress);
  });

  it('自己ベストと同じスコアなら、同じ参照のまま変えない', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 90 };

    // Act
    const next = updateProgress(progress, 'stage-1', 90);

    // Assert
    expect(next).toBe(progress);
  });

  it('他のステージの記録はそのまま残る', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 90, 'stage-2': 50 };

    // Act
    const next = updateProgress(progress, 'stage-2', 100);

    // Assert
    expect(next).toEqual({ 'stage-1': 90, 'stage-2': 100 });
  });
});
