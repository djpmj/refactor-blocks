import { describe, expect, it } from 'vitest';
import type { Method } from '../../domain/codebase/Codebase';
import { extractDisabledReason, extractNameInvalid } from './extractDisabledReason';

const fragment = (id: string) => ({ id, label: id, lines: 1, responsibility: 'r' });
const method: Method = { id: 'm', name: 'printMonthlyReport', visibility: 'public', fragments: [fragment('a'), fragment('b'), fragment('c')] };
const existing = ['printMonthlyReport', 'aggregateSales'];

describe('extractDisabledReason', () => {
  it('選択なしなら選ぶよう促す', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(), 'newName', existing);

    // Assert
    expect(reason).toBe('処理を1つ以上選ぶと押せます');
  });

  it('名前が空なら名前を促す', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(['a']), '  ', existing);

    // Assert
    expect(reason).toBe('メソッド名を入れると押せます');
  });

  it('離れた処理は連続させるよう促す', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(['a', 'c']), 'newName', existing);

    // Assert
    expect(reason).toContain('連続させてください');
  });

  it('名前が既存の名前と同じなら重複を伝える', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(['a']), 'aggregateSales', existing);

    // Assert
    expect(reason).toBe('同じクラスに「aggregateSales」というメソッドがあります。別の名前にしてください');
  });

  it('抽出元メソッド自身の名前も重複として扱う', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(['a']), 'printMonthlyReport', existing);

    // Assert
    expect(reason).toBe('同じクラスに「printMonthlyReport」というメソッドがあります。別の名前にしてください');
  });

  it('前後の空白は trim して重複と判定する', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(['a']), ' aggregateSales ', existing);

    // Assert
    expect(reason).toBe('同じクラスに「aggregateSales」というメソッドがあります。別の名前にしてください');
  });

  it('重複していない名前なら null', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(['a']), 'newName', existing);

    // Assert
    expect(reason).toBeNull();
  });

  it('選択なしかつ重複なら選択なしの文を優先する', () => {
    // Act
    const reason = extractDisabledReason(method, new Set(), 'aggregateSales', existing);

    // Assert
    expect(reason).toBe('処理を1つ以上選ぶと押せます');
  });
});

/** 選択(連続/非連続/空)× 名前(空/重複/正常)の各組み合わせで、表示する理由と aria-invalid が一致する */
describe('extractNameInvalid(理由と aria-invalid の一致)', () => {
  const NON_CONTIGUOUS = new Set(['a', 'c']);
  const cases: ReadonlyArray<readonly [string, ReadonlySet<string>, string, boolean]> = [
    ['選択なし × 空', new Set(), '', false],
    ['選択なし × 重複', new Set(), 'aggregateSales', false],
    ['選択なし × 正常', new Set(), 'newName', false],
    ['連続 × 空', new Set(['a']), '', false],
    ['連続 × 重複', new Set(['a']), 'aggregateSales', true],
    ['連続 × 正常', new Set(['a']), 'newName', false],
    ['非連続 × 空', NON_CONTIGUOUS, '', false],
    ['非連続 × 重複', NON_CONTIGUOUS, 'aggregateSales', false],
    ['非連続 × 正常', NON_CONTIGUOUS, 'newName', false],
  ];

  it.each(cases)('%s', (_label, selected, name, expected) => {
    // Act
    const invalid = extractNameInvalid(method, selected, name, existing);

    // Assert
    expect(invalid).toBe(expected);
    expect(invalid).toBe(extractDisabledReason(method, selected, name, existing)?.startsWith('同じクラスに') ?? false);
  });
});
