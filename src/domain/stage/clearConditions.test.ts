import { describe, expect, it } from 'vitest';
import { sampleCodebase } from '../codebase/testFixtures';
import type { Codebase } from '../codebase/Codebase';
import type { Score } from '../scoring/score';
import { clearConditions, worstMeasures } from './clearConditions';

function score(counts: Partial<Record<Score['deductions'][number]['rule'], number>>): Score {
  const rules: Score['deductions'][number]['rule'][] = ['line-limit', 'coupling', 'cycle', 'responsibility', 'visibility', 'unused'];
  return { total: 100, deductions: rules.map((rule) => ({ rule, count: counts[rule] ?? 0, points: 0 })) };
}

describe('clearConditions', () => {
  it('常時表示の3条件を含め、初期か現在のどちらかで違反した条件だけを採点順に返す', () => {
    // Arrange
    const initial = score({ visibility: 2 });
    const current = score({ 'line-limit': 1, coupling: 2, responsibility: 3, unused: 1 });

    // Act
    const conditions = clearConditions(initial, current);

    // Assert
    expect(conditions).toEqual([
      { rule: 'line-limit', count: 1 },
      { rule: 'coupling', count: 2 },
      { rule: 'responsibility', count: 3 },
      { rule: 'visibility', count: 0 },
      { rule: 'unused', count: 1 },
    ]);
  });

  it('どちらも違反がない任意ルールは含めない', () => {
    // Arrange
    const clean = score({});

    // Act
    const conditions = clearConditions(clean, clean);

    // Assert
    expect(conditions).toEqual([
      { rule: 'line-limit', count: 0 },
      { rule: 'coupling', count: 0 },
      { rule: 'responsibility', count: 0 },
    ]);
  });
});

describe('worstMeasures', () => {
  it('上限を超えたメソッドとファイルの最大値を返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const measures = worstMeasures(codebase, { limits: { method: 20, class: 100, file: 27 }, dependencyLimit: 0, responsibilityLimit: 2 });

    // Assert
    expect(measures).toEqual({ method: 27, file: 30, responsibilities: 3 });
  });

  it('上限内なら値を返さない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const measures = worstMeasures(codebase, { limits: { method: 27, class: 30, file: 30 }, dependencyLimit: 1, responsibilityLimit: 3 });

    // Assert
    expect(measures).toEqual({});
  });

  it('依存先・責務・クラス・ファイルの違反値は最大の実測値を返す', () => {
    // Arrange
    const method = (id: string, fragments: Codebase['files'][number]['classes'][number]['methods'][number]['fragments']) => ({
      id,
      name: id,
      visibility: 'public' as const,
      fragments,
    });
    const codebase: Codebase = {
      files: [{
        id: 'file-main',
        path: 'main.ts',
        classes: [
          {
            id: 'owner',
            name: 'Owner',
            methods: [method('calls', [
              { id: 'call-a', label: 'a', lines: 10, responsibility: 'a', uses: ['a'] },
              { id: 'call-b', label: 'b', lines: 10, responsibility: 'b', uses: ['b'] },
              { id: 'call-c', label: 'c', lines: 10, responsibility: 'c', uses: ['c'] },
              { id: 'call-d', label: 'd', lines: 10, responsibility: 'd', uses: ['d'] },
            ])],
          },
          ...['a', 'b', 'c'].map((id) => ({ id, name: id, methods: [method(id, [{ id: `frag-${id}`, label: id, lines: 10, responsibility: 'x' }])] })),
        ],
      }, {
        id: 'file-other',
        path: 'other.ts',
        classes: [{
          id: 'other-owner',
          name: 'OtherOwner',
          methods: [method('other-calls', [
            { id: 'other-call-a', label: 'a', lines: 10, responsibility: 'other-a', uses: ['a'] },
            { id: 'other-call-b', label: 'b', lines: 10, responsibility: 'other-b', uses: ['b'] },
            { id: 'other-work', label: 'work', lines: 10, responsibility: 'other-work' },
          ])],
        }],
      }],
    };

    // Act
    const measures = worstMeasures(codebase, { limits: { method: 20, class: 30, file: 50 }, dependencyLimit: 1, responsibilityLimit: 2 });

    // Assert
    expect(measures).toEqual({ method: 43, class: 46, file: 94, dependencies: 3, responsibilities: 4 });
    expect(worstMeasures(codebase, { limits: { method: 100, class: 100, file: 200 }, dependencyLimit: 3, responsibilityLimit: 4 })).toEqual({});
  });

  it('複数の行数違反から最大のメソッド行数を返す', () => {
    // Arrange
    const codebase: Codebase = {
      files: [{
        id: 'file-long-methods',
        path: 'LongMethods.ts',
        classes: [{
          id: 'class-long-methods',
          name: 'LongMethods',
          methods: [57, 81].map((lines, index) => ({
            id: `method-${String(index)}`,
            name: `method${String(index)}`,
            visibility: 'public' as const,
            fragments: [{ id: `fragment-${String(index)}`, label: 'work', lines, responsibility: 'work' }],
          })),
        }],
      }],
    };

    // Act
    const measures = worstMeasures(codebase, { limits: { method: 50, class: 200, file: 300 }, dependencyLimit: 0, responsibilityLimit: 1 });

    // Assert
    expect(measures.method).toBe(84);
  });
});
