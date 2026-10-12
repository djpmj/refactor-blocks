import { describe, expect, it } from 'vitest';
import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { Placement } from '../../domain/change/measurePlacement';
import { describeRumorPayoff } from './describeRumorPayoff';

const codebase: Codebase = { files: [{ id: 'f', path: 'f', classes: [{ id: 'a', name: '請求書', methods: [] }, { id: 'b', name: '履歴', methods: [] }] }] };
function outcome(score: number, modifiedClassIds: readonly string[], rumor = true): ChangeOutcome {
  return {
    request: { id: 'r', title: '変更', description: '', responsibility: 'r', linesPerSite: 1, ...(rumor ? { rumor: { from: '佐藤さん', text: '何か変わるらしい' } } : {}) },
    placement: { score: { total: score, deductions: [] }, placement: { partClassId: 'part', partClassName: '部品', modifiedClassIds, otherResponsibilities: 0, addedResponsibilityClasses: 0, attachment: 'existing-class' } satisfies Placement },
    sample: undefined, current: null, initial: null,
  };
}

describe('describeRumorPayoff', () => {
  it('returns undefined without a rumor', () => expect(describeRumorPayoff(outcome(100, [], false), codebase)).toBeUndefined());
  it('describes a perfect placement without modifying existing classes', () => expect(describeRumorPayoff(outcome(100, []), codebase)).toContain('既存のクラスを書き換えずに済みました'));
  it('names one modified class for a perfect placement', () => expect(describeRumorPayoff(outcome(100, ['a']), codebase)).toContain('直したのは 請求書 だけで済みました'));
  it('names multiple modified classes when placement loses points', () => expect(describeRumorPayoff(outcome(80, ['a', 'b']), codebase)).toContain('既存の 2 クラス(請求書・履歴)'));
  it('explains a low score with only one changed class', () => expect(describeRumorPayoff(outcome(90, ['a']), codebase)).toContain('置き場所に無理が出ました'));
});
