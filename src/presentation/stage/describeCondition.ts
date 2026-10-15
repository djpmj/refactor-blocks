import type { ClearCondition, WorstMeasures } from '../../domain/stage/clearConditions';
import type { Stage } from '../../domain/stage/Stage';
import { RULE_LABEL } from './describeScore';
import { findClass, type Codebase } from '../../domain/codebase/Codebase';
import { classDependencies, cyclePath } from '../../domain/codebase/dependencies';

export type ConditionDescription = {
  readonly goal: string;
  readonly current: string | null;
};

function describeRule(condition: ClearCondition, stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>): string {
  if (condition.rule === 'line-limit') {
    const { method, class: codeClass, file } = stage.limits;
    return `行数: メソッド${method}行・クラス${codeClass}行・ファイル${file}行以内`;
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
    const values = [
      measures.method === undefined ? undefined : `メソッド最大${measures.method}行`,
      measures.class === undefined ? undefined : `クラス最大${measures.class}行`,
      measures.file === undefined ? undefined : `ファイル最大${measures.file}行`,
    ].filter((value): value is string => value !== undefined);
    return `今: ${values.join('・')}`;
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
