import { describe, expect, it } from 'vitest';
import { addClass } from './addClass';
import { sampleCodebase } from './testFixtures';

describe('addClass', () => {
  it('指定したファイルの末尾にメソッドが空のクラスが追加される', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = addClass(codebase, 'file-tax', ' TaxRateTable ', 'class-rate');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes).toEqual([
      { id: 'class-tax', name: 'TaxCalculator', methods: [] },
      { id: 'class-rate', name: 'TaxRateTable', methods: [] },
    ]);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    addClass(codebase, 'file-tax', 'TaxRateTable', 'class-rate');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it.each([
    ['存在しないファイル', 'missing', 'TaxRateTable', 'file-not-found'],
    ['名前が空白だけ', 'file-tax', '  ', 'empty-class-name'],
    ['別のファイルに同名クラスがある', 'file-tax', 'OrderService', 'duplicate-class-name'],
  ])('%sのときはエラーになる', (_label, fileId, className, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = addClass(codebase, fileId, className, 'class-new');

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});
