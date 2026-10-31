import { describe, expect, it, vi } from 'vitest';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { History } from '../../domain/codebase/history';
import type { Score, ScoreDeduction } from '../../domain/scoring/score';
import { operationTimeline } from './operationTimeline';

const codebaseOf = (id: string): Codebase => ({ files: [{ id, path: `${id}.ts`, classes: [] }] });
const scoreOf = (deductions: readonly ScoreDeduction[]): Score => {
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: Math.max(0, 100 - deducted), deducted, deductions };
};
const d = (rule: ScoreDeduction['rule'], count: number): ScoreDeduction => ({ rule, count, points: count * 10 });

const S = codebaseOf('S');
const A = codebaseOf('A');
const B = codebaseOf('B');
const scoreTable = new Map<Codebase, Score>([
  [S, scoreOf([d('line-limit', 1)])],
  [A, scoreOf([d('line-limit', 0)])],
  [B, scoreOf([d('line-limit', 0), d('coupling', 1)])],
]);
const score = (codebase: Codebase): Score => scoreTable.get(codebase) ?? scoreOf([]);
const labels = new Map<Codebase, string>([[A, 'メソッドの抽出'], [B, 'クラス名の変更']]);
const labelOf = (codebase: Codebase) => labels.get(codebase);

describe('operationTimeline', () => {
  it('1手を「操作名・前後の点数・減点の変化」にする', () => {
    // Arrange
    const history: History = { past: [S], future: [] };
    // Act
    const entries = operationTimeline(history, A, score, labelOf);
    // Assert
    expect(entries).toEqual([
      { step: 1, label: 'メソッドの抽出', scoreBefore: 90, scoreAfter: 100, tone: 'better', changes: ['「行数」の減点が1件消えました(+10)'], undone: false },
    ]);
  });

  it('古い順に並べる', () => {
    // Arrange
    const history: History = { past: [S, A], future: [] };
    // Act
    const entries = operationTimeline(history, B, score, labelOf);
    // Assert
    expect(entries.map(({ step, label }) => [step, label])).toEqual([[1, 'メソッドの抽出'], [2, 'クラス名の変更']]);
  });

  it('Undo したあとの手(future 側)は undone になる', () => {
    // Arrange
    const history: History = { past: [S], future: [B] };
    // Act
    const entries = operationTimeline(history, A, score, labelOf);
    // Assert
    expect(entries.map(({ undone }) => undone)).toEqual([false, true]);
  });

  it('減点が変わらない手は tone: null・changes: []', () => {
    // Arrange
    const same = codebaseOf('same');
    const history: History = { past: [A], future: [] };
    // Act
    const [entry] = operationTimeline(history, same, score, () => 'クラス名の変更');
    // Assert
    expect(entry).toMatchObject({ tone: null, changes: [], scoreBefore: 100, scoreAfter: 100 });
  });

  it('0点の下限で合計が動かなくても、減点の増加は worse で出る', () => {
    // Arrange
    const low = codebaseOf('low');
    const lower = codebaseOf('lower');
    const table = new Map<Codebase, Score>([[low, scoreOf([d('line-limit', 10)])], [lower, scoreOf([d('line-limit', 11)])]]);
    // Act
    const [entry] = operationTimeline({ past: [low], future: [] }, lower, (c) => table.get(c) ?? scoreOf([]), labelOf);
    // Assert
    expect(entry).toMatchObject({ scoreBefore: 0, scoreAfter: 0, tone: 'worse', changes: ['「行数」の減点が1件増えました(-10)'] });
  });

  it('操作名が無いスナップショットは「操作」', () => {
    // Arrange
    const history: History = { past: [S], future: [] };
    // Act
    const [entry] = operationTimeline(history, A, score, () => undefined);
    // Assert
    expect(entry.label).toBe('操作');
  });

  it('履歴が空なら空配列', () => {
    // Arrange
    const history: History = { past: [], future: [] };
    // Act
    const entries = operationTimeline(history, S, score, labelOf);
    // Assert
    expect(entries).toEqual([]);
  });

  it('score は道のりのスナップショットごとに1回だけ呼ぶ', () => {
    // Arrange
    const history: History = { past: [S], future: [B] };
    const spy = vi.fn(score);
    // Act
    operationTimeline(history, A, spy, labelOf);
    // Assert
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('引数の History を変更しない', () => {
    // Arrange
    const history: History = { past: [S], future: [B] };
    const snapshot = structuredClone({ past: history.past.length, future: history.future.length });
    // Act
    operationTimeline(history, A, score, labelOf);
    // Assert
    expect({ past: history.past.length, future: history.future.length }).toEqual(snapshot);
    expect(history.past[0]).toBe(S);
  });
});
