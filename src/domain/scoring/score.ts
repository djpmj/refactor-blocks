import type { Codebase } from '../codebase/Codebase';
import { classDependencies, type ClassDependency } from '../codebase/dependencies';
import type { Stage } from '../stage/Stage';
import { findLineLimitViolations } from './lineLimits';

export type ScoreRule = 'line-limit' | 'coupling' | 'cycle';

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
const POINTS_PER_VIOLATION = 10;

function countCouplingViolations(dependencies: readonly ClassDependency[], dependencyLimit: number): number {
  const countByClass = new Map<string, number>();
  for (const { from } of dependencies) countByClass.set(from, (countByClass.get(from) ?? 0) + 1);
  return [...countByClass.values()].filter((count) => count > dependencyLimit).length;
}

/** 行数・結合度・循環依存の違反1件につき10点を100点から引く。0点より下にはしない。 */
export function scoreCodebase(codebase: Codebase, stage: Pick<Stage, 'limits' | 'dependencyLimit'>): Score {
  const dependencies = classDependencies(codebase);
  const counts: Record<ScoreRule, number> = {
    'line-limit': findLineLimitViolations(codebase, stage.limits).length,
    coupling: countCouplingViolations(dependencies, stage.dependencyLimit),
    cycle: dependencies.filter((dependency) => dependency.cyclic).length,
  };
  const deductions = (['line-limit', 'coupling', 'cycle'] as const).map(
    (rule): ScoreDeduction => ({ rule, count: counts[rule], points: counts[rule] * POINTS_PER_VIOLATION }),
  );
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: Math.max(0, FULL_SCORE - deducted), deductions };
}
