import { describe, expect, it } from 'vitest';
import { fieldsOf, findClassOfField, findField, findInterfaces, findSuperclass, isInterfaceLike, isStubMethod, parentIds, touchedFieldIds } from './Codebase';
import { sampleCodebase } from './testFixtures';
import type { CodeClass, Field, Fragment, Method } from './Codebase';

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

function method(overrides: Partial<Method> = {}): Method {
  return { id: 'm1', name: 'run', visibility: 'public', fragments: [], ...overrides };
}

describe('isStubMethod', () => {
  it('処理がすべてstubならtrue', () => {
    // Arrange
    const target = method({
      fragments: [
        { id: 'f1', label: 'a', lines: 1, responsibility: 'x', stub: true },
        { id: 'f2', label: 'b', lines: 1, responsibility: 'x', stub: true },
      ],
    });

    // Act
    const result = isStubMethod(target);

    // Assert
    expect(result).toBe(true);
  });

  it('stubと通常の処理が混在していればfalse', () => {
    // Arrange
    const target = method({
      fragments: [
        { id: 'f1', label: 'a', lines: 1, responsibility: 'x', stub: true },
        { id: 'f2', label: 'b', lines: 1, responsibility: 'x' },
      ],
    });

    // Act
    const result = isStubMethod(target);

    // Assert
    expect(result).toBe(false);
  });

  it('処理が1つもなければ(契約メソッド)false', () => {
    // Arrange
    const target = method({ fragments: [] });

    // Act
    const result = isStubMethod(target);

    // Assert
    expect(result).toBe(false);
  });
});

function field(id: string, overrides: Partial<Field> = {}): Field {
  return { id, name: id, visibility: 'public', ...overrides };
}

describe('fieldsOf', () => {
  it('fieldsがあればそのまま返す', () => {
    // Arrange
    const codeClass = emptyClass('class-a', { fields: [field('field-status')] });

    // Act
    const result = fieldsOf(codeClass);

    // Assert
    expect(result).toEqual([field('field-status')]);
  });

  it('fieldsがなければ空配列を返す', () => {
    // Arrange
    const codeClass = emptyClass('class-a');

    // Act
    const result = fieldsOf(codeClass);

    // Assert
    expect(result).toEqual([]);
  });
});

function fragment(overrides: Partial<Fragment> = {}): Fragment {
  return { id: 'f1', label: 'f1', lines: 1, responsibility: 'x', ...overrides };
}

describe('touchedFieldIds', () => {
  it('readsとwritesに同じIDがあっても1つにまとめる', () => {
    // Arrange
    const target = fragment({ reads: ['field-a', 'field-b'], writes: ['field-b'] });

    // Act
    const result = touchedFieldIds(target);

    // Assert
    expect(result).toEqual(['field-a', 'field-b']);
  });

  it('readsもwritesもなければ空配列を返す', () => {
    // Arrange
    const target = fragment();

    // Act
    const result = touchedFieldIds(target);

    // Assert
    expect(result).toEqual([]);
  });
});

function codebaseWithField(): CodeClass[] {
  return [emptyClass('class-a', { fields: [field('field-status')] }), emptyClass('class-b')];
}

describe('findField', () => {
  it('存在するフィールドIDなら見つかる', () => {
    // Arrange
    const codebase = { files: [{ id: 'file', path: 'src/all.ts', classes: codebaseWithField() }] };

    // Act
    const result = findField(codebase, 'field-status');

    // Assert
    expect(result).toEqual(field('field-status'));
  });

  it('存在しないフィールドIDはundefinedを返す', () => {
    // Arrange
    const codebase = { files: [{ id: 'file', path: 'src/all.ts', classes: codebaseWithField() }] };

    // Act
    const result = findField(codebase, 'field-missing');

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('findClassOfField', () => {
  it('フィールドを持つクラスが見つかる', () => {
    // Arrange
    const codebase = { files: [{ id: 'file', path: 'src/all.ts', classes: codebaseWithField() }] };

    // Act
    const result = findClassOfField(codebase, 'field-status');

    // Assert
    expect(result?.id).toBe('class-a');
  });

  it('存在しないフィールドIDはundefinedを返す', () => {
    // Arrange
    const codebase = { files: [{ id: 'file', path: 'src/all.ts', classes: codebaseWithField() }] };

    // Act
    const result = findClassOfField(codebase, 'field-missing');

    // Assert
    expect(result).toBeUndefined();
  });
});
