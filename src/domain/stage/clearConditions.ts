import type { Codebase } from '../codebase/Codebase';
import { classDependencies, findCycles } from '../codebase/dependencies';
import { findLineLimitViolations, type LineLimitViolation } from '../scoring/lineLimits';
import { findResponsibilityViolations } from '../scoring/responsibilities';
import type { Score, ScoreRule } from '../scoring/score';
import type { Stage } from './Stage';

export type LineKind = 'method' | 'class' | 'file';

export type ClearCondition = {
  readonly rule: ScoreRule;
  readonly count: number;
  /** `rule === 'line-limit'` の行だけ入る。メソッド・クラス・ファイルのどれの行数かを表す */
  readonly lineKind?: LineKind;
};

const LINE_KINDS: readonly LineKind[] = ['method', 'class', 'file'];

export function clearConditionKey(condition: Pick<ClearCondition, 'rule' | 'lineKind'>): string {
  return condition.lineKind === undefined ? condition.rule : `${condition.rule}:${condition.lineKind}`;
}

export const ALWAYS_SHOWN_RULES: readonly ScoreRule[] = ['line-limit', 'coupling', 'responsibility'];

export type WorstMeasures = {
  readonly method?: number;
  readonly class?: number;
  readonly file?: number;
  readonly dependencies?: number;
  readonly responsibilities?: number;
  readonly cycles?: readonly (readonly string[])[];
};

export function clearConditions(
  initial: Score,
  current: Score,
  lineViolations: readonly Pick<LineLimitViolation, 'kind'>[],
): ClearCondition[] {
  const initialCounts = new Map(initial.deductions.map(({ rule, count }) => [rule, count]));
  return current.deductions
    .filter(({ rule, count }) => ALWAYS_SHOWN_RULES.includes(rule) || count > 0 || (initialCounts.get(rule) ?? 0) > 0)
    .flatMap(({ rule, count }): ClearCondition[] => rule === 'line-limit'
      ? LINE_KINDS.map((lineKind) => ({ rule, lineKind, count: lineViolations.filter((item) => item.kind === lineKind).length }))
      : [{ rule, count }]);
}

function maximum(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : Math.max(...values);
}

export function worstMeasures(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
): WorstMeasures {
  const lineViolations = findLineLimitViolations(codebase, stage.limits);
  const dependenciesByClass = new Map<string, number>();
  const graphDependencies = classDependencies(codebase);
  for (const dependency of graphDependencies) {
    dependenciesByClass.set(dependency.from, (dependenciesByClass.get(dependency.from) ?? 0) + 1);
  }
  const dependencies = [...dependenciesByClass.values()].filter((count) => count > stage.dependencyLimit);
  const responsibilities = findResponsibilityViolations(codebase, stage.responsibilityLimit).map((item) => item.responsibilities);
  const method = maximum(lineViolations.filter((item) => item.kind === 'method').map((item) => item.lines));
  const codeClass = maximum(lineViolations.filter((item) => item.kind === 'class').map((item) => item.lines));
  const file = maximum(lineViolations.filter((item) => item.kind === 'file').map((item) => item.lines));
  const dependencyCount = maximum(dependencies);
  const responsibilityCount = maximum(responsibilities);
  const cycles = findCycles(graphDependencies);
  return {
    ...(method === undefined ? {} : { method }),
    ...(codeClass === undefined ? {} : { class: codeClass }),
    ...(file === undefined ? {} : { file }),
    ...(dependencyCount === undefined ? {} : { dependencies: dependencyCount }),
    ...(responsibilityCount === undefined ? {} : { responsibilities: responsibilityCount }),
    ...(cycles.length === 0 ? {} : { cycles }),
  };
}
