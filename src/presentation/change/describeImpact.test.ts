import { describe, expect, it } from 'vitest';
import type { ChangeImpact } from '../../domain/change/changeImpact';
import { describeImpact } from './describeImpact';

const impact: ChangeImpact = {
  before: { sites: [{ methodId: 'before', className: 'Report', methodName: 'printMonthlyReport', lines: 54 }], readLines: 54 },
  after: { sites: [{ methodId: 'after', className: 'Sales', methodName: 'aggregateSales', lines: 19 }], readLines: 19 },
  moves: [{ kind: 'extracted', fragmentLabels: ['集計'], from: [{ methodId: 'before', className: 'Report', methodName: 'printMonthlyReport', lines: 54 }], to: { methodId: 'after', className: 'Sales', methodName: 'aggregateSales', lines: 19 } }],
  verdict: 'better',
};

describe('describeImpact', () => {
  it('抽出の因果と変更結果を説明する', () => {
    // Arrange / Act
    const result = describeImpact(impact, 0);

    // Assert
    expect(result).toEqual([
      'あなたが「集計」を Report.printMonthlyReport() から Sales.aggregateSales() に切り出した',
      'だから、この変更で直す場所は 1 か所のまま、読む量は 54 行 → 19 行 になった',
    ]);
  });

  it('冒頭の直し忘れを追加し、same・worseを促す文章にする', () => {
    // Arrange
    const source = impact.before.sites[0];
    const move = impact.moves[0];
    const gathered = { ...impact, moves: [{ ...move, kind: 'gathered' as const, from: [source, source] }], verdict: 'better' as const };
    const same = { ...impact, verdict: 'same' as const };
    const worse = { ...impact, verdict: 'worse' as const };

    // Act
    const gatheredLines = describeImpact(gathered, 2);
    const sameLines = describeImpact(same, null);
    const worseLines = describeImpact(worse, null);

    // Assert
    expect(gatheredLines).toHaveLength(3);
    expect(gatheredLines[0]).toContain('2 か所に散らばっていた');
    expect(gatheredLines[2]).toBe('冒頭では 2 か所を直し忘れて本番バグになったが、今回は直し忘れなし');
    expect(sameLines.at(-1)).toContain('変わらなかった');
    expect(worseLines.at(-1)).toContain('増えた');
    expect(describeImpact(impact, null)).toHaveLength(2);
  });

  it('移動の文章を出し、追えない改善なら結果の行だけを出す', () => {
    // Arrange
    const move = impact.moves[0];
    const destination = impact.after.sites[0];
    const moved: ChangeImpact = { ...impact, moves: [{ ...move, kind: 'moved', to: { ...destination, className: 'TaxCalculator', methodName: 'calculate' } }] };
    const untracked = { ...impact, moves: [] };

    // Act
    const movedLines = describeImpact(moved, null);
    const untrackedLines = describeImpact(untracked, null);

    // Assert
    expect(movedLines[0]).toBe('あなたが calculate() を TaxCalculator に移した');
    expect(untrackedLines).toHaveLength(1);
  });
});
