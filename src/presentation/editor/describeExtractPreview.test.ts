import { describe, expect, it } from 'vitest';
import { describeExtractPreview } from './describeExtractPreview';

describe('describeExtractPreview', () => {
  it('ファイル全体の行数が増える理由を添える', () => {
    // Arrange
    const preview = { sourceMethodId: 'm', sourceLinesBefore: 39, sourceLinesAfter: 34, newMethodName: 'aggregateSales', newMethodLines: 10, fileLinesBefore: 42, fileLinesAfter: 48, classLinesBefore: 42, classLinesAfter: 48 };

    // Act
    const description = describeExtractPreview('printMonthlyReport', preview);

    // Assert
    expect(description).toBe('抽出すると: printMonthlyReport 39行 → 34行 / 新しい aggregateSales 10行(ファイルは +6行: 宣言と呼び出しの分)');
  });

  it('行数が増えない場合は従来の文にする', () => {
    // Arrange
    const preview = { sourceMethodId: 'm', sourceLinesBefore: 10, sourceLinesAfter: 7, newMethodName: 'helper', newMethodLines: 6, fileLinesBefore: 16, fileLinesAfter: 16, classLinesBefore: 16, classLinesAfter: 16 };

    // Act
    const description = describeExtractPreview('run', preview);

    // Assert
    expect(description).toBe('抽出すると: run 10行 → 7行 / 新しい helper 6行');
  });
});
