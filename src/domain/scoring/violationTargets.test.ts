import { describe, expect, it } from 'vitest';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { scoreCodebase, type ScoreRule } from './score';
import { violationTargets } from './violationTargets';

const RULES: readonly ScoreRule[] = [
  'line-limit', 'coupling', 'cycle', 'responsibility', 'visibility', 'empty', 'unused',
  'lone-superclass', 'stub', 'contract', 'feature-envy', 'encapsulation', 'cohesion', 'trivial-method', 'thin-class', 'middle-man', 'layer',
];
const EMPTY = { limits: { method: 100, class: 100, file: 100 }, dependencyLimit: 100, responsibilityLimit: 100 };

describe('violationTargets', () => {
  it('違反がないコードベースではすべて空の対象を返す', () => {
    // Arrange
    const codebase = { files: [{ id: 'file', path: 'full.ts', classes: [{
      id: 'class', name: 'Full', methods: [{ id: 'method', name: 'run', visibility: 'public' as const,
        fragments: [{ id: 'fragment', label: 'work', lines: 3, responsibility: 'work' }] }],
    }] }] };

    // Act
    const targets = violationTargets(codebase, EMPTY);

    // Assert
    for (const rule of RULES) expect(targets[rule]).toEqual({ fileIds: [], classIds: [], methodIds: [] });
  });

  it('各ステージの開始状態で採点対象の有無と対象IDが一致する', () => {
    // Arrange
    // Act / Assert
    for (const stage of stages) {
      const targets = violationTargets(stage.codebase, stage);
      const score = scoreCodebase(stage.codebase, stage);
      for (const deduction of score.deductions) {
        const target = targets[deduction.rule];
        const ids = [...target.fileIds, ...target.classIds, ...target.methodIds];
        expect(new Set(ids).size, `${stage.id}: ${deduction.rule} IDs unique`).toBe(ids.length);
        expect(ids.length > 0, `${stage.id}: ${deduction.rule}`).toBe(deduction.count > 0);
      }
    }
  });

  it('line-limit と empty の対象を種類ごとに分類する', () => {
    // Arrange
    const codebase = {
      files: [
        { id: 'large-file', path: 'large.ts', classes: [{ id: 'large-class', name: 'Large', methods: [{ id: 'long-method', name: 'run', visibility: 'public' as const, fragments: [{ id: 'part', label: 'work', lines: 8, responsibility: 'work' }] }] }] },
        { id: 'empty-file', path: 'empty.ts', classes: [] },
        { id: 'file-with-empty-class', path: 'empty-class.ts', classes: [{ id: 'empty-class', name: 'Empty', methods: [] }] },
      ],
    };

    // Act
    const targets = violationTargets(codebase, { ...EMPTY, limits: { method: 2, class: 4, file: 5 } });

    // Assert
    expect(targets['line-limit']).toEqual({ fileIds: ['large-file'], classIds: ['large-class'], methodIds: ['long-method'] });
    expect(targets.empty).toEqual({ fileIds: ['empty-file'], classIds: ['empty-class'], methodIds: [] });
  });

  it('複数の違反が同じブロックに集約されてもIDを重複させず、違反の有無を保つ', () => {
    // Arrange
    const codebase = { files: [{ id: 'file', path: 'all.ts', classes: [
      { id: 'a', name: 'A', methods: [{ id: 'call-a', name: 'call', visibility: 'public' as const, fragments: [{ id: 'fa', label: 'call', lines: 4, responsibility: 'call', uses: ['hidden'], writes: ['f1', 'f2'] }, { id: 'fa2', label: 'call again', lines: 4, responsibility: 'call', uses: ['hidden'] }] }], fields: [] },
      { id: 'b', name: 'B', methods: [{ id: 'hidden', name: 'hidden', visibility: 'private' as const, fragments: [{ id: 'fb', label: 'work', lines: 4, responsibility: 'work', uses: ['call-e'] }] }], fields: [{ id: 'f1', name: 'one', visibility: 'public' as const }, { id: 'f2', name: 'two', visibility: 'public' as const }] },
      { id: 'c', name: 'C', methods: [{ id: 'call-c', name: 'call', visibility: 'public' as const, fragments: [{ id: 'fc', label: 'call', lines: 4, responsibility: 'call', uses: ['hidden'] }] }], fields: [] },
      { id: 'd', name: 'D', methods: [{ id: 'call-d', name: 'call', visibility: 'public' as const, fragments: [{ id: 'fd', label: 'call', lines: 4, responsibility: 'call', uses: ['hidden'] }] }], fields: [] },
      { id: 'e', name: 'E', methods: [{ id: 'call-e', name: 'call', visibility: 'public' as const, fragments: [{ id: 'fe', label: 'call', lines: 4, responsibility: 'call', uses: ['call-a', 'call-c'] }] }], fields: [] },
    ] }] };
    const stage = { ...EMPTY, dependencyLimit: 10, visibilityEnforced: true };

    // Act
    const targets = violationTargets(codebase, stage);
    const score = scoreCodebase(codebase, stage);

    // Assert
    for (const rule of ['cycle', 'visibility', 'encapsulation'] as const) {
      const target = targets[rule];
      const ids = [...target.fileIds, ...target.classIds, ...target.methodIds];
      const count = score.deductions.find((deduction) => deduction.rule === rule)?.count ?? 0;
      expect(count).toBeGreaterThan(ids.length);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThan(0);
    }
  });
});
