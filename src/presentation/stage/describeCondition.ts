import type { ClearCondition, WorstMeasures } from '../../domain/stage/clearConditions';
import type { Stage } from '../../domain/stage/Stage';
import { RULE_LABEL } from './describeScore';

function describeRule(condition: ClearCondition, stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>): string {
  if (condition.rule === 'line-limit') {
    const { method, class: codeClass, file } = stage.limits;
    return `行数: メソッド${method}行・クラス${codeClass}行・ファイル${file}行以内`;
  }
  if (condition.rule === 'coupling') return `結合度: 依存先は${stage.dependencyLimit}クラスまで`;
  if (condition.rule === 'responsibility') return `責務の混在: 1クラス${stage.responsibilityLimit}種類まで`;
  return `${RULE_LABEL[condition.rule]}: 0件にする`;
}

function describeStatus(condition: ClearCondition, measures: WorstMeasures): string {
  if (condition.count === 0) return '';
  if (condition.rule === 'line-limit') {
    const values = [
      measures.method === undefined ? undefined : `メソッド最大${measures.method}行`,
      measures.class === undefined ? undefined : `クラス最大${measures.class}行`,
      measures.file === undefined ? undefined : `ファイル最大${measures.file}行`,
    ].filter((value): value is string => value !== undefined);
    return ` (今: ${values.join('・')})`;
  }
  if (condition.rule === 'coupling' && measures.dependencies !== undefined) return ` (今: 最大${measures.dependencies}クラス)`;
  if (condition.rule === 'responsibility' && measures.responsibilities !== undefined) return ` (今: 最大${measures.responsibilities}種類)`;
  return ` (今${condition.count}件)`;
}

export function describeCondition(
  condition: ClearCondition,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
  measures: WorstMeasures,
): string {
  return `${describeRule(condition, stage)}${describeStatus(condition, measures)}`;
}
