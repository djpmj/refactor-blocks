import { describe, expect, it } from 'vitest';
import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';
import type { Placement } from '../../domain/change/measurePlacement';
import { describeBoss } from './describeBoss';

function outcome(now: number, before: number | undefined): ChangeOutcome {
  return {
    request: { id: 'r', title: '変更', description: '', responsibility: 'r', linesPerSite: 1, boss: true },
    placement: { score: { total: now, deductions: [] }, placement: { partClassId: 'part', partClassName: '部品', modifiedClassIds: [], otherResponsibilities: 0, addedResponsibilityClasses: 0, attachment: 'existing-class' } satisfies Placement },
    sample: undefined, current: null, initial: null,
    ...(before === undefined ? {} : { bossCounterfactual: { score: before, modifiedClassNames: [], overLimitClassNames: [] } }),
  };
}

describe('describeBoss', () => {
  it('bossCounterfactual が無ければ undefined', () => {
    // Arrange / Act
    const result = describeBoss(outcome(100, undefined), '税の計算');

    // Assert
    expect(result).toBeUndefined();
  });

  it('前より高い点で、openingTitle があれば冒頭の処理を挙げる', () => {
    // Arrange / Act
    const result = describeBoss(outcome(100, 60), '軽減税率の対象を増やして');

    // Assert
    expect(result).toBe('冒頭の「軽減税率の対象を増やして」の処理を切り出しておいたおかげで、鬼の変更も 100点で入れられた(組み替える前なら最善でも 60点)');
  });

  it('openingTitle が無ければ「組み替えておいたおかげで」', () => {
    // Arrange / Act
    const result = describeBoss(outcome(100, 60), undefined);

    // Assert
    expect(result).toBe('組み替えておいたおかげで、鬼の変更も 100点で入れられた(組み替える前なら最善でも 60点)');
  });

  it('前と同じ点なら見直しを促す', () => {
    // Arrange / Act
    const result = describeBoss(outcome(60, 60), '税');

    // Assert
    expect(result).toBe('この設計では、鬼の変更は組み替える前と同じくらい大変だった。変わる場所を切り出せているか、見直してみよう');
  });
});
