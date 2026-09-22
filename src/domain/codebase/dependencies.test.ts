import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Fragment } from './Codebase';
import { classDependencies, methodOwnerMap } from './dependencies';

function callFragment(id: string, uses: readonly string[]): Fragment {
  return { id, label: id, lines: 1, responsibility: 'call', uses };
}

/** クラスごとに「メソッド1つ + そのメソッドが呼ぶメソッドID」だけを持つ最小のコードベースを作る。 */
function codebaseOf(classes: Record<string, readonly string[]>): Codebase {
  const codeClasses: CodeClass[] = Object.entries(classes).map(([name, uses]) => ({
    id: `class-${name}`,
    name,
    methods: [{ id: `method-${name}`, name: 'run', visibility: 'public', fragments: [callFragment(`f-${name}`, uses)] }],
  }));
  return { files: [{ id: 'file', path: 'src/all.ts', classes: codeClasses }] };
}

describe('methodOwnerMap', () => {
  it('各メソッドIDに正しい所属クラスIDが引ける', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: [] });

    // Act
    const map = methodOwnerMap(codebase);

    // Assert
    expect(map.get('method-A')).toBe('class-A');
    expect(map.get('method-B')).toBe('class-B');
  });

  it('存在しないメソッドIDでは undefined になる', () => {
    // Arrange
    const codebase = codebaseOf({ A: [] });

    // Act
    const map = methodOwnerMap(codebase);

    // Assert
    expect(map.get('method-missing')).toBeUndefined();
  });
});

describe('classDependencies', () => {
  it('別クラスのメソッドを呼ぶと、呼んだクラスから呼ばれたクラスへの依存になる', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: [] });

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([{ from: 'class-A', to: 'class-B', cyclic: false }]);
  });

  it('同じクラス内の呼び出しと、存在しないメソッドIDは依存にしない', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-A', 'method-missing'] });

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([]);
  });

  it('同じクラスへの呼び出しが複数あっても依存は1本にまとめる', () => {
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
                  fragments: [callFragment('f1', ['method-B1']), callFragment('f2', ['method-B2', 'method-B1'])],
                },
              ],
            },
            {
              id: 'class-B',
              name: 'B',
              methods: [
                { id: 'method-B1', name: 'one', visibility: 'public', fragments: [] },
                { id: 'method-B2', name: 'two', visibility: 'public', fragments: [] },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([{ from: 'class-A', to: 'class-B', cyclic: false }]);
  });

  it('uses を持たない処理は依存を生まない', () => {
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
                {
                  id: 'method-A',
                  name: 'run',
                  visibility: 'public',
                  fragments: [{ id: 'f', label: 'f', lines: 3, responsibility: 'misc' }],
                },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([]);
  });

  it('A→B→A の依存は両方とも循環として印が付く', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-A'] });

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([
      { from: 'class-A', to: 'class-B', cyclic: true },
      { from: 'class-B', to: 'class-A', cyclic: true },
    ]);
  });

  it('3クラスの循環に含まれる依存だけに印が付き、循環の外の依存には付かない', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-C'], C: ['method-A', 'method-D'], D: [] });

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([
      { from: 'class-A', to: 'class-B', cyclic: true },
      { from: 'class-B', to: 'class-C', cyclic: true },
      { from: 'class-C', to: 'class-A', cyclic: true },
      { from: 'class-C', to: 'class-D', cyclic: false },
    ]);
  });

  it('循環へ流れ込むだけの依存には循環の印を付けない', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-C'], C: ['method-B'] });

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([
      { from: 'class-A', to: 'class-B', cyclic: false },
      { from: 'class-B', to: 'class-C', cyclic: true },
      { from: 'class-C', to: 'class-B', cyclic: true },
    ]);
  });
});
