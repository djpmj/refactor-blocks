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

  it('本物の処理を持つクラスがあるファイルは削除できない', () => {
    // Arrange
    const codebase = sampleCodebase();
    // Act
    const result = deleteFile(codebase, 'file-order');
    // Assert
    expect(result).toEqual({ ok: false, error: 'has-code' });
  });

  it('public にした切り出しメソッドがあるファイルも呼び出し元へ戻して削除する', () => {
    // Arrange
    const extracted = extractMethod(sampleCodebase(), {
      sourceMethodId: 'method-place', fragmentIds: ['f-tax'], newMethodId: 'method-tax', newMethodName: 'calculateTax',
    });
    if (!extracted.ok) throw new Error(extracted.error);
    const [orderFile, taxFile] = extracted.value.files;
    const [orderClass] = orderFile.classes;
    const [placeMethod, taxMethod] = orderClass.methods;
    const codebase: Codebase = {
      files: [
        { ...orderFile, classes: [{ ...orderClass, methods: [placeMethod] }] },
        { ...taxFile, classes: [...taxFile.classes, { id: 'class-tax-logic', name: 'TaxLogic', methods: [{ ...taxMethod, visibility: 'public' }] }] },
      ],
    };
    const snapshot = structuredClone(codebase);
    // Act
    const result = deleteFile(codebase, 'file-tax');
    // Assert
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files).toHaveLength(1);
    expect(findMethod(result.value, 'method-place')?.fragments.map(({ id }) => id)).toEqual(['f-validate', 'f-tax', 'f-save']);
    expect(codebase).toEqual(snapshot);
  });

  it('空実装だけを持つクラスがあるファイルは削除できる', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = { files: [base.files[0], { ...base.files[1], classes: [{ ...base.files[1].classes[0], methods: [{ id: 'stub', name: 'stub', visibility: 'public', fragments: [{ id: 'stub-f', label: 'stub', lines: 1, responsibility: 'misc', stub: true }] }] }] }] };
    // Act
    const result = deleteFile(codebase, 'file-tax');
    // Assert
    expect(result.ok).toBe(true);
  });

  it('ファイル内の2つ目のクラスに処理があれば削除できない', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = { files: [{ ...base.files[1], classes: [base.files[1].classes[0], { id: 'class-extra', name: 'Extra', methods: base.files[0].classes[0].methods }] }, base.files[0]] };
    // Act
    const result = deleteFile(codebase, 'file-tax');
    // Assert
    expect(result).toEqual({ ok: false, error: 'has-code' });
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

  it('publicな横流しメソッドを含むファイルを削除すると、呼び出し行が呼び先へ付け替わる', () => {
    // Arrange
    const codebase: Codebase = { files: [
      { id: 'controller-file', path: 'src/Controller.ts', classes: [{ id: 'controller', name: 'Controller', methods: [{ id: 'caller', name: 'place', visibility: 'public', fragments: [{ id: 'manager-call', label: 'Managerへ委譲', lines: 1, responsibility: 'call', uses: ['manager-method'] }] }] }] },
      { id: 'manager-file', path: 'src/Manager.ts', classes: [{ id: 'manager', name: 'Manager', methods: [{ id: 'manager-method', name: 'place', visibility: 'public', fragments: [{ id: 'service-call', label: 'Serviceへ委譲', lines: 1, responsibility: 'call', uses: ['service-method'] }] }] }] },
      { id: 'service-file', path: 'src/Service.ts', classes: [{ id: 'service', name: 'Service', methods: [{ id: 'service-method', name: 'place', visibility: 'public', fragments: [{ id: 'business', label: '処理', lines: 5, responsibility: 'business' }] }] }] },
    ] };

    // Act
    const result = deleteFile(codebase, 'manager-file');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files.map(({ id }) => id)).toEqual(['controller-file', 'service-file']);
    expect(findMethod(result.value, 'caller')?.fragments.map(({ id }) => id)).toEqual(['service-call']);
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

  it('フィールドを持つクラスを含むファイルは削除できない', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = {
      files: [
        { ...base.files[0], classes: [{ ...base.files[0].classes[0], fields: [{ id: 'field-status', name: 'status', visibility: 'public' }] }] },
        base.files[1],
      ],
    };

    // Act
    const result = deleteFile(codebase, 'file-order');

    // Assert
    expect(result).toEqual({ ok: false, error: 'has-fields' });
  });
});
