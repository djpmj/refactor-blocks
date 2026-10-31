import type { Stage } from '../stage/Stage';
import type { Progress } from './Progress';
import { retryMark, type Assists } from './assists';
import { remainingMilestones, type Milestones, type StageMilestone } from './milestones';

export type StageStatus =
  | { readonly kind: 'not-started' }
  | { readonly kind: 'in-progress' }
  | { readonly kind: 'scored'; readonly best: number }
  /** 自己ベスト100点だが、残りの段階がある(remaining は空でない)。 */
  | { readonly kind: 'perfect'; readonly remaining: readonly StageMilestone[] }
  /** 自己ベスト100点で、残りの段階も無い。 */
  | { readonly kind: 'cleared' };

/** そのステージをクリアしたか(自己ベストが100点)。クリアの定義を変えるときはここだけ直す。 */
export function isStageCleared(stageId: string, progress: Progress): boolean {
  return (progress[stageId] ?? 0) >= 100;
}

/** ステージ一覧に出す状態。 */
export function stageStatus(
  stage: Pick<Stage, 'id' | 'checks' | 'changeRequests'>,
  progress: Progress,
  milestones: Milestones,
  hasDraft: boolean,
): StageStatus {
  const best = progress[stage.id];
  if (best === undefined) return hasDraft ? { kind: 'in-progress' } : { kind: 'not-started' };
  if (!isStageCleared(stage.id, progress)) return { kind: 'scored', best };
  const remaining = remainingMilestones(stage, milestones);
  return remaining.length === 0 ? { kind: 'cleared' } : { kind: 'perfect', remaining };
}

/** 並び順で最初の、クリア(100点かつ残りの段階なし)していないステージ。全部クリアしていれば undefined。 */
export function recommendNextStage(stages: readonly Stage[], progress: Progress, milestones: Milestones): Stage | undefined {
  return stages.find((stage) => stageStatus(stage, progress, milestones, false).kind !== 'cleared');
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

/** 並び順で最初の、自己ベスト100で「もう一度自力で」の印(retryMark)があるステージ。無ければ undefined。 */
export function recommendReviewStage(stages: readonly Stage[], progress: Progress, assists: Assists): Stage | undefined {
  return stages.find((stage) => isStageCleared(stage.id, progress) && retryMark(assists, stage.id) !== undefined);
}

export type Prerequisite = {
  /** 先にやるとよいステージ。 */
  readonly stage: Stage;
  /** そのステージで先に学べる、今のステージの learns(今のステージの learns の並び順)。 */
  readonly concepts: readonly string[];
};

/**
 * 今のステージの learns のそれぞれについて、stages の並び順で今のステージより前にあり、
 * その概念を最初に learns に持つステージを前提とする。そのうち isCleared が false のものを返す。
 * 並びは stages の並び順、同じステージは1回だけ(concepts にまとめる)。今のステージが stages に無ければ空。
 */
export function unclearedPrerequisites(
  stages: readonly Stage[],
  stage: Pick<Stage, 'id' | 'learns'>,
  isCleared: (stageId: string) => boolean,
): readonly Prerequisite[] {
  const currentIndex = stages.findIndex((candidate) => candidate.id === stage.id);
  if (currentIndex < 0) return [];
  const earlier = stages.slice(0, currentIndex);
  return earlier.flatMap((candidate) => {
    if (isCleared(candidate.id)) return [];
    const concepts = stage.learns.filter(
      (concept) => earlier.find((other) => other.learns.includes(concept)) === candidate,
    );
    return concepts.length === 0 ? [] : [{ stage: candidate, concepts }];
  });
}
