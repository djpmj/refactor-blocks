import type { ChangeImpact } from './measureChange';

export type ChangeRule = 'shotgun' | 'ripple' | 'entangled' | 'limit-break';

export type ChangeDeduction = {
  readonly rule: ChangeRule;
  readonly count: number;
  readonly points: number;
};

export type ChangeScore = {
  readonly total: number;
  readonly deductions: readonly ChangeDeduction[];
};

/** 変更依頼を1つのコードに当てた影響と、その点数。 */
export type ChangeAssessment = { readonly impact: ChangeImpact; readonly score: ChangeScore };

const FULL_SCORE = 100;

const POINTS: Record<ChangeRule, number> = {
  shotgun: 10,
  ripple: 5,
  entangled: 5,
  'limit-break': 10,
};

/**
 * 変更依頼1件のコスト点数。100点から、散らばり・波及・巻き込み・上限超えを引く。
 */
export function scoreChange(impact: ChangeImpact): ChangeScore {
  const counts: Record<ChangeRule, number> = {
    shotgun: Math.max(0, impact.classesTouched - 1),
    ripple: impact.rippleClasses.length,
    entangled: impact.mixedResponsibilities,
    'limit-break': impact.overLimitTouched,
  };
  const deductions = (['shotgun', 'ripple', 'entangled', 'limit-break'] as const).map(
    (rule): ChangeDeduction => ({ rule, count: counts[rule], points: counts[rule] * POINTS[rule] }),
  );
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: Math.max(0, FULL_SCORE - deducted), deductions };
}

/** 全依頼の点数の平均(四捨五入)。ステージの変更容易性スコアになる。 */
export function averageScore(scores: readonly Pick<ChangeScore, 'total'>[]): number {
  if (scores.length === 0) return FULL_SCORE;
  return Math.round(scores.reduce((sum, score) => sum + score.total, 0) / scores.length);
}
