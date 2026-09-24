import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { deleteMethod } from './deleteMethod';

function codebaseWithMethod(fragments: Codebase['files'][0]['classes'][0]['methods'][0]['fragments']): Codebase {
  return {
    files: [
      {
        id: 'file-a',
        path: 'src/a.ts',
        classes: [
          {
            id: 'class-a',
            name: 'A',
            methods: [{ id: 'method-target', name: 'target', visibility: 'public', fragments }],
          },
        ],
      },
    ],
  };
}

describe('deleteMethod', () => {
  it('空実装のメソッドを削除できる', () => {
    // Arrange
    const codebase = codebaseWithMethod([{ id: 'f1', label: '未対応', lines: 3, responsibility: 'x', stub: true }]);

    // Act
    const result = deleteMethod(codebase, 'method-target');

    // Assert
    expect(result).toEqual({ ok: true, value: { files: [{ id: 'file-a', path: 'src/a.ts', classes: [{ id: 'class-a', name: 'A', methods: [] }] }] } });
  });

  it('存在しないメソッドIDを指定するとmethod-not-found', () => {
    // Arrange
    const codebase = codebaseWithMethod([{ id: 'f1', label: '未対応', lines: 3, responsibility: 'x', stub: true }]);

    // Act
    const result = deleteMethod(codebase, 'method-missing');

    // Assert
    expect(result).toEqual({ ok: false, error: 'method-not-found' });
  });

  it('通常の処理を持つメソッドを指定するとnot-stub', () => {
    // Arrange
    const codebase = codebaseWithMethod([{ id: 'f1', label: '本物の処理', lines: 10, responsibility: 'x' }]);

    // Act
    const result = deleteMethod(codebase, 'method-target');

    // Assert
    expect(result).toEqual({ ok: false, error: 'not-stub' });
  });

  it('契約メソッド(fragments: [])を指定するとnot-stub', () => {
    // Arrange
    const codebase = codebaseWithMethod([]);

    // Act
    const result = deleteMethod(codebase, 'method-target');

    // Assert
    expect(result).toEqual({ ok: false, error: 'not-stub' });
  });

  it('元のCodebaseを変更しない', () => {
    // Arrange
    const codebase = codebaseWithMethod([{ id: 'f1', label: '未対応', lines: 3, responsibility: 'x', stub: true }]);

    // Act
    deleteMethod(codebase, 'method-target');

    // Assert
    expect(codebase.files[0]?.classes[0]?.methods).toHaveLength(1);
  });
});
