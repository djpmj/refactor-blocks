import type { ClearCondition, WorstMeasures } from '../../domain/stage/clearConditions';
import type { Stage } from '../../domain/stage/Stage';
import { RULE_LABEL } from './describeScore';
import { findClass, type Codebase } from '../../domain/codebase/Codebase';
import { classDependencies, cyclePath } from '../../domain/codebase/dependencies';

const LINE_LABEL = { method: 'メソッド', class: 'クラス', file: 'ファイル' } as const;

export type ConditionDescription = {
  readonly goal: string;
  readonly current: string | null;
};

function describeRule(condition: ClearCondition, stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>): string {
  if (condition.rule === 'line-limit') {
    const kind = condition.lineKind ?? 'method';
    return `${LINE_LABEL[kind]}の行数: 1つ${stage.limits[kind]}行以内`;
  }
  if (condition.rule === 'coupling') return `結合度: 依存先は${stage.dependencyLimit}クラスまで`;
  if (condition.rule === 'responsibility') return `責務の混在: 1クラス${stage.responsibilityLimit}種類まで`;
  if (condition.rule === 'empty') return '空のクラス・ファイル: 0件にする(中身を入れるか、消す)';
  return condition.rule === 'cycle' ? '循環依存: 輪を0組にする' : `${RULE_LABEL[condition.rule]}: 0件にする`;
}

function cycleNames(cycle: readonly string[], codebase: Codebase | undefined, dependencies: ReturnType<typeof classDependencies>): string {
  const nameOf = (id: string): string => codebase === undefined ? id : findClass(codebase, id)?.name ?? id;
  const names = cycle.map(nameOf);
  if (cycle.length === 2) return `${names[0]} ⇄ ${names[1]}`;
  const path = cyclePath(dependencies, cycle);
  return path === undefined ? names.join('・') : `${path.map(nameOf).join(' → ')} → ${nameOf(path[0] ?? '')}`;
}

function describeCycleStatus(measures: WorstMeasures, codebase: Codebase | undefined): string | null {
  if (measures.cycles === undefined) return null;
  const dependencies = codebase === undefined ? [] : classDependencies(codebase);
  const cycles = measures.cycles.map((cycle) => cycleNames(cycle, codebase, dependencies));
  return `今: ${cycles.length}組(${cycles.join(' / ')})`;
}

function describeStatus(condition: ClearCondition, measures: WorstMeasures, codebase?: Codebase): string | null {
  if (condition.count === 0) return null;
  if (condition.rule === 'line-limit') {
    const max = measures[condition.lineKind ?? 'method'];
    return max === undefined ? `今: ${condition.count}件` : `今: 最大${max}行`;
  }
  if (condition.rule === 'coupling' && measures.dependencies !== undefined) return `今: 最大${measures.dependencies}クラス`;
  if (condition.rule === 'responsibility' && measures.responsibilities !== undefined) return `今: 最大${measures.responsibilities}種類`;
  if (condition.rule === 'cycle') return describeCycleStatus(measures, codebase);
  return `今: ${condition.count}件`;
}

export function describeCondition(
  condition: ClearCondition,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
  measures: WorstMeasures,
  codebase?: Codebase,
): ConditionDescription {
  return {
    goal: describeRule(condition, stage),
    current: describeStatus(condition, measures, codebase),
  };
}
