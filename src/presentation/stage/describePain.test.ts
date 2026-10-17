import { describe, expect, it } from 'vitest';
import { describePainTrend, summarizePain } from './describePain';
import type { ChangePain } from '../../domain/change/changePain';

describe('describePainTrend', () => {
  it('直す場所が増えたら途中の状態を説明する', () => {
    // Arrange
    const pain: Pick<ChangePain, 'initial' | 'current'> = { initial: { siteIds: ['a'], readLines: 39, classes: 1, files: 1, classLines: 40 }, current: { siteIds: ['a', 'b'], readLines: 44, classes: 1, files: 1, classLines: 40 } };

    // Act
    const trend = describePainTrend(pain);

    // Assert
    expect(trend).toContain('今は 2 か所に分かれています');
  });

  it('場所が同じでも読む量が増えたら説明する', () => {
    // Arrange
    const pain: Pick<ChangePain, 'initial' | 'current'> = { initial: { siteIds: ['a'], readLines: 39, classes: 1, files: 1, classLines: 40 }, current: { siteIds: ['a'], readLines: 42, classes: 1, files: 1, classLines: 40 } };

    // Act
    const trend = describePainTrend(pain);

    // Assert
    expect(trend).toContain('読む量が少し増えています');
  });

  it('改善後や変化がないときは説明しない', () => {
    // Arrange
    const pain: Pick<ChangePain, 'initial' | 'current'> = { initial: { siteIds: ['a', 'b'], readLines: 80, classes: 1, files: 1, classLines: 40 }, current: { siteIds: ['a'], readLines: 20, classes: 1, files: 1, classLines: 40 } };

    // Act
    const trend = describePainTrend(pain);

    // Assert
    expect(trend).toBeUndefined();
    expect(describePainTrend({ ...pain, current: pain.initial })).toBeUndefined();
  });
});

describe('summarizePain', () => {
  it('修正箇所と読む行数を要約する', () => {
    // Arrange
    const pain = { siteIds: ['a', 'b'], readLines: 84 };

    // Act
    const summary = summarizePain(pain, undefined);

    // Assert
    expect(summary).toBe('2か所・84行を読む');
  });

  it('追加だけなら既存クラスの変更数を要約する', () => {
    // Arrange
    const extended = { currentModified: ['a', 'b'] };

    // Act
    const summary = summarizePain(undefined, extended);

    // Assert
    expect(summary).toBe('既存の2クラスを書き換える');
    expect(summarizePain(undefined, { currentModified: [] })).toBe('新しいクラスを足すだけ');
  });
});
