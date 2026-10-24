import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Field, Fragment, Method } from '../codebase/Codebase';
import { TRAY_FILE_ID } from '../blank/tray';
import { entryPointMethodIds, findUnusedPublicMembers } from './unusedPublicMembers';

function field(id: string): Field {
  return { id, name: id, visibility: 'public' };
}

function method(id: string, fragments: readonly Fragment[] = [], visibility: Method['visibility'] = 'public'): Method {
  return { id, name: id, visibility, fragments };
}

function work(id: string, access: Pick<Fragment, 'reads' | 'writes' | 'uses'> = {}): Fragment {
  return { id: `frag-${id}`, label: id, lines: 1, responsibility: 'x', ...access };
}

function classOf(id: string, options: Partial<CodeClass> = {}): CodeClass {
  return { id, name: id, methods: [], ...options };
}

function codebaseOf(classes: readonly CodeClass[]): Codebase {
  return { files: [{ id: 'file', path: 'src/all.ts', classes }] };
}

describe('findUnusedPublicMembers', () => {
  it('別クラスから読まれている public フィールドは対象外', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('A', { fields: [field('f-a')] }),
      classOf('B', { methods: [method('m-b', [work('b', { reads: ['f-a'] })])] }),
    ]);

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: ['m-b'] });

    // Assert
    expect(unused).toEqual([]);
  });

  it('どこからも触られていない public フィールドは対象', () => {
    // Arrange
    const codebase = codebaseOf([classOf('A', { fields: [field('f-a')] })]);

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: [] });

    // Assert
    expect(unused).toEqual([{ kind: 'field', id: 'f-a', classId: 'A' }]);
  });

  it('同じクラスの中からだけ呼ばれる public メソッドは対象', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('A', { methods: [method('m-helper', [work('h')]), method('m-run', [work('r', { uses: ['m-helper'] })])] }),
    ]);

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: ['m-run'] });

    // Assert
    expect(unused).toEqual([{ kind: 'method', id: 'm-helper', classId: 'A' }]);
  });

  it('子クラスからだけ呼ばれる public メソッドは対象', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('Parent', { methods: [method('m-base', [work('base')])] }),
      classOf('Child', { superclassId: 'Parent', methods: [method('m-run', [work('r', { uses: ['m-base'] })])] }),
    ]);

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: ['m-run'] });

    // Assert
    expect(unused).toEqual([{ kind: 'method', id: 'm-base', classId: 'Parent' }]);
  });

  it('別クラスから呼ばれる public メソッドは対象外', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('A', { methods: [method('m-a', [work('a')])] }),
      classOf('B', { methods: [method('m-b', [work('b', { uses: ['m-a'] })])] }),
    ]);

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: ['m-b'] });

    // Assert
    expect(unused).toEqual([]);
  });

  it('entryPointIds に含まれるメソッドは対象外', () => {
    // Arrange
    const codebase = codebaseOf([classOf('A', { methods: [method('m-entry', [work('e')])] })]);

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: ['m-entry'] });

    // Assert
    expect(unused).toEqual([]);
  });

  it('インターフェース役のクラスのメソッドと、それを実装するメソッドは対象外', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('Port', { methods: [{ ...method('m-port'), name: 'send' }] }),
      classOf('Impl', { interfaceIds: ['Port'], methods: [{ ...method('m-impl', [work('i')]), name: 'send' }] }),
    ]);

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: [] });

    // Assert
    expect(unused).toEqual([]);
  });

  it('private のメンバーと部品置き場のメンバーは対象外', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: 'file', path: 'src/all.ts', classes: [classOf('A', { fields: [{ ...field('f-a'), visibility: 'private' }], methods: [method('m-a', [work('a')], 'private')] })] },
        { id: TRAY_FILE_ID, path: '部品置き場', classes: [classOf('Tray', { methods: [method('m-part', [work('p')])] })] },
      ],
    };

    // Act
    const unused = findUnusedPublicMembers(codebase, { entryPointIds: [] });

    // Assert
    expect(unused).toEqual([]);
  });
});

describe('entryPointMethodIds', () => {
  it('どのクラスからも呼ばれていない public メソッドだけを返す', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('A', { methods: [method('m-entry', [work('e', { uses: ['m-used'] })]), method('m-used', [work('u')]), method('m-hidden', [work('h')], 'private')] }),
    ]);

    // Act
    const ids = entryPointMethodIds(codebase);

    // Assert
    expect(ids).toEqual(['m-entry']);
  });
});
