import type { Stage } from '../stage/Stage';
import type { Progress } from './Progress';

export type StageStatus =
  | { readonly kind: 'not-started' }
  | { readonly kind: 'in-progress' }
  | { readonly kind: 'scored'; readonly best: number }
  | { readonly kind: 'cleared' };

/** そのステージをクリアしたか(自己ベストが100点)。クリアの定義を変えるときはここだけ直す。 */
export function isStageCleared(stageId: string, progress: Progress): boolean {
  return (progress[stageId] ?? 0) >= 100;
}

/** ステージ一覧に出す状態。 */
export function stageStatus(stageId: string, progress: Progress, hasDraft: boolean): StageStatus {
  const best = progress[stageId];
  if (best === undefined) return hasDraft ? { kind: 'in-progress' } : { kind: 'not-started' };
  return isStageCleared(stageId, progress) ? { kind: 'cleared' } : { kind: 'scored', best };
}

/** 並び順で最初の、クリアしていない(自己ベストが100でない)ステージ。全部クリアしていれば undefined。 */
export function recommendNextStage(stages: readonly Stage[], progress: Progress): Stage | undefined {
  return stages.find((stage) => !isStageCleared(stage.id, progress));
}

/** 1つの学べること(概念)の習得状況。 */
export type ConceptMastery = {
  /** `Stage.learns` の文字列そのまま(ステージ一覧のタグ表記と同じ)。 */
  readonly concept: string;
  /** この概念を learns に持つステージの数。 */
  readonly total: number;
  /** そのうちクリアした数。 */
  readonly cleared: number;
  /** クリアしていないステージ。`stages` の並び順。 */
  readonly remaining: readonly Stage[];
};

/**
 * ステージの learns から、概念ごとの習得状況を作る。
 * 並びは、その概念が `stages` の並び順で最初に出てくる順(=難易度順に初めて学ぶ順)。
 */
export function conceptMastery(
  stages: readonly Stage[],
  isCleared: (stageId: string) => boolean,
): readonly ConceptMastery[] {
  const concepts = [...new Set(stages.flatMap((stage) => stage.learns))];
  return concepts.map((concept) => {
    const related = stages.filter((stage) => stage.learns.includes(concept));
    const remaining = related.filter((stage) => !isCleared(stage.id));
    return { concept, total: related.length, cleared: related.length - remaining.length, remaining };
  });
}
