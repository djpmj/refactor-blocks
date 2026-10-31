import type { Score, ScoreRule } from '../../domain/scoring/score';
import { RULE_LABEL } from './describeScore';

/** 減点の合計が減った・増えた・同じ(増えたルールと消えたルールが打ち消し合った)。 */
export type OperationTone = 'better' | 'worse' | 'mixed';

export type OperationResult = {
  readonly tone: OperationTone;
  /** 1〜2行。 */
  readonly lines: readonly string[];
  readonly nextStep?: string;
};

type RuleChange = { readonly rule: ScoreRule; readonly diff: number; readonly points: number };

function changesOf(before: Score, after: Score): RuleChange[] {
  const of = (score: Score, rule: ScoreRule) => score.deductions.find((deduction) => deduction.rule === rule) ?? { count: 0, points: 0 };
  const rules = [...new Set([...after.deductions, ...before.deductions].map((deduction) => deduction.rule))];
  return rules
    .map((rule) => ({ rule, diff: of(after, rule).count - of(before, rule).count, points: of(after, rule).points - of(before, rule).points }))
    .filter(({ diff }) => diff !== 0);
}

function sentenceOf({ rule, diff, points }: RuleChange): string {
  return diff > 0
    ? `「${RULE_LABEL[rule]}」の減点が${diff}件増えました(-${points})`
    : `「${RULE_LABEL[rule]}」の減点が${-diff}件消えました(+${-points})`;
}

function toneOf(deductedBefore: number, deductedAfter: number): OperationTone {
  if (deductedAfter < deductedBefore) return 'better';
  return deductedAfter > deductedBefore ? 'worse' : 'mixed';
}

/** 前後の採点で件数が変わったルールを、増えたもの→消えたものの順に、すべて文にする。変化がなければ空配列。 */
export function describeRuleChanges(before: Score, after: Score): readonly string[] {
  const changes = changesOf(before, after);
  // 増えたものを先に。sort は安定なので、同点なら after.deductions の並びのまま
  const ordered = [...changes.filter(({ diff }) => diff > 0).sort((a, b) => b.points - a.points), ...changes.filter(({ diff }) => diff < 0).sort((a, b) => a.points - b.points)];
  return ordered.map(sentenceOf);
}

/** 操作の前後の採点から、増えた減点・消えた減点を文にする(2行まで)。どのルールも件数が変わらなければ null。 */
export function describeOperationResult(before: Score, after: Score): OperationResult | null {
  const sentences = describeRuleChanges(before, after);
  if (sentences.length === 0) return null;
  const lines = sentences.length <= 2 ? sentences : [sentences[0], `ほかに${sentences.length - 1}項目の減点も変わりました(「減点の内訳」で確認できます)`];
  return { tone: toneOf(before.deducted, after.deducted), lines };
}
