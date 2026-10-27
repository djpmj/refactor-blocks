import type { Stage } from '../stage/Stage';

/** 100点のあとに終える段階。並び順はゲームの流れの順(一覧の表示もこの順)。 */
export type StageMilestone = 'concept-check' | 'change-request';

/** ステージIDごとの、終えた段階。100点かどうかは Progress(自己ベスト)が持つので、ここには持たない。 */
export type Milestones = Readonly<Partial<Record<string, readonly StageMilestone[]>>>;

/** 段階を記録する。すでに記録済みなら同じ参照を返す(保存を省けるように。updateProgress と同じ約束)。 */
export function addMilestone(milestones: Milestones, stageId: string, milestone: StageMilestone): Milestones {
  const done = milestones[stageId] ?? [];
  if (done.includes(milestone)) return milestones;
  return { ...milestones, [stageId]: [...done, milestone] };
}

/**
 * そのステージで、まだ終えていない段階(StageMilestone の並び順)。
 * 理解度チェックが0問のステージは 'concept-check' を、変更依頼が0件のステージは 'change-request' を求めない。
 */
export function remainingMilestones(
  stage: Pick<Stage, 'id' | 'checks' | 'changeRequests'>,
  milestones: Milestones,
): readonly StageMilestone[] {
  const done = milestones[stage.id] ?? [];
  const required: readonly StageMilestone[] = [
    ...(stage.checks.length > 0 ? (['concept-check'] as const) : []),
    ...(stage.changeRequests.length > 0 ? (['change-request'] as const) : []),
  ];
  return required.filter((milestone) => !done.includes(milestone));
}
