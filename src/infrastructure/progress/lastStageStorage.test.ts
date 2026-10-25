import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLastStageId, saveLastStageId } from './lastStageStorage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('lastStageStorage', () => {
  it('保存したIDを読み込める', () => {
    // Arrange
    saveLastStageId('stage-2');

    // Act
    const loaded = loadLastStageId();

    // Assert
    expect(loaded).toBe('stage-2');
  });

  it('何も保存されていないときは undefined', () => {
    // Act & Assert
    expect(loadLastStageId()).toBeUndefined();
  });

  it('空文字は保存なしとして扱う', () => {
    // Arrange
    localStorage.setItem('refactor-blocks:last-stage', '');

    // Act & Assert
    expect(loadLastStageId()).toBeUndefined();
  });

  it('localStorage が例外を投げても load は undefined、save は何も起きない', () => {
    // Arrange
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });

    // Act & Assert
    expect(loadLastStageId()).toBeUndefined();
    expect(() => { saveLastStageId('stage-2'); }).not.toThrow();
  });
});
