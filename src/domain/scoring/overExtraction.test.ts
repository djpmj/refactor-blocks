import { describe, expect, it } from 'vitest';
import type { Codebase, Method } from '../codebase/Codebase';
import { findThinClasses, findTrivialMethods } from './overExtraction';

function codebaseWith(methods: readonly Method[], fields: Codebase['files'][number]['classes'][number]['fields'] = []): Codebase {
  return {
    files: [{ id: 'file', path: 'src/file.ts', classes: [{ id: 'class', name: 'Example', methods, fields }] }],
  };
}

function method(id: string, fragments: Method['fragments']): Method {
  return { id, name: id, visibility: 'public', fragments };
}

describe('findTrivialMethods', () => {
  it('実処理が1〜2行なら返し、3行以上・契約宣言・stub・accessor・callのみは除外する', () => {
    // Arrange
    const codebase = codebaseWith([
      method('one', [{ id: '1', label: 'work', lines: 1, responsibility: 'work' }]),
      method('two', [
        { id: '2a', label: 'call', lines: 1, responsibility: 'call' },
        { id: '2b', label: 'work', lines: 1, responsibility: 'work' },
      ]),
      method('long', [{ id: '3', label: 'work', lines: 3, responsibility: 'work' }]),
      method('contract', []),
      method('stub', [{ id: '4', label: 'stub', lines: 1, responsibility: 'work', stub: true }]),
      method('accessor', [{ id: '5', label: 'get', lines: 1, responsibility: 'work', accessor: true }]),
      method('calls', [{ id: '6', label: 'call', lines: 1, responsibility: 'call' }]),
    ]);

    // Act
    const result = findTrivialMethods(codebase);

    // Assert
    expect(result).toEqual(['one', 'two']);
  });
});

describe('findThinClasses', () => {
  it('1つの極小メソッドだけを持ちフィールドがないクラスを返す', () => {
    // Arrange
    const tiny = method('tiny', [{ id: 'f', label: 'work', lines: 1, responsibility: 'work' }]);
    const codebase: Codebase = {
      files: [{ id: 'file', path: 'src/file.ts', classes: [
        { id: 'thin', name: 'Thin', methods: [tiny] },
        { id: 'long', name: 'Long', methods: [method('long-method', [{ id: 'long-f', label: 'work', lines: 30, responsibility: 'work' }])] },
        { id: 'stateful', name: 'Stateful', methods: [method('state-method', tiny.fragments)], fields: [{ id: 'field', name: 'state', visibility: 'private' }] },
        { id: 'many', name: 'Many', methods: [tiny, method('other', tiny.fragments)] },
        { id: 'empty', name: 'Empty', methods: [] },
      ] }],
    };

    // Act
    const result = findThinClasses(codebase);

    // Assert
    expect(result).toEqual(['thin']);
  });
});
