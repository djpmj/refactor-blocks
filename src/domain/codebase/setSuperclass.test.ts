import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { setSuperclass } from './setSuperclass';
import { sampleCodebase } from './testFixtures';

/** A → B → C の継承チェーンを組めるよう、3クラスを1ファイルに置く。 */
function threeClassCodebase(): Codebase {
  return {
    files: [
      {
        id: 'file-abc',
        path: 'src/abc.ts',
        classes: [
          { id: 'class-a', name: 'A', methods: [] },
          { id: 'class-b', name: 'B', methods: [], superclassId: 'class-a' },
          { id: 'class-c', name: 'C', methods: [], superclassId: 'class-b' },
        ],
      },
    ],
  };
}

describe('setSuperclass', () => {
  it('親クラス名を指定すると、そのクラスのIDがsuperclassIdに入る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    const changed = result.value.files[0].classes[0];
    expect(changed.superclassId).toBe('class-tax');
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    setSuperclass(codebase, 'class-order', 'TaxCalculator');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('nullを指定すると継承を解除する', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-b', null);

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[1].superclassId).toBeUndefined();
  });

  it('空文字を指定しても継承を解除する', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-b', '  ');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[1].superclassId).toBeUndefined();
  });

  it('今と同じ親クラスを指定すると、エラーにせず元のままにする', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-b', 'A');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('継承なしのクラスにnullを指定しても、エラーにせず元のままにする', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-a', null);

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it.each([
    ['存在しないクラスを変更しようとする', 'class-none', 'A', 'class-not-found'],
    ['存在しない名前を親に指定する', 'class-a', 'NoSuchClass', 'superclass-not-found'],
    ['自分自身を親に指定する', 'class-a', 'A', 'self-inheritance'],
    ['直接の循環になる(B→A→Bのところ、AをBの子にする)', 'class-a', 'B', 'inheritance-cycle'],
    ['間接の循環になる(A→B→Cのところ、AをCの子にする)', 'class-a', 'C', 'inheritance-cycle'],
  ])('%sときはエラーになる', (_label, classId, superclassName, expected) => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, classId, superclassName);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});
