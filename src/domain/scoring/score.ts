import type { Codebase } from '../codebase/Codebase';
import { classDependencies, type ClassDependency } from '../codebase/dependencies';
import type { Stage } from '../stage/Stage';
import { findLineLimitViolations } from './lineLimits';
import { findResponsibilityViolations } from './responsibilities';

export type ScoreRule = 'line-limit' | 'coupling' | 'cycle' | 'responsibility';

export type ScoreDeduction = {
  readonly rule: ScoreRule;
  readonly count: number;
  readonly points: number;
};

export type Score = {
  readonly total: number;
  readonly deductions: readonly ScoreDeduction[];
};

const FULL_SCORE = 100;
export const POINTS_PER_VIOLATION = 10;

/** 依存先が上限より多いクラスのIDを返す。 */
export function findCouplingViolations(dependencies: readonly ClassDependency[], dependencyLimit: number): string[] {
  const countByClass = new Map<string, number>();
  for (const { from } of dependencies) countByClass.set(from, (countByClass.get(from) ?? 0) + 1);
  return [...countByClass].filter(([, count]) => count > dependencyLimit).map(([classId]) => classId);
}

/** 行数・結合度・循環依存・責務の混在の違反1件につき10点を100点から引く。0点より下にはしない。 */
export function scoreCodebase(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
): Score {
  const dependencies = classDependencies(codebase);
  const counts: Record<ScoreRule, number> = {
    'line-limit': findLineLimitViolations(codebase, stage.limits).length,
    coupling: findCouplingViolations(dependencies, stage.dependencyLimit).length,
    cycle: dependencies.filter((dependency) => dependency.cyclic).length,
    responsibility: findResponsibilityViolations(codebase, stage.responsibilityLimit).length,
  };
  const deductions = (['line-limit', 'coupling', 'cycle', 'responsibility'] as const).map(
    (rule): ScoreDeduction => ({ rule, count: counts[rule], points: counts[rule] * POINTS_PER_VIOLATION }),
  );
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: Math.max(0, FULL_SCORE - deducted), deductions };
}
