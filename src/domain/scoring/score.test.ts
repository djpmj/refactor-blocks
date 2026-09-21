import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase } from '../codebase/Codebase';
import { sampleCodebase } from '../codebase/testFixtures';
import { scoreCodebase } from './score';

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
  it('違反がなければ100点で、4ルールとも減点0件を返す', () => {
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

  it('減点の合計が100点を超えても0点で止まる', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-C'], C: ['method-A'] });

    // Act
    const score = scoreCodebase(codebase, { limits: { method: 0, class: 0, file: 0 }, dependencyLimit: 0, responsibilityLimit: 0 });

    // Assert
    expect(score.total).toBe(0);
  });
});
