import { describe, expect, it } from 'vitest';
import { findMethod, mapClasses, type Codebase } from './Codebase';
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

function makeTaxLogicPublic(codeClass: Codebase['files'][number]['classes'][number]) {
  if (codeClass.id !== 'class-tax-logic') return codeClass;
  const methods = codeClass.methods.map((method) => ({ ...method, visibility: 'public' as const }));
  return { ...codeClass, methods };
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

  it('空実装だけを持つクラスは削除できる', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = { files: [base.files[0], { ...base.files[1], classes: [{ ...base.files[1].classes[0], methods: [{ id: 'method-stub', name: 'stub', visibility: 'public', fragments: [{ id: 'f-stub', label: 'stub', lines: 2, responsibility: 'misc', stub: true }] }] }] }] };
    // Act
    const result = deleteClass(codebase, 'class-tax');
    // Assert
    expect(result.ok).toBe(true);
  });

  it('本物の処理が残るクラスは削除できない', () => {
    // Arrange
    const codebase = sampleCodebase();
    // Act
    const result = deleteClass(codebase, 'class-order');
    // Assert
    expect(result).toEqual({ ok: false, error: 'has-code' });
  });

  it('public にした切り出しメソッドも呼び出し元へ戻してから削除する', () => {
    // Arrange
    const base = extractedIntoOwnClass();
    const codebase = mapClasses(base, makeTaxLogicPublic);
    const snapshot = structuredClone(codebase);
    // Act
    const result = deleteClass(codebase, 'class-tax-logic');
    // Assert
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-place')?.fragments.map((fragment) => fragment.id)).toEqual(['f-validate', 'f-tax', 'f-save']);
    expect(codebase).toEqual(snapshot);
  });

  it('契約メソッドを持つクラスは削除できない', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = { files: [base.files[0], { ...base.files[1], classes: [{ ...base.files[1].classes[0], methods: [{ id: 'contract', name: 'contract', visibility: 'public', fragments: [] }] }] }] };
    // Act
    const result = deleteClass(codebase, 'class-tax');
    // Assert
    expect(result).toEqual({ ok: false, error: 'has-code' });
  });

  it('空実装と本物の処理が混ざるクラスは削除できない', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase: Codebase = { files: [base.files[0], { ...base.files[1], classes: [{ ...base.files[1].classes[0], methods: [base.files[0].classes[0].methods[0], { id: 'stub', name: 'stub', visibility: 'public', fragments: [{ id: 'stub-f', label: 'stub', lines: 1, responsibility: 'misc', stub: true }] }] }] }] };
    // Act
    const result = deleteClass(codebase, 'class-tax');
    // Assert
    expect(result).toEqual({ ok: false, error: 'has-code' });
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

  it('publicな横流しメソッドを持つクラスを削除すると、呼び出し行が呼び先へ付け替わる', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'src/a.ts', classes: [
      { id: 'controller', name: 'Controller', methods: [{ id: 'caller', name: 'place', visibility: 'public', fragments: [{ id: 'manager-call', label: 'Managerへ委譲', lines: 1, responsibility: 'call', uses: ['manager-method'] }] }] },
      { id: 'manager', name: 'Manager', methods: [{ id: 'manager-method', name: 'place', visibility: 'public', fragments: [{ id: 'service-call', label: 'Serviceへ委譲', lines: 1, responsibility: 'call', uses: ['service-method'] }] }] },
      { id: 'service', name: 'Service', methods: [{ id: 'service-method', name: 'place', visibility: 'public', fragments: [{ id: 'business', label: '処理', lines: 5, responsibility: 'business' }] }] },
    ] }] };

    // Act
    const result = deleteClass(codebase, 'manager');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes.map(({ id }) => id)).not.toContain('manager');
    expect(findMethod(result.value, 'caller')?.fragments.map(({ id }) => id)).toEqual(['service-call']);
  });

  it('呼び出し元も削除対象の同じクラスにある場合は処理が残るため削除できない', () => {
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
    expect(result).toEqual({ ok: false, error: 'has-code' });
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
    const codebase: Codebase = { files: [base.files[0], { ...base.files[1], classes: [{ ...base.files[1].classes[0], fields: [] }] }] };

    // Act
    const result = deleteClass(codebase, 'class-tax');

    // Assert
    expect(result.ok).toBe(true);
  });
});
