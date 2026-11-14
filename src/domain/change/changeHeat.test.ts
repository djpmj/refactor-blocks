import { describe, expect, it } from 'vitest';
import type { CodeClass } from '../codebase/Codebase';
import { classChangeCount } from './changeHeat';

describe('classChangeCount', () => {
  const codeClass: CodeClass = { id: 'class', name: 'Sample', methods: [
    { id: 'a', name: 'a', visibility: 'public', fragments: [] },
    { id: 'b', name: 'b', visibility: 'public', fragments: [] },
  ] };

  it.each([
    [[], 0],
    [[['a']], 1],
    [[['a', 'b']], 1],
    [[['a'], ['other'], ['b']], 2],
    [[['other']], 0],
  ])('counts requests touching the class', (siteLists, expected) => {
    // Arrange
    const sites = siteLists;
    // Act
    const count = classChangeCount(codeClass, sites);
    // Assert
    expect(count).toBe(expected);
  });

  it('returns zero for a class without methods', () => {
    // Arrange
    const emptyClass: CodeClass = { id: 'empty', name: 'Empty', methods: [] };
    // Act
    const count = classChangeCount(emptyClass, [['a']]);
    // Assert
    expect(count).toBe(0);
  });
});
