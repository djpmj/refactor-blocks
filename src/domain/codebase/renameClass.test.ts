import { describe, expect, it } from 'vitest';
import { renameClass } from './renameClass';
import { sampleCodebase } from './testFixtures';

describe('renameClass', () => {
  it('前後の空白を除いた名前に変わり、メソッドはそのまま残る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameClass(codebase, 'class-order', ' OrderUseCase ');

    // Assert
    if (!result.ok) throw new Error(result.error);
    const renamed = result.value.files[0].classes[0];
    expect(renamed.name).toBe('OrderUseCase');
    expect(renamed.methods).toEqual(codebase.files[0].classes[0].methods);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    renameClass(codebase, 'class-order', 'OrderUseCase');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('同じ名前への変更は、エラーにせず元のままにする', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameClass(codebase, 'class-order', 'OrderService');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it.each([
    ['名前が空白だけ', 'class-order', '  ', 'empty-class-name'],
    ['別のクラスと同じ名前', 'class-order', 'TaxCalculator', 'duplicate-class-name'],
    ['存在しないクラス', 'class-none', 'Foo', 'class-not-found'],
  ])('%sのときはエラーになる', (_label, classId, name, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameClass(codebase, classId, name);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});
