import { describe, expect, it } from 'vitest';
import { findClass, findClassOfMethod, findFileOfClass } from './Codebase';
import { moveClassToNewFile, moveMethodToNewClass } from './moveToNewHome';
import { sampleCodebase } from './testFixtures';

describe('moveClassToNewFile', () => {
  it('クラス名のパスで新しいファイルを作り(同じパスがあれば連番)、クラスをそこへ移す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClassToNewFile(codebase, 'class-tax', 'new-file');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files).toHaveLength(3);
    expect(findFileOfClass(result.value, 'class-tax')).toEqual({
      id: 'new-file',
      path: 'src/TaxCalculator2.ts',
      classes: [findClass(codebase, 'class-tax')],
    });
    expect(result.value.files[1].classes).toEqual([]);
  });

  it('同じパスがあれば連番を付けて重複させない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const first = moveClassToNewFile(codebase, 'class-tax', 'f1');
    if (!first.ok) throw new Error(first.error);

    // Act
    const second = moveClassToNewFile(first.value, 'class-order', 'f2');

    // Assert
    if (!second.ok) throw new Error(second.error);
    expect(second.value.files.map((file) => file.path)).toEqual([
      'src/OrderService.ts',
      'src/TaxCalculator.ts',
      'src/TaxCalculator2.ts',
      'src/OrderService2.ts',
    ]);
  });

  it('クラスがなければ失敗する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClassToNewFile(codebase, 'missing', 'new-file');

    // Assert
    expect(result).toEqual({ ok: false, error: 'class-not-found' });
  });
});

describe('moveMethodToNewClass', () => {
  it('新しいファイルと新しいクラスを作り、メソッドをそこへ移す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveMethodToNewClass(codebase, 'method-place', { classId: 'new-class', fileId: 'new-file' });

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findClassOfMethod(result.value, 'method-place')?.id).toBe('new-class');
    expect(findFileOfClass(result.value, 'new-class')?.path).toBe('src/NewClass.ts');
    expect(findClass(result.value, 'class-order')?.methods).toEqual([]);
  });

  it('NewClassがすでにあれば連番を付ける', () => {
    // Arrange
    const first = moveMethodToNewClass(sampleCodebase(), 'method-place', { classId: 'c1', fileId: 'f1' });
    if (!first.ok) throw new Error(first.error);

    // Act
    const result = moveMethodToNewClass(first.value, 'method-place', { classId: 'c2', fileId: 'f2' });

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findClass(result.value, 'c2')?.name).toBe('NewClass2');
    expect(findFileOfClass(result.value, 'c2')?.path).toBe('src/NewClass2.ts');
  });

  it('メソッドがなければ失敗する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveMethodToNewClass(codebase, 'missing', { classId: 'c', fileId: 'f' });

    // Assert
    expect(result).toEqual({ ok: false, error: 'method-not-found' });
  });
});
