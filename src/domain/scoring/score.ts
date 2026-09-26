import type { Codebase } from '../codebase/Codebase';
import { classDependencies, type ClassDependency } from '../codebase/dependencies';
import type { Stage } from '../stage/Stage';
import { findEncapsulationViolations, findFeatureEnvy, findOpenSetters } from './fieldAccess';
import { findContractViolations, findStubMethods } from './interfaceContracts';
import { findEmptyContainers, findUnusedPrivateMethods } from './leftovers';
import { findLineLimitViolations } from './lineLimits';
import { findLoneSuperclasses } from './loneSuperclass';
import { findResponsibilityViolations } from './responsibilities';
import { countedVisibilityViolations } from './visibility';

export type ScoreRule =
  | 'line-limit'
  | 'coupling'
  | 'cycle'
  | 'responsibility'
  | 'visibility'
  | 'empty'
  | 'unused'
  | 'lone-superclass'
  | 'stub'
  | 'contract'
  | 'feature-envy'
  | 'encapsulation';

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

/**
 * 行数・結合度・循環依存・責務の混在・アクセス制御・空の入れ物・使われていないprivateメソッド・子が1つだけの継承・
 * 空実装・インターフェースの約束違反・Feature Envy・カプセル化の破れの違反1件につき10点を100点から引く。0点より下にはしない。
 */
export function scoreCodebase(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced'>,
): Score {
  const dependencies = classDependencies(codebase);
  const counts: Record<ScoreRule, number> = {
    'line-limit': findLineLimitViolations(codebase, stage.limits).length,
    coupling: findCouplingViolations(dependencies, stage.dependencyLimit).length,
    cycle: dependencies.filter((dependency) => dependency.cyclic).length,
    responsibility: findResponsibilityViolations(codebase, stage.responsibilityLimit).length,
    visibility: countedVisibilityViolations(codebase, stage.visibilityEnforced).length,
    empty: findEmptyContainers(codebase).length,
    unused: findUnusedPrivateMethods(codebase).length,
    'lone-superclass': findLoneSuperclasses(codebase).length,
    stub: findStubMethods(codebase).length,
    contract: findContractViolations(codebase).length,
    'feature-envy': findFeatureEnvy(codebase).length,
    encapsulation: findEncapsulationViolations(codebase).length + findOpenSetters(codebase).length,
  };
  const deductions = (
    [
      'line-limit',
      'coupling',
      'cycle',
      'responsibility',
      'visibility',
      'empty',
      'unused',
      'lone-superclass',
      'stub',
      'contract',
      'feature-envy',
      'encapsulation',
    ] as const
  ).map((rule): ScoreDeduction => ({ rule, count: counts[rule], points: counts[rule] * POINTS_PER_VIOLATION }));
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: Math.max(0, FULL_SCORE - deducted), deductions };
}
