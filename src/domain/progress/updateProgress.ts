import type { Progress } from './Progress';

/**
 * ステージの自己ベストスコアを更新する。
 * 初期点(ステージを開いた直後の点数)以下は、まだ何も良くなっていないので記録しない。ただし100点は常に記録する。
 * 今回のスコアが自己ベスト以下なら同じ参照を返す。
 */
export function updateProgress(progress: Progress, stageId: string, score: number, initialScore: number): Progress {
  const best = progress[stageId];
  if (best !== undefined && score <= best) return progress;
  if (score <= initialScore && score < 100) return progress;
  return { ...progress, [stageId]: score };
}
