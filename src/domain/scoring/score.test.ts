import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase } from '../codebase/Codebase';
import { extractMethod } from '../codebase/extractMethod';
import { moveMethod } from '../codebase/moveMethod';
import { sampleCodebase } from '../codebase/testFixtures';
import type { Result } from '../shared/Result';
import { scoreCodebase } from './score';

/** クラスAがクラスBのprivateメソッドを呼ぶだけの最小のコードベース。 */
function codebaseWithPrivateCallAcrossClasses(): Codebase {
  return {
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
                fragments: [{ id: 'f-a', label: 'call', lines: 1, responsibility: 'call', uses: ['method-B'] }],
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
}

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
  return result.value;
}

const LOOSE = { limits: { method: 100, class: 100, file: 100 }, responsibilityLimit: 100 };

/** 各クラスに「uses だけを持つ1行の処理」を1つ置いたコードベース。 */
function codebaseOf(classes: Record<string, readonly string[]>): Codebase {
  const codeClasses: CodeClass[] = Object.entries(classes).map(([name, uses]) => ({
    id: `class-${name}`,
    name,
    methods: [
      {
        id: `method-${name}`,
        name: 'run',
        visibility: 'public',
        fragments: [{ id: `f-${name}`, label: name, lines: 1, responsibility: 'call', uses }],
      },
    ],
  }));
  return { files: [{ id: 'file', path: 'src/all.ts', classes: codeClasses }] };
}

describe('scoreCodebase', () => {
  it('違反がなければ100点で、5ルールとも減点0件を返す', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: [] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score).toEqual({
      total: 100,
      deductions: [
        { rule: 'line-limit', count: 0, points: 0 },
        { rule: 'coupling', count: 0, points: 0 },
        { rule: 'cycle', count: 0, points: 0 },
        { rule: 'responsibility', count: 0, points: 0 },
        { rule: 'visibility', count: 0, points: 0 },
      ],
    });
  });

  it('行数の上限違反1件につき10点減点する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, limits: { method: 20, class: 100, file: 27 }, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(80);
    expect(score.deductions[0]).toEqual({ rule: 'line-limit', count: 2, points: 20 });
  });

  it('依存先クラス数が上限を超えたクラス1つにつき10点減点する', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B', 'method-C'], B: [], C: [] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[1]).toEqual({ rule: 'coupling', count: 1, points: 10 });
  });

  it('依存先クラス数がちょうど上限なら減点しない', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: [] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.deductions[1]).toEqual({ rule: 'coupling', count: 0, points: 0 });
  });

  it('循環している依存1本につき10点減点する', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-A'] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(80);
    expect(score.deductions[2]).toEqual({ rule: 'cycle', count: 2, points: 20 });
  });

  it('責務の種類数が上限を超えたクラス1つにつき10点減点する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1, responsibilityLimit: 2 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[3]).toEqual({ rule: 'responsibility', count: 1, points: 10 });
  });

  it('visibilityEnforced が未指定なら、越境した private メソッド呼び出しがあっても減点しない', () => {
    // Arrange
    const codebase = codebaseWithPrivateCallAcrossClasses();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.deductions[4]).toEqual({ rule: 'visibility', count: 0, points: 0 });
  });

  it('visibilityEnforced: true のとき、越境した private メソッド呼び出し1件につき10点減点する', () => {
    // Arrange
    const codebase = codebaseWithPrivateCallAcrossClasses();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1, visibilityEnforced: true });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[4]).toEqual({ rule: 'visibility', count: 1, points: 10 });
  });

  it('Extract Method で作った private メソッドを Move Method で別クラスへ移すと、越境呼び出しとして検出される', () => {
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
                  fragments: [
                    { id: 'f-a', label: 'do', lines: 1, responsibility: 'work' },
                    { id: 'f-b', label: 'other', lines: 1, responsibility: 'other' },
                  ],
                },
              ],
            },
            { id: 'class-B', name: 'B', methods: [] },
          ],
        },
      ],
    };
    const extracted = unwrap(
      extractMethod(codebase, { sourceMethodId: 'method-A', fragmentIds: ['f-a'], newMethodId: 'method-extracted', newMethodName: 'helper' }),
    );
    const moved = unwrap(moveMethod(extracted, 'method-extracted', 'class-B'));

    // Act
    const score = scoreCodebase(moved, { ...LOOSE, dependencyLimit: 1, visibilityEnforced: true });

    // Assert
    expect(score.deductions[4]).toEqual({ rule: 'visibility', count: 1, points: 10 });
  });

  it('減点の合計が100点を超えても0点で止まる', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-C'], C: ['method-A'] });

    // Act
    const score = scoreCodebase(codebase, { limits: { method: 0, class: 0, file: 0 }, dependencyLimit: 0, responsibilityLimit: 0 });

    // Assert
    expect(score.total).toBe(0);
  });
});
