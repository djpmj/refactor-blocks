import { describe, expect, it } from 'vitest';
import { findMethod, type Codebase } from './Codebase';
import { deleteFile } from './deleteFile';
import { extractMethod } from './extractMethod';
import { sampleCodebase } from './testFixtures';

describe('deleteFile', () => {
  it('ファイルを削除すると、そのファイルだけが消える', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = deleteFile(codebase, 'file-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files.map((file) => file.id)).toEqual(['file-order']);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    deleteFile(codebase, 'file-tax');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('切り出したメソッドを含むクラスがあるファイルを削除すると、呼び出し元に処理が戻ってから消える', () => {
    // Arrange: 呼び出し元(file-order)とは別のfile-taxに、抽出したメソッドを持つクラスを置く
    const extracted = extractMethod(sampleCodebase(), {
      sourceMethodId: 'method-place',
      fragmentIds: ['f-tax'],
      newMethodId: 'method-tax',
      newMethodName: 'calculateTax',
    });
    if (!extracted.ok) throw new Error(extracted.error);
    const [orderFile, taxFile] = extracted.value.files;
    const [orderClass] = orderFile.classes;
    const [placeMethod, taxMethod] = orderClass.methods;
    const codebase: Codebase = {
      files: [
        { ...orderFile, classes: [{ ...orderClass, methods: [placeMethod] }] },
        { ...taxFile, classes: [...taxFile.classes, { id: 'class-tax-logic', name: 'TaxLogic', methods: [taxMethod] }] },
      ],
    };

    // Act
    const result = deleteFile(codebase, 'file-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files.map((file) => file.id)).toEqual(['file-order']);
    expect(findMethod(result.value, 'method-place')?.fragments.map((fragment) => fragment.id)).toEqual([
      'f-validate',
      'f-tax',
      'f-save',
    ]);
  });

  it('存在しないファイルを指定するとエラーになる', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = deleteFile(codebase, 'file-none');

    // Assert
    expect(result).toEqual({ ok: false, error: 'file-not-found' });
  });

  it('最後の1ファイルは削除できない', () => {
    // Arrange
    const codebase: Codebase = { files: [sampleCodebase().files[0]] };

    // Act
    const result = deleteFile(codebase, 'file-order');

    // Assert
    expect(result).toEqual({ ok: false, error: 'last-file' });
  });
});
