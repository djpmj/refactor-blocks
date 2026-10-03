import type { Progress } from './Progress';

/** ステージの自己ベストスコアを更新する。今回のスコアが自己ベスト以下なら同じ参照を返す。 */
export function updateProgress(progress: Progress, stageId: string, score: number): Progress {
  const best = progress[stageId];
  if (best !== undefined && score <= best) return progress;
  return { ...progress, [stageId]: score };
}
