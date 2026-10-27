import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAssists, saveAssists } from './assistStorage';

const KEY = 'refactor-blocks:assists';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('assistStorage', () => {
  it('キーが無ければ空', () => {
    // Act & Assert
    expect(loadAssists()).toEqual({});
  });

  it.each(['{', '[]', 'null', '3'])('壊れた値 %s は空として読む', (raw) => {
    // Arrange
    localStorage.setItem(KEY, raw);

    // Act & Assert
    expect(loadAssists()).toEqual({});
  });

  it('不正なエントリだけ捨てる', () => {
    // Arrange
    localStorage.setItem(KEY, JSON.stringify({ a: { attempt: 'answer' }, b: { attempt: 'hint' }, c: 3 }));

    // Act & Assert
    expect(loadAssists()).toEqual({ a: { attempt: 'answer' } });
  });

  it('保存した値を読み込める', () => {
    // Arrange
    const assists = { a: { attempt: 'answer', clearedWith: 'ghost' } } as const;
    saveAssists(assists);

    // Act & Assert
    expect(loadAssists()).toEqual(assists);
  });

  it('localStorage が例外を投げても load は空、save は何も起きない', () => {
    // Arrange
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });

    // Act & Assert
    expect(loadAssists()).toEqual({});
    expect(() => { saveAssists({}); }).not.toThrow();
  });
});
