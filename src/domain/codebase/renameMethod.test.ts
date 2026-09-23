import { describe, expect, it } from 'vitest';
import { renameMethod } from './renameMethod';
import { sampleCodebase } from './testFixtures';

describe('renameMethod', () => {
  it('前後の空白を除いた名前に変わり、処理(fragments)はそのまま残る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameMethod(codebase, 'method-place', ' placeNewOrder ');

    // Assert
    if (!result.ok) throw new Error(result.error);
    const renamed = result.value.files[0].classes[0].methods[0];
    expect(renamed.name).toBe('placeNewOrder');
    expect(renamed.fragments).toEqual(codebase.files[0].classes[0].methods[0].fragments);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    renameMethod(codebase, 'method-place', 'placeNewOrder');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('同じ名前への変更は、エラーにせず元のままにする', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameMethod(codebase, 'method-place', 'placeOrder');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('同じクラスに同名メソッドがあるときはエラーになる', () => {
    // Arrange
    const base = sampleCodebase();
    const orderClass = base.files[0].classes[0];
    const codebase = {
      files: [
        { ...base.files[0], classes: [{ ...orderClass, methods: [...orderClass.methods, { ...orderClass.methods[0], id: 'method-other', name: 'shipOrder' }] }] },
        base.files[1],
      ],
    };

    // Act
    const result = renameMethod(codebase, 'method-place', 'shipOrder');

    // Assert
    expect(result).toEqual({ ok: false, error: 'duplicate-method-name' });
  });

  it('別のクラスに同名メソッドがあっても、重複扱いにしない', () => {
    // Arrange
    const base = sampleCodebase();
    const taxClass = base.files[1].classes[0];
    const codebase = {
      files: [base.files[0], { ...base.files[1], classes: [{ ...taxClass, methods: [{ ...base.files[0].classes[0].methods[0], id: 'method-other', name: 'taxHelper' }] }] }],
    };

    // Act
    const result = renameMethod(codebase, 'method-place', 'taxHelper');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].methods[0].name).toBe('taxHelper');
  });

  it.each([
    ['名前が空白だけ', 'method-place', '  ', 'empty-method-name'],
    ['存在しないメソッド', 'method-none', 'shipOrder', 'method-not-found'],
  ])('%sのときはエラーになる', (_label, methodId, name, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameMethod(codebase, methodId, name);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});
