import { describe, expect, it } from 'vitest';
import { describeGrowthHeadsUp } from './describeGrowthHeadsUp';

const limits = { method: 28, class: 54, file: 61 };
const base = { sourceMethodId: 'm', sourceLinesBefore: 20, sourceLinesAfter: 15, newMethodName: 'helper', newMethodLines: 8 };

describe('describeGrowthHeadsUp', () => {
  const cases: [number, number, number, number, string | undefined][] = [
    [54, 60, 54, 60, 'クラスが 54行 → 60行 になり、上限(54行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう'],
    [40, 46, 58, 64, 'ファイルが 58行 → 64行 になり、上限(61行)を超えます。分けたメソッドは、次の段階で受け皿のクラス(別のファイル)へ移しましょう'],
    [50, 56, 58, 64, 'クラスが 50行 → 56行 になり、上限(54行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう'],
    [48, 54, 48, 54, undefined],
    [60, 66, 50, 56, undefined],
    [60, 66, 58, 66, 'ファイルが 58行 → 66行 になり、上限(61行)を超えます。分けたメソッドは、次の段階で受け皿のクラス(別のファイル)へ移しましょう'],
    [30, 30, 40, 40, undefined],
  ];
  it.each(cases.map(([classLinesBefore, classLinesAfter, fileLinesBefore, fileLinesAfter, expected]) => ({ classLinesBefore, classLinesAfter, fileLinesBefore, fileLinesAfter, expected })))('class $classLinesBefore → $classLinesAfter, file $fileLinesBefore → $fileLinesAfter', ({ classLinesBefore, classLinesAfter, fileLinesBefore, fileLinesAfter, expected }) => {
    // Arrange
    const preview = { ...base, classLinesBefore, classLinesAfter, fileLinesBefore, fileLinesAfter };
    const before = structuredClone(preview);
    // Act
    const result = describeGrowthHeadsUp(preview, limits);
    // Assert
    expect(result).toBe(expected);
    expect(preview).toEqual(before);
  });
});
