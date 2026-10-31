import type { Codebase } from '../../domain/codebase/Codebase';
import type { History } from '../../domain/codebase/history';
import type { Score } from '../../domain/scoring/score';
import { describeOperationResult, describeRuleChanges, type OperationTone } from './describeOperationResult';

export type OperationTimelineEntry = {
  /** 1始まりの手の番号(道のりの位置)。 */
  readonly step: number;
  /** 操作名。記録が無ければ「操作」。 */
  readonly label: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  /** 減点が何も変わらなかった手は null。 */
  readonly tone: OperationTone | null;
  /** describeRuleChanges の文(切り詰めない)。 */
  readonly changes: readonly string[];
  /** 取り消し済み(future 側)の手なら true。 */
  readonly undone: boolean;
};

/**
 * 道のり [...past, current, ...future] の隣り合う2つを1手として、古い順に並べる。
 * score は各スナップショットに1回だけ呼ぶ。
 */
// ponytail: 開くたびに道のりの長さ分 scoreCodebase を呼ぶ。数百手で重くなったらスナップショットごとの採点を WeakMap でキャッシュする
export function operationTimeline(
  history: History,
  current: Codebase,
  score: (codebase: Codebase) => Score,
  labelOf: (codebase: Codebase) => string | undefined,
): readonly OperationTimelineEntry[] {
  const path = [...history.past, current, ...history.future];
  const scores = path.map(score);
  return path.slice(1).map((codebase, index) => {
    const before = scores[index];
    const after = scores[index + 1];
    return {
      step: index + 1,
      label: labelOf(codebase) ?? '操作',
      scoreBefore: before.total,
      scoreAfter: after.total,
      tone: describeOperationResult(before, after)?.tone ?? null,
      changes: describeRuleChanges(before, after),
      undone: index + 1 > history.past.length,
    };
  });
}
