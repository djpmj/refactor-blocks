import { changeKindOf } from '../../domain/change/ChangeRequest';
import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { scoreCodebase } from '../../domain/scoring/score';
import { sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage, StageLevel } from '../../domain/stage/Stage';
import { RULE_LABEL } from '../../presentation/stage/describeScore';

export type StageReportRow = {
  readonly stageId: string;
  readonly title: string;
  readonly level: StageLevel;
  readonly initialScore: number;
  readonly topDeductions: readonly string[];
  readonly steps: number | undefined;
  readonly operations: readonly string[];
  readonly files: number;
  readonly classes: number;
  readonly methods: number;
  readonly longestMethodLines: number;
  readonly modifyRequests: number;
  readonly extendRequests: number;
  readonly warnings: readonly string[];
};

type Solutions = Partial<Record<string, readonly SolutionStep[]>>;

const LEVELS: readonly StageLevel[] = ['tutorial', 'beginner', 'intermediate', 'advanced'];
const LEVEL_LABEL: Record<StageLevel, string> = { tutorial: 'チュートリアル', beginner: '初級', intermediate: '中級', advanced: '上級' };

// ponytail: 目安は感覚で決めた初期値。プレイの感想や意見が集まったら見直す
const HIGH_INITIAL_SCORE = 80;
const MAX_STEPS: Record<StageLevel, number> = { tutorial: 3, beginner: 8, intermediate: 15, advanced: 25 };
const TOP_DEDUCTION_COUNT = 3;

const OPERATION_LABEL: Record<string, string> = {
  extract: '抽出',
  move: '移動',
  merge: '統合',
  deleteMethod: '削除',
  moveField: 'フィールド移動',
  changeVisibility: '可視性',
  addFile: 'ファイル追加',
  deleteFile: '削除',
  addClass: 'クラス追加',
  moveClass: 'クラス移動',
  setSuperclass: '継承',
  addInterface: '実装',
  removeInterface: '実装',
  renameClass: '名前変更',
};

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

function operationsOf(steps: readonly SolutionStep[]): string[] {
  const labels = steps.map((step) => {
    const key = Object.keys(step)[0] ?? '';
    return OPERATION_LABEL[key] ?? key;
  });
  return [...new Set(labels)];
}

function topDeductionsOf(stage: Stage): string[] {
  return scoreCodebase(stage.codebase, stage)
    .deductions.filter((deduction) => deduction.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_DEDUCTION_COUNT)
    .map((deduction) => `${RULE_LABEL[deduction.rule]} -${deduction.points}`);
}

function sizeOf(codebase: Codebase) {
  const classes = allClasses(codebase);
  const methods = classes.flatMap((codeClass) => codeClass.methods);
  return { files: codebase.files.length, classes: classes.length, methods: methods.length, longest: Math.max(0, ...methods.map(methodLines)) };
}

function levelMedians(stages: readonly Stage[], solutions: Solutions): Map<StageLevel, number> {
  const medians = new Map<StageLevel, number>();
  for (const level of LEVELS) {
    const steps = stages.flatMap((stage) => {
      const solution = solutions[stage.id];
      return stage.level === level && solution !== undefined ? [solution.length] : [];
    });
    const value = median(steps);
    if (value !== undefined) medians.set(level, value);
  }
  return medians;
}

/** 手数の中央値が、手数のある1つ前のレベルより小さいレベル。 */
function easierThanPreviousLevels(medians: ReadonlyMap<StageLevel, number>): Set<StageLevel> {
  const easier = new Set<StageLevel>();
  let previous: number | undefined;
  for (const level of LEVELS) {
    const current = medians.get(level);
    if (current === undefined) continue;
    if (previous !== undefined && current < previous) easier.add(level);
    previous = current;
  }
  return easier;
}

function warningsOf(stage: Stage, initialScore: number, steps: number | undefined, isLevelFirstOfEasier: boolean): string[] {
  const warnings: string[] = [];
  if (initialScore >= HIGH_INITIAL_SCORE) warnings.push('初期点が高い');
  if (steps !== undefined && steps > MAX_STEPS[stage.level]) warnings.push('手数が多い');
  if (isLevelFirstOfEasier) warnings.push('レベルの中央値の手数が前のレベルより少ない');
  if (steps === undefined) warnings.push('解答が未登録');
  if (!stage.changeRequests.some((request) => changeKindOf(request) === 'modify')) warnings.push('依頼が機能追加だけ');
  return warnings;
}

export function stageReportRows(stages: readonly Stage[], solutions: Solutions = sampleAnswerSteps): readonly StageReportRow[] {
  const easierLevels = easierThanPreviousLevels(levelMedians(stages, solutions));
  const seenLevels = new Set<StageLevel>();
  return stages.map((stage): StageReportRow => {
    const solution = solutions[stage.id];
    const initialScore = scoreCodebase(stage.codebase, stage).total;
    const size = sizeOf(stage.codebase);
    const isLevelFirst = !seenLevels.has(stage.level);
    seenLevels.add(stage.level);
    const modifyRequests = stage.changeRequests.filter((request) => changeKindOf(request) === 'modify').length;
    return {
      stageId: stage.id,
      title: stage.title,
      level: stage.level,
      initialScore,
      topDeductions: topDeductionsOf(stage),
      steps: solution?.length,
      operations: operationsOf(solution ?? []),
      files: size.files,
      classes: size.classes,
      methods: size.methods,
      longestMethodLines: size.longest,
      modifyRequests,
      extendRequests: stage.changeRequests.length - modifyRequests,
      warnings: warningsOf(stage, initialScore, solution?.length, isLevelFirst && easierLevels.has(stage.level)),
    };
  });
}

function cell(text: string): string {
  return text.replaceAll('|', '\\|');
}

function tableRow(cells: readonly string[]): string {
  return `| ${cells.map(cell).join(' | ')} |`;
}

function rowCells(row: StageReportRow): string[] {
  return [
    row.title,
    LEVEL_LABEL[row.level],
    String(row.initialScore),
    row.topDeductions.join('、'),
    row.steps === undefined ? '-' : String(row.steps),
    row.operations.join('、'),
    `${row.files}ファイル / ${row.classes}クラス / ${row.methods}メソッド`,
    String(row.longestMethodLines),
    `ルール変更 ${row.modifyRequests} / 機能追加 ${row.extendRequests}`,
    row.warnings.join('、'),
  ];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function summaryLines(rows: readonly StageReportRow[]): string[] {
  const lines = [tableRow(['レベル', 'ステージ数', '手数の中央値', '初期点の平均']), tableRow(['---', '---', '---', '---'])];
  for (const level of LEVELS) {
    const inLevel = rows.filter((row) => row.level === level);
    if (inLevel.length === 0) continue;
    const steps = median(inLevel.flatMap((row) => (row.steps === undefined ? [] : [row.steps])));
    const average = inLevel.reduce((sum, row) => sum + row.initialScore, 0) / inLevel.length;
    lines.push(tableRow([LEVEL_LABEL[level], String(inLevel.length), steps === undefined ? '-' : String(steps), String(round1(average))]));
  }
  return lines;
}

export function renderStageReport(rows: readonly StageReportRow[]): string {
  const header = ['ステージ', 'レベル', '初期点', '主な減点', '手数', '使う操作', '規模', '最長メソッド', '依頼', '注意'];
  return [
    '<!-- このファイルは npm run stage-report で生成する。手で編集しない -->',
    '',
    '# ステージ一覧表',
    '',
    tableRow(header),
    tableRow(header.map(() => '---')),
    ...rows.map((row) => tableRow(rowCells(row))),
    '',
    '## レベルごとの集計',
    '',
    ...summaryLines(rows),
    '',
  ].join('\n');
}
