import { describe, expect, it } from 'vitest';
import { summarizePain } from './describePain';

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
