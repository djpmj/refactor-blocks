import { describe, expect, it } from 'vitest';
import type { PainSummary } from './changePain';
import { isClearlyRelieved } from './painRelief';

const base: PainSummary = { siteIds: ['a', 'b'], classes: 2, files: 2, readLines: 100, classLines: 40 };

describe('isClearlyRelieved', () => {
  it('直す場所が減ればtrue', () => {
    // Arrange / Act
    const result = isClearlyRelieved(base, { ...base, siteIds: ['a'] });

    // Assert
    expect(result).toBe(true);
  });

  it('場所は同じでクラスが2から1になればtrue', () => {
    // Arrange / Act
    const result = isClearlyRelieved(base, { ...base, classes: 1 });

    // Assert
    expect(result).toBe(true);
  });

  it('場所・クラスは同じでファイルが減ればtrue', () => {
    // Arrange / Act
    const result = isClearlyRelieved(base, { ...base, files: 1 });

    // Assert
    expect(result).toBe(true);
  });

  it('読む行数は100から75でtrue、76でfalse', () => {
    // Arrange / Act
    const at75 = isClearlyRelieved(base, { ...base, readLines: 75 });
    const at76 = isClearlyRelieved(base, { ...base, readLines: 76 });

    // Assert
    expect(at75).toBe(true);
    expect(at76).toBe(false);
  });

  it('クラスの行数が40から22になればtrue', () => {
    // Arrange / Act
    const result = isClearlyRelieved(base, { ...base, classLines: 22 });

    // Assert
    expect(result).toBe(true);
  });

  it('どれも変わらなければfalse', () => {
    // Arrange / Act
    const result = isClearlyRelieved(base, base);

    // Assert
    expect(result).toBe(false);
  });
});
