/** ステージIDごとの自己ベストスコア(0〜100)。 */
export type Progress = Readonly<Partial<Record<string, number>>>;

/** 外から来た値が `Progress`(文字列キー→0〜100の数値)の形をしているか確かめる。信頼境界の入力検証。 */
export function isProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((score) => typeof score === 'number' && score >= 0 && score <= 100);
}
