import { TRAY_FILE_ID } from '../../domain/blank/tray';
import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import { findLineLimitViolations, type LineLimits, type LineLimitViolation } from '../../domain/scoring/lineLimits';
import type { Score, ScoreRule } from '../../domain/scoring/score';
import { describeTargets } from './describeTargets';
import { RULE_LABEL } from './describeScore';

/** 減点の合計が減った・増えた・同じ(増えたルールと消えたルールが打ち消し合った)。'unchanged' は組み替えたが件数が1つも変わらなかったとき。 */
export type OperationTone = 'better' | 'worse' | 'mixed' | 'unchanged';

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

/** メソッドごとの「持ち主のクラスID|Fragment IDの並び」。 */
function placementOf(codebase: Codebase): Map<string, string> {
  return new Map(allClasses(codebase).flatMap((codeClass) => codeClass.methods.map((method) => [method.id, `${codeClass.id}|${method.fragments.map(({ id }) => id).join(',')}`] as const)));
}

function isRearranged(before: Codebase, after: Codebase): boolean {
  const beforePlacement = placementOf(before);
  const afterPlacement = placementOf(after);
  return beforePlacement.size !== afterPlacement.size || [...beforePlacement].some(([id, placement]) => afterPlacement.get(id) !== placement);
}

function stillOverLimit(before: Codebase, after: Codebase, limits: LineLimits): string | null {
  const beforeViolations = findLineLimitViolations(before, limits);
  const shrunk = findLineLimitViolations(after, limits)
    .flatMap((next) => {
      const previous = beforeViolations.find(({ kind, targetId }) => kind === next.kind && targetId === next.targetId);
      return previous !== undefined && next.lines < previous.lines ? [{ next, previous }] : [];
    })
    // sort は安定なので、同じ減り方なら after の並び(メソッド→クラス→ファイル)のまま
    .sort((a, b) => (b.previous.lines - b.next.lines) - (a.previous.lines - a.next.lines));
  for (const { next, previous } of shrunk) {
    const label = describeTargets(after, targetOf(next)).names.at(0)?.label;
    if (label !== undefined) return `${label} は${previous.lines}行→${next.lines}行に減りましたが、上限${next.limit}行をまだ${next.lines - next.limit}行超えています`;
  }
  return null;
}

function targetOf({ kind, targetId }: LineLimitViolation) {
  return { fileIds: kind === 'file' ? [targetId] : [], classIds: kind === 'class' ? [targetId] : [], methodIds: kind === 'method' ? [targetId] : [] };
}

function remainingDeductions(score: Score): string {
  const remaining = score.deductions.filter(({ count }) => count > 0).map(({ rule, count }) => `「${RULE_LABEL[rule]}」${count}件`);
  const rest = remaining.length > 2 ? [`ほか${remaining.length - 2}項目`] : [];
  return `残っている減点(${[...remaining.slice(0, 2), ...rest].join('・')})は、この一手では減りませんでした`;
}

/**
 * 減点の件数が変わらなかった組み替えに、効いていない理由を1文で付ける。
 * 配置が変わっていない・減点が0のときは null。
 */
export function describeNoEffect(input: { readonly before: Codebase; readonly after: Codebase; readonly limits: LineLimits; readonly score: Score }): OperationResult | null {
  const { before, after, limits, score } = input;
  // 白紙設計は部品を置くたびに配置が変わるので出さない(キャンバスの上を覆って操作の邪魔になる)
  if (before.files.some(({ id }) => id === TRAY_FILE_ID) || !isRearranged(before, after) || score.deducted === 0) return null;
  const reason = stillOverLimit(before, after, limits) ?? remainingDeductions(score);
  return { tone: 'unchanged', lines: [`効いていません: ${reason}`] };
}
