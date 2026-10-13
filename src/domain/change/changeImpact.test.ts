import { describe, expect, it } from 'vitest';
import { fragment } from '../codebase/testFixtures';
import type { Codebase } from '../codebase/Codebase';
import type { ChangeRequest } from './ChangeRequest';
import { explainChangeImpact } from './changeImpact';

const request: ChangeRequest = { id: 'tax', title: '税率を変える', description: '', responsibility: 'tax', linesPerSite: 1 };
const method = (id: string, name: string, fragments: ReturnType<typeof fragment>[]) => ({ id, name, visibility: 'public' as const, fragments });
const codebase = (...classes: { id: string; name: string; methods: ReturnType<typeof method>[] }[]): Codebase => ({ files: [{ id: 'file', path: 'main.ts', classes }] });

describe('explainChangeImpact', () => {
  it('抽出された責務の移動と読む量の減少を返す', () => {
    // Arrange
    const initial = codebase({ id: 'sales', name: 'Sales', methods: [method('print', 'printMonthlyReport', [fragment('tax', 5, 'tax'), fragment('other', 30)])] });
    const current = codebase(
      { id: 'sales', name: 'Sales', methods: [method('print', 'printMonthlyReport', [fragment('other', 30)])] },
      { id: 'calc', name: 'Calculator', methods: [method('aggregate', 'aggregateSales', [fragment('tax', 5, 'tax'), fragment('new-tax', 3, 'tax')])] },
    );

    // Act
    const result = explainChangeImpact(initial, current, request);

    // Assert
    expect(result?.before.sites.map((site) => site.methodName)).toEqual(['printMonthlyReport']);
    expect(result?.after.sites.map((site) => site.methodName)).toEqual(['aggregateSales']);
    expect(result?.moves).toMatchObject([{ kind: 'extracted', fragmentLabels: ['tax'], from: [{ methodId: 'print' }], to: { methodId: 'aggregate' } }]);
    expect(result?.verdict).toBe('better');
  });

  it('別メソッドから同じメソッドへ集めた処理をgatheredとして返す', () => {
    // Arrange
    const initial = codebase({ id: 'c', name: 'Tax', methods: [method('a', 'one', [fragment('tax-a', 2, 'tax')]), method('b', 'two', [fragment('tax-b', 2, 'tax')])] });
    const current = codebase({ id: 'c', name: 'Tax', methods: [method('calculate', 'calculate', [fragment('tax-a', 2, 'tax'), fragment('tax-b', 2, 'tax')])] });

    // Act
    const result = explainChangeImpact(initial, current, request);

    // Assert
    expect(result?.before.sites).toHaveLength(2);
    expect(result?.moves[0]).toMatchObject({ kind: 'gathered', from: [{ methodId: 'a' }, { methodId: 'b' }] });
  });

  it('メソッド移動を判定し、変化のないコードはsame、サイト欠落はundefinedにする', () => {
    // Arrange
    const initial = codebase({ id: 'a', name: 'A', methods: [method('m', 'calculate', [fragment('tax', 5, 'tax')])] });
    const moved = codebase({ id: 'b', name: 'B', methods: [method('m', 'calculate', [fragment('tax', 5, 'tax')])] });
    const absent = codebase({ id: 'a', name: 'A', methods: [] });

    // Act
    const movedResult = explainChangeImpact(initial, moved, request);
    const sameResult = explainChangeImpact(initial, initial, request);
    const absentResult = explainChangeImpact(initial, absent, request);

    // Assert
    expect(movedResult?.moves[0]?.kind).toBe('moved');
    expect(sameResult).toMatchObject({ moves: [], verdict: 'same' });
    expect(absentResult).toBeUndefined();
  });

  it('変更箇所の増加をworseとし、未追跡Fragmentは移動に含めない', () => {
    // Arrange
    const initial = codebase({ id: 'c', name: 'A', methods: [method('m', 'one', [fragment('tax', 4, 'tax')])] });
    const current = codebase({ id: 'c', name: 'A', methods: [method('m', 'one', [fragment('new-tax', 4, 'tax')]), method('n', 'two', [fragment('other-tax', 5, 'tax')])] });

    // Act
    const result = explainChangeImpact(initial, current, request);

    // Assert
    expect(result?.verdict).toBe('worse');
    expect(result?.moves).toEqual([]);
  });
});
