import { describe, expect, it } from 'vitest';
import { updateProgress } from './updateProgress';
import type { Progress } from './Progress';

describe('updateProgress', () => {
  it('記録がないステージは、そのままスコアを記録する', () => {
    // Arrange
    const progress: Progress = {};

    // Act
    const next = updateProgress(progress, 'stage-1', 80, 0);

    // Assert
    expect(next).toEqual({ 'stage-1': 80 });
  });

  it('自己ベストより高いスコアなら更新する', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 60 };

    // Act
    const next = updateProgress(progress, 'stage-1', 90, 0);

    // Assert
    expect(next).toEqual({ 'stage-1': 90 });
  });

  it('自己ベスト以下のスコアなら、同じ参照のまま変えない', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 90 };

    // Act
    const next = updateProgress(progress, 'stage-1', 70, 0);

    // Assert
    expect(next).toBe(progress);
  });

  it('自己ベストと同じスコアなら、同じ参照のまま変えない', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 90 };

    // Act
    const next = updateProgress(progress, 'stage-1', 90, 0);

    // Assert
    expect(next).toBe(progress);
  });

  it('他のステージの記録はそのまま残る', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 90, 'stage-2': 50 };

    // Act
    const next = updateProgress(progress, 'stage-2', 100, 0);

    // Assert
    expect(next).toEqual({ 'stage-1': 90, 'stage-2': 100 });
  });

  it('初期点を超えたスコアなら記録する', () => {
    // Arrange
    const progress: Progress = {};

    // Act
    const next = updateProgress(progress, 'stage-1', 60, 30);

    // Assert
    expect(next).toEqual({ 'stage-1': 60 });
  });

  it('初期点と同じスコアなら、記録せず同じ参照を返す', () => {
    // Arrange
    const progress: Progress = {};

    // Act
    const next = updateProgress(progress, 'stage-1', 30, 30);

    // Assert
    expect(next).toBe(progress);
  });

  it('初期点を下回るスコアなら、記録せず同じ参照を返す', () => {
    // Arrange
    const progress: Progress = {};

    // Act
    const next = updateProgress(progress, 'stage-1', 20, 30);

    // Assert
    expect(next).toBe(progress);
  });

  it('自己ベストを下回るスコアなら、初期点を超えていても同じ参照を返す', () => {
    // Arrange
    const progress: Progress = { 'stage-1': 60 };

    // Act
    const next = updateProgress(progress, 'stage-1', 50, 30);

    // Assert
    expect(next).toBe(progress);
  });

  it('初期点が100点でも、100点は記録する', () => {
    // Arrange
    const progress: Progress = {};

    // Act
    const next = updateProgress(progress, 'stage-1', 100, 100);

    // Assert
    expect(next).toEqual({ 'stage-1': 100 });
  });
});
