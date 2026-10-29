import { describe, expect, it } from 'vitest';
import { isReflectionNotes, updateReflectionNote } from './reflectionNotes';

describe('updateReflectionNote', () => {
  it('ステージごとに保存し、前後の空白だけを除く', () => {
    // Arrange
    const original = { other: '前のメモ' };

    // Act
    const next = updateReflectionNote(original, 'a', '  責務ごとに分ける\nと変更が楽  ');

    // Assert
    expect(next).toEqual({ other: '前のメモ', a: '責務ごとに分ける\nと変更が楽' });
    expect(original).toEqual({ other: '前のメモ' });
  });

  it('空白だけなら削除し、変更がなければ同じ参照を返す', () => {
    // Arrange
    const original = { a: 'メモ', other: '保持' };

    // Act・Assert
    expect(updateReflectionNote(original, 'a', ' メモ ')).toBe(original);
    expect(updateReflectionNote(original, 'a', ' \n ')).toEqual({ other: '保持' });
    expect(updateReflectionNote(original, 'missing', '')).toBe(original);
  });

  it('140字を上限にする', () => {
    // Arrange・Act・Assert
    expect(updateReflectionNote({}, 'a', 'x'.repeat(141)).a).toBe('x'.repeat(140));
    expect(updateReflectionNote({}, 'a', 'x'.repeat(140)).a).toBe('x'.repeat(140));
  });
});

describe('isReflectionNotes', () => {
  it('文字列キーと1〜140字の値を検証する', () => {
    // Arrange・Act・Assert
    expect(isReflectionNotes({})).toBe(true);
    expect(isReflectionNotes({ a: 'x' })).toBe(true);
    for (const value of [null, [], 'x', { a: 1 }, { a: '' }, { a: 'x'.repeat(141) }]) {
      expect(isReflectionNotes(value)).toBe(false);
    }
  });
});
