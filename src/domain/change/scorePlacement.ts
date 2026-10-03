import type { ChangeKind } from './ChangeRequest';
import type { Placement } from './measurePlacement';

export type PlacementRule = 'open-closed' | 'mixed-responsibility' | 'scattered' | 'unwired' | 'concrete-base';
export type PlacementDeduction = { readonly rule: PlacementRule; readonly count: number; readonly points: number };
export type PlacementScore = { readonly total: number; readonly deductions: readonly PlacementDeduction[] };
/** 変更依頼1件の実装の、置き方と点数。 */
export type PlacementAssessment = { readonly placement: Placement; readonly score: PlacementScore };

const FULL_SCORE = 100;

const POINTS: Record<PlacementRule, number> = {
  'open-closed': 10,
  'mixed-responsibility': 5,
  scattered: 10,
  unwired: 20,
  'concrete-base': 10,
};

/** 触ってよい既存クラスの数。ルールの変更は責務を持つ1クラスを直すのが正解。機能の追加は触らないのが理想。 */
const ALLOWED_MODIFIED: Record<ChangeKind, number> = { modify: 1, extend: 0 };

/** 置き方の点数。100点から、既存クラスの修正・責務の混在と分散・未接続・具象クラスの継承を引く。 */
export function scorePlacement(placement: Placement, kind: ChangeKind): PlacementScore {
  const counts: Record<PlacementRule, number> = {
    'open-closed': Math.max(0, placement.modifiedClassIds.length - ALLOWED_MODIFIED[kind]),
    'mixed-responsibility': placement.otherResponsibilities,
    scattered: kind === 'modify' ? placement.addedResponsibilityClasses : 0,
    unwired: placement.attachment === 'none' ? 1 : 0,
    'concrete-base': placement.attachment === 'concrete' ? 1 : 0,
  };
  const deductions = (['open-closed', 'mixed-responsibility', 'scattered', 'unwired', 'concrete-base'] as const).map(
    (rule): PlacementDeduction => ({ rule, count: counts[rule], points: counts[rule] * POINTS[rule] }),
  );
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: Math.max(0, FULL_SCORE - deducted), deductions };
}
