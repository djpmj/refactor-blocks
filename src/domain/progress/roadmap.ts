import type { Stage } from '../stage/Stage';
import type { Progress } from './Progress';

export type StageStatus =
  | { readonly kind: 'not-started' }
  | { readonly kind: 'in-progress' }
  | { readonly kind: 'scored'; readonly best: number }
  | { readonly kind: 'cleared' };

/** ステージ一覧に出す状態。 */
export function stageStatus(stageId: string, progress: Progress, hasDraft: boolean): StageStatus {
  const best = progress[stageId];
  if (best === undefined) return hasDraft ? { kind: 'in-progress' } : { kind: 'not-started' };
  return best >= 100 ? { kind: 'cleared' } : { kind: 'scored', best };
}

/** 並び順で最初の、クリアしていない(自己ベストが100でない)ステージ。全部クリアしていれば undefined。 */
export function recommendNextStage(stages: readonly Stage[], progress: Progress): Stage | undefined {
  return stages.find((stage) => (progress[stage.id] ?? 0) < 100);
}
