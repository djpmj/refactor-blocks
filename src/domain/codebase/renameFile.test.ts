import { describe, expect, it } from 'vitest';
import { renameFile } from './renameFile';
import { sampleCodebase } from './testFixtures';

describe('renameFile', () => {
  it('前後の空白を除いたパスに変わり、クラスはそのまま残る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameFile(codebase, 'file-order', ' src/order/OrderService.ts ');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].path).toBe('src/order/OrderService.ts');
    expect(result.value.files[0].classes).toEqual(codebase.files[0].classes);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    renameFile(codebase, 'file-order', 'src/a.ts');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('同じパスへの変更は、エラーにせず元のままにする', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameFile(codebase, 'file-order', 'src/OrderService.ts');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it.each([
    ['パスが空白だけ', 'file-order', '  ', 'empty-path'],
    ['別のファイルと同じパス', 'file-order', 'src/TaxCalculator.ts', 'duplicate-path'],
    ['存在しないファイル', 'file-none', 'src/a.ts', 'file-not-found'],
  ])('%sのときはエラーになる', (_label, fileId, path, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameFile(codebase, fileId, path);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});
