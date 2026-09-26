import { describe, expect, it } from 'vitest';
import { findMethod, type Codebase } from './Codebase';
import { deleteClass } from './deleteClass';
import { extractMethod } from './extractMethod';
import { sampleCodebase } from './testFixtures';

/** placeOrderからf-taxをcalculateTax(method-tax)として抽出し、別ファイルの別クラス(class-tax-logic)に移したCodebase。 */
function extractedIntoOwnClass(): Codebase {
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
  return {
    files: [
      { ...orderFile, classes: [{ ...orderClass, methods: [placeMethod] }] },
      { ...taxFile, classes: [...taxFile.classes, { id: 'class-tax-logic', name: 'TaxLogic', methods: [taxMethod] }] },
    ],
  };
}

describe('deleteClass', () => {
  it('関係のないクラスは、そのまま消える', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = deleteClass(codebase, 'class-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes).toEqual([]);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    deleteClass(codebase, 'class-tax');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('切り出したメソッドを含むクラスを削除すると、呼び出し元の元のメソッドに処理が戻ってから消える', () => {
    // Arrange
    const codebase = extractedIntoOwnClass();

    // Act
    const result = deleteClass(codebase, 'class-tax-logic');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-tax')).toBeUndefined();
    expect(findMethod(result.value, 'method-place')?.fragments.map((fragment) => fragment.id)).toEqual([
      'f-validate',
      'f-tax',
      'f-save',
    ]);
    expect(result.value.files[1].classes.some((codeClass) => codeClass.id === 'class-tax-logic')).toBe(false);
  });

  it('呼び出し元も削除対象の同じクラスにある場合は、戻さずそのまま消える', () => {
    // Arrange
    const extracted = extractMethod(sampleCodebase(), {
      sourceMethodId: 'method-place',
      fragmentIds: ['f-tax'],
      newMethodId: 'method-tax',
      newMethodName: 'calculateTax',
    });
    if (!extracted.ok) throw new Error(extracted.error);

    // Act
    const result = deleteClass(extracted.value, 'class-order');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes).toEqual([]);
  });

  it('存在しないクラスを指定するとエラーになる', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = deleteClass(codebase, 'class-none');

    // Assert
    expect(result).toEqual({ ok: false, error: 'class-not-found' });
  });

  it('フィールドを持つクラスは削除できない', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = {
      files: [
        { ...base.files[0], classes: [{ ...base.files[0].classes[0], fields: [{ id: 'field-status', name: 'status', visibility: 'public' }] }] },
        base.files[1],
      ],
    };

    // Act
    const result = deleteClass(codebase, 'class-order');

    // Assert
    expect(result).toEqual({ ok: false, error: 'has-fields' });
  });

  it('フィールドを移し終えたクラス(fieldsが空配列)は削除できる', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = {
      files: [{ ...base.files[0], classes: [{ ...base.files[0].classes[0], fields: [] }] }, base.files[1]],
    };

    // Act
    const result = deleteClass(codebase, 'class-order');

    // Assert
    expect(result.ok).toBe(true);
  });
});
