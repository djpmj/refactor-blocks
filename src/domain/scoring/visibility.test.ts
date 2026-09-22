import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Fragment } from '../codebase/Codebase';
import { findVisibilityViolations } from './visibility';

function fragment(id: string, uses: readonly string[]): Fragment {
  return { id, label: id, lines: 1, responsibility: 'call', uses };
}

/** クラスごとに「メソッド1つ(指定した可視性) + そのメソッドが呼ぶメソッドID」だけを持つ最小のコードベースを作る。 */
function codebaseOf(
  classes: Record<string, { readonly visibility: 'public' | 'private' | 'protected'; readonly uses: readonly string[] }>,
): Codebase {
  const codeClasses: CodeClass[] = Object.entries(classes).map(([name, { visibility, uses }]) => ({
    id: `class-${name}`,
    name,
    methods: [{ id: `method-${name}`, name: 'run', visibility, fragments: [fragment(`f-${name}`, uses)] }],
  }));
  return { files: [{ id: 'file', path: 'src/all.ts', classes: codeClasses }] };
}

describe('findVisibilityViolations', () => {
  it('private メソッドを別クラスの Fragment が呼んでいると1件になる', () => {
    // Arrange
    const codebase = codebaseOf({
      A: { visibility: 'public', uses: ['method-B'] },
      B: { visibility: 'private', uses: [] },
    });

    // Act
    const violations = findVisibilityViolations(codebase);

    // Assert
    expect(violations).toEqual([{ methodId: 'method-B', callerClassId: 'class-A' }]);
  });

  it('同じクラス内で private メソッドを呼ぶのは違反にしない', () => {
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
                { id: 'method-run', name: 'run', visibility: 'public', fragments: [fragment('f-call', ['method-helper'])] },
                { id: 'method-helper', name: 'helper', visibility: 'private', fragments: [] },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const violations = findVisibilityViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });

  it('public メソッドを別クラスから呼ぶのは違反にしない', () => {
    // Arrange
    const codebase = codebaseOf({
      A: { visibility: 'public', uses: ['method-B'] },
      B: { visibility: 'public', uses: [] },
    });

    // Act
    const violations = findVisibilityViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });

  it('protected メソッドを別クラスから呼ぶのは違反にしない', () => {
    // Arrange
    const codebase = codebaseOf({
      A: { visibility: 'public', uses: ['method-B'] },
      B: { visibility: 'protected', uses: [] },
    });

    // Act
    const violations = findVisibilityViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });

  it('存在しないメソッドIDへの uses は無視して例外を投げない', () => {
    // Arrange
    const codebase = codebaseOf({ A: { visibility: 'public', uses: ['method-missing'] } });

    // Act
    const call = () => findVisibilityViolations(codebase);

    // Assert
    expect(call).not.toThrow();
    expect(call()).toEqual([]);
  });

  it('同じ外部クラスの複数の Fragment が同じ private メソッドを呼んでいても1件にまとめる', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-A',
              name: 'A',
              methods: [
                {
                  id: 'method-A',
                  name: 'run',
                  visibility: 'public',
                  fragments: [fragment('f1', ['method-B']), fragment('f2', ['method-B'])],
                },
              ],
            },
            {
              id: 'class-B',
              name: 'B',
              methods: [{ id: 'method-B', name: 'helper', visibility: 'private', fragments: [] }],
            },
          ],
        },
      ],
    };

    // Act
    const violations = findVisibilityViolations(codebase);

    // Assert
    expect(violations).toEqual([{ methodId: 'method-B', callerClassId: 'class-A' }]);
  });

  it('異なる2つの外部クラスが同じ private メソッドを呼んでいると2件になる(callerClassIdが異なる)', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-A',
              name: 'A',
              methods: [{ id: 'method-A', name: 'run', visibility: 'public', fragments: [fragment('f-a', ['method-C'])] }],
            },
            {
              id: 'class-B',
              name: 'B',
              methods: [{ id: 'method-B', name: 'run', visibility: 'public', fragments: [fragment('f-b', ['method-C'])] }],
            },
            {
              id: 'class-C',
              name: 'C',
              methods: [{ id: 'method-C', name: 'helper', visibility: 'private', fragments: [] }],
            },
          ],
        },
      ],
    };

    // Act
    const violations = findVisibilityViolations(codebase);

    // Assert
    expect(violations).toEqual([
      { methodId: 'method-C', callerClassId: 'class-A' },
      { methodId: 'method-C', callerClassId: 'class-B' },
    ]);
  });
});
