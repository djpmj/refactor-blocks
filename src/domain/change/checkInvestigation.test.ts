import { describe, expect, it } from 'vitest';
import { checkInvestigation } from './checkInvestigation';

describe('checkInvestigation', () => {
  it('選び漏らしと余計な選択を分けて返す', () => {
    // Arrange
    const selected = ['a', 'c'];
    const sites = ['a', 'b'];

    // Act
    const result = checkInvestigation(selected, sites);

    // Assert
    expect(result).toEqual({ missed: ['b'], extra: ['c'] });
  });

  it('ぴったり選べていれば両方とも空', () => {
    // Arrange / Act
    const result = checkInvestigation(['b', 'a'], ['a', 'b']);

    // Assert
    expect(result).toEqual({ missed: [], extra: [] });
  });
});
