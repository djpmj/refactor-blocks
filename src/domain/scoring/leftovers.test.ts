import { describe, expect, it } from 'vitest';
import type { Codebase, Method } from '../codebase/Codebase';
import { findEmptyContainers, findUnusedPrivateMethods } from './leftovers';

function method(id: string, visibility: Method['visibility'], uses: readonly string[] = []): Method {
  return { id, name: id, visibility, fragments: [{ id: `f-${id}`, label: id, lines: 1, responsibility: 'work', uses }] };
}

describe('findEmptyContainers', () => {
  it('メソッドのないクラスとクラスのないファイルのIDを返す', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file-a',
          path: 'src/a.ts',
          classes: [
            { id: 'class-full', name: 'Full', methods: [method('m', 'public')] },
            { id: 'class-empty', name: 'Empty', methods: [] },
          ],
        },
        { id: 'file-empty', path: 'src/empty.ts', classes: [] },
      ],
    };

    // Act
    const empty = findEmptyContainers(codebase);

    // Assert
    expect(empty).toEqual(['class-empty', 'file-empty']);
  });
});

describe('findUnusedPrivateMethods', () => {
  it('どこからも呼ばれていない private メソッドのIDだけを返す', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/a.ts',
          classes: [
            {
              id: 'class-A',
              name: 'A',
              methods: [
                method('run', 'public', ['used']),
                method('used', 'private'),
                method('unused', 'private'),
                method('entry', 'public'),
              ],
            },
          ],
        },
      ],
    };

    // Act
    const unused = findUnusedPrivateMethods(codebase);

    // Assert
    expect(unused).toEqual(['unused']);
  });

  it('自分自身からしか呼ばれていない private メソッドは使われていないとみなす', () => {
    // Arrange
    const codebase: Codebase = {
      files: [{ id: 'file', path: 'src/a.ts', classes: [{ id: 'class-A', name: 'A', methods: [method('loop', 'private', ['loop'])] }] }],
    };

    // Act
    const unused = findUnusedPrivateMethods(codebase);

    // Assert
    expect(unused).toEqual(['loop']);
  });
});
