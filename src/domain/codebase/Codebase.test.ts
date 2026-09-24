import { describe, expect, it } from 'vitest';
import { findInterfaces, findSuperclass, isInterfaceLike, parentIds } from './Codebase';
import { sampleCodebase } from './testFixtures';
import type { CodeClass } from './Codebase';

describe('findSuperclass', () => {
  it('superclassIdが指すクラスを返す', () => {
    // Arrange
    const codebase = {
      files: sampleCodebase().files.map((file, index) =>
        index === 0
          ? { ...file, classes: [{ ...file.classes[0], superclassId: 'class-tax' }] }
          : file,
      ),
    };

    // Act
    const superclass = findSuperclass(codebase, 'class-order');

    // Assert
    expect(superclass?.id).toBe('class-tax');
  });

  it('superclassIdを持たないクラスはundefinedを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const superclass = findSuperclass(codebase, 'class-order');

    // Assert
    expect(superclass).toBeUndefined();
  });

  it('superclassIdが指すクラスが存在しない(削除済み)ときはundefinedを返す', () => {
    // Arrange
    const codebase = {
      files: sampleCodebase().files.map((file, index) =>
        index === 0
          ? { ...file, classes: [{ ...file.classes[0], superclassId: 'class-deleted' }] }
          : file,
      ),
    };

    // Act
    const superclass = findSuperclass(codebase, 'class-order');

    // Assert
    expect(superclass).toBeUndefined();
  });

  it('存在しないクラスIDを指定するとundefinedを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const superclass = findSuperclass(codebase, 'class-none');

    // Assert
    expect(superclass).toBeUndefined();
  });
});

function emptyClass(id: string, overrides: Partial<CodeClass> = {}): CodeClass {
  return { id, name: id, methods: [], ...overrides };
}

describe('parentIds', () => {
  it('継承元(extends)→実装先(implements)の宣言順で返す', () => {
    // Arrange
    const codeClass = emptyClass('class-a', { superclassId: 'class-base', interfaceIds: ['class-i1', 'class-i2'] });

    // Act
    const result = parentIds(codeClass);

    // Assert
    expect(result).toEqual(['class-base', 'class-i1', 'class-i2']);
  });

  it('継承元・実装先のどちらもなければ空配列を返す', () => {
    // Arrange
    const codeClass = emptyClass('class-a');

    // Act
    const result = parentIds(codeClass);

    // Assert
    expect(result).toEqual([]);
  });
});

describe('findInterfaces', () => {
  it('interfaceIdsが指すクラスを宣言順で返す', () => {
    // Arrange
    const codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [emptyClass('class-a', { interfaceIds: ['class-i1', 'class-i2'] }), emptyClass('class-i1'), emptyClass('class-i2')],
        },
      ],
    };

    // Act
    const result = findInterfaces(codebase, 'class-a');

    // Assert
    expect(result.map((codeClass) => codeClass.id)).toEqual(['class-i1', 'class-i2']);
  });

  it('削除済みで見つからないIDは飛ばす', () => {
    // Arrange
    const codebase = {
      files: [{ id: 'file', path: 'src/all.ts', classes: [emptyClass('class-a', { interfaceIds: ['class-deleted', 'class-i1'] }), emptyClass('class-i1')] }],
    };

    // Act
    const result = findInterfaces(codebase, 'class-a');

    // Assert
    expect(result.map((codeClass) => codeClass.id)).toEqual(['class-i1']);
  });
});

describe('isInterfaceLike', () => {
  it('メソッドが1つ以上あり、すべてpublicで中身がなければtrue', () => {
    // Arrange
    const codeClass = emptyClass('class-a', {
      methods: [{ id: 'm1', name: 'run', visibility: 'public', fragments: [] }],
    });

    // Act
    const result = isInterfaceLike(codeClass);

    // Assert
    expect(result).toBe(true);
  });

  it('メソッドが1つもなければfalse', () => {
    // Arrange
    const codeClass = emptyClass('class-a');

    // Act
    const result = isInterfaceLike(codeClass);

    // Assert
    expect(result).toBe(false);
  });

  it('中身のあるメソッドが混ざっていればfalse', () => {
    // Arrange
    const codeClass = emptyClass('class-a', {
      methods: [
        { id: 'm1', name: 'run', visibility: 'public', fragments: [] },
        { id: 'm2', name: 'other', visibility: 'public', fragments: [{ id: 'f1', label: 'f', lines: 1, responsibility: 'x' }] },
      ],
    });

    // Act
    const result = isInterfaceLike(codeClass);

    // Assert
    expect(result).toBe(false);
  });

  it('中身のないprivateメソッドだけのクラスはfalse', () => {
    // Arrange
    const codeClass = emptyClass('class-a', {
      methods: [{ id: 'm1', name: 'run', visibility: 'private', fragments: [] }],
    });

    // Act
    const result = isInterfaceLike(codeClass);

    // Assert
    expect(result).toBe(false);
  });
});
