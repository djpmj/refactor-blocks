import { describe, expect, it } from 'vitest';
import { responsibilityBreakdown, responsibilityLabel } from './responsibilityLabel';

describe('responsibilityLabel', () => {
  it.each([
    [0, '集計', 'A 集計'],
    [2, '出力', 'C 出力'],
    [26, '割引', 'AA 割引'],
    [1, undefined, 'B'],
    [1, '', 'B'],
  ])('番号 %i と名前 %s から %s を作る', (number, name, expected) => {
    // Arrange / Act
    const label = responsibilityLabel(number, name);

    // Assert
    expect(label).toBe(expected);
  });
});

describe('responsibilityBreakdown', () => {
  const names = { aggregation: '集計', formatting: '表の組み立て', output: '出力' };
  const marks = new Map([['aggregation', 0], ['formatting', 1], ['output', 2]]);

  it('責務の順に「英字 名前」を・でつなぐ', () => {
    // Arrange / Act
    const text = responsibilityBreakdown(['aggregation', 'formatting', 'output'], marks, names);

    // Assert
    expect(text).toBe('A 集計・B 表の組み立て・C 出力');
  });

  it('印の番号順には並べ替えない', () => {
    // Arrange / Act
    const text = responsibilityBreakdown(['output', 'aggregation'], marks, names);

    // Assert
    expect(text).toBe('C 出力・A 集計');
  });

  it('名前が無い責務は英字だけにする', () => {
    // Arrange / Act
    const text = responsibilityBreakdown(['aggregation', 'formatting'], marks, { aggregation: '集計' });

    // Assert
    expect(text).toBe('A 集計・B');
  });

  it('印の番号が無い責務は 0 として扱う', () => {
    // Arrange / Act
    const text = responsibilityBreakdown(['unknown'], new Map(), {});

    // Assert
    expect(text).toBe('A');
  });

  it('空配列は空文字', () => {
    // Arrange / Act
    const text = responsibilityBreakdown([], marks, names);

    // Assert
    expect(text).toBe('');
  });

  it('責務IDが Object.prototype のキーでも名前として拾わない', () => {
    // Arrange / Act
    const text = responsibilityBreakdown(['toString'], new Map([['toString', 0]]), {});

    // Assert
    expect(text).toBe('A');
  });
});
