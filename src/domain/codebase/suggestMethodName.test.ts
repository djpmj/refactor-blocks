import { describe, expect, it } from 'vitest';
import type { Fragment } from './Codebase';
import { suggestMethodName } from './suggestMethodName';

function named(suggestedName?: string): Fragment {
  return { id: suggestedName ?? 'unnamed', label: 'label', lines: 1, responsibility: 'misc', suggestedName };
}

describe('suggestMethodName', () => {
  it('処理を1つ選んだときは、その処理のメソッド名候補をそのまま使う', () => {
    // Arrange
    const fragments = [named('calculateTax')];

    // Act
    const name = suggestMethodName(fragments, []);

    // Assert
    expect(name).toBe('calculateTax');
  });

  it('動詞が同じ処理を複数選んだときは、動詞を1つにまとめて目的語をAndでつなぐ', () => {
    // Arrange
    const fragments = [named('validateItems'), named('validateStock')];

    // Act
    const name = suggestMethodName(fragments, []);

    // Assert
    expect(name).toBe('validateItemsAndStock');
  });

  it('動詞が違う処理を複数選んだときは、メソッド名候補をAndでつなぐ', () => {
    // Arrange
    const fragments = [named('saveOrder'), named('sendConfirmationMail')];

    // Act
    const name = suggestMethodName(fragments, []);

    // Assert
    expect(name).toBe('saveOrderAndSendConfirmationMail');
  });

  it('メソッド名候補を持たない処理は無視し、どれも持たなければ汎用の名前にする', () => {
    // Arrange
    const withCandidate = [named(), named('calculateTax')];
    const withoutCandidate = [named()];

    // Act
    const nameWithCandidate = suggestMethodName(withCandidate, []);
    const nameWithoutCandidate = suggestMethodName(withoutCandidate, []);

    // Assert
    expect(nameWithCandidate).toBe('calculateTax');
    expect(nameWithoutCandidate).toBe('extractedMethod');
  });

  it('同じクラスに同名のメソッドがあるときは、番号を付けて重複を避ける', () => {
    // Arrange
    const fragments = [named('calculateTax')];

    // Act
    const name = suggestMethodName(fragments, ['calculateTax', 'calculateTax2']);

    // Assert
    expect(name).toBe('calculateTax3');
  });

  it('何も選んでいないときは空文字を返す', () => {
    // Arrange & Act
    const name = suggestMethodName([], []);

    // Assert
    expect(name).toBe('');
  });
});
