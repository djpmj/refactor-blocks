import { describe, expect, it } from 'vitest';
import { measureChange } from '../../domain/change/measureChange';
import { averageScore, scoreChange } from '../../domain/change/scoreChange';
import { type Codebase } from '../../domain/codebase/Codebase';
import { scoreCodebase } from '../../domain/scoring/score';
import type { Result } from '../../domain/shared/Result';
import { applySolutionSteps, sampleAnswerCodebase, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { stages } from './stageCatalog';

function stageById(id: string): Stage {
  const stage = stages.find((candidate) => candidate.id === id);
  if (stage === undefined) throw new Error(`ステージ ${id} がありません`);
  return stage;
}

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
  return result.value;
}

function changeReadiness(stage: Stage, codebase: Codebase): number {
  return averageScore(stage.changeRequests.map((request) => scoreChange(unwrap(measureChange(codebase, request, stage.limits)))));
}

const taxStage = stageById('intermediate-volatile-tax');
const formatStage = stageById('intermediate-volatile-format');

/** 税と整形の両方を、何でも入ったヘルパー1クラスへ移す解き方。 */
const helperSteps: readonly SolutionStep[] = [
  { extract: { from: 'generateMonthlyReport', fragmentIds: ['frag-monthly-tax'], name: 'calculateMonthlyTax' } },
  { extract: { from: 'generateMonthlyReport', fragmentIds: ['frag-monthly-format'], name: 'formatMonthlyReport' } },
  { extract: { from: 'generateQuarterlyReport', fragmentIds: ['frag-quarterly-tax'], name: 'calculateQuarterlyTax' } },
  { extract: { from: 'generateQuarterlyReport', fragmentIds: ['frag-quarterly-format'], name: 'formatQuarterlyReport' } },
  { addClass: { name: 'ReportHelper', file: 'src/report/SalesReportService.ts' } },
  { move: { method: 'calculateMonthlyTax', toClass: 'ReportHelper' } },
  { move: { method: 'calculateQuarterlyTax', toClass: 'ReportHelper' } },
  { move: { method: 'formatMonthlyReport', toClass: 'ReportHelper' } },
  { move: { method: 'formatQuarterlyReport', toClass: 'ReportHelper' } },
];

/** 各ステージでよく変わる処理と、そうでない処理(抽出するときのIDと名前)。 */
const axes = {
  tax: { monthly: ['frag-monthly-tax', 'calculateMonthlyTax'], quarterly: ['frag-quarterly-tax', 'calculateQuarterlyTax'] },
  format: { monthly: ['frag-monthly-format', 'formatMonthlyReport'], quarterly: ['frag-quarterly-format', 'formatQuarterlyReport'] },
} as const;

const volatileCases = [
  { stage: taxStage, stable: axes.format },
  { stage: formatStage, stable: axes.tax },
];

/** よく変わる処理だけを generate* に残し、集計と変わらない方の処理をメソッドへ抽出する。 */
function extractAllButVolatile(stable: (typeof axes)[keyof typeof axes]): SolutionStep[] {
  return [
    { extract: { from: 'generateMonthlyReport', fragmentIds: ['frag-monthly-aggregate'], name: 'aggregateMonthlySales' } },
    { extract: { from: 'generateMonthlyReport', fragmentIds: [stable.monthly[0]], name: stable.monthly[1] } },
    { extract: { from: 'generateQuarterlyReport', fragmentIds: ['frag-quarterly-aggregate'], name: 'aggregateQuarterlySales' } },
    { extract: { from: 'generateQuarterlyReport', fragmentIds: [stable.quarterly[0]], name: stable.quarterly[1] } },
  ];
}

/** よく変わる処理だけを SalesReportService に残し、ほかを新しいクラスへ出す解き方(もう1つの正解)。 */
function keepVolatileSteps(stable: (typeof axes)[keyof typeof axes]): SolutionStep[] {
  return [
    ...extractAllButVolatile(stable),
    { addClass: { name: 'ReportBuilder', file: 'src/report/SalesReportService.ts' } },
    { move: { method: 'aggregateMonthlySales', toClass: 'ReportBuilder' } },
    { move: { method: stable.monthly[1], toClass: 'ReportBuilder' } },
    { move: { method: 'aggregateQuarterlySales', toClass: 'ReportBuilder' } },
    { move: { method: stable.quarterly[1], toClass: 'ReportBuilder' } },
  ];
}

/** よく変わる処理を、既存のHTTP入口である ReportController へ持ち上げる案。 */
function liftToControllerSteps(stable: (typeof axes)[keyof typeof axes]): SolutionStep[] {
  return [
    ...extractAllButVolatile(stable),
    { move: { method: 'generateMonthlyReport', toClass: 'ReportController' } },
    { move: { method: 'generateQuarterlyReport', toClass: 'ReportController' } },
  ];
}

describe('中級4・中級5(変わる場所しだいで正解が変わる)', () => {
  it('2ステージの初期コードは同じ', () => {
    // Arrange
    const { codebase } = taxStage;

    // Act
    const other = formatStage.codebase;

    // Assert
    expect(other).toEqual(codebase);
  });

  it.each([taxStage, formatStage])('$title: 税を移す解答も整形を移す解答も、構造の採点では100点になる', (stage) => {
    // Arrange
    const solutions = [sampleAnswerCodebase(taxStage), sampleAnswerCodebase(formatStage)];

    // Act
    const totals = solutions.map((solved) => scoreCodebase(solved, stage).total);

    // Assert
    expect(totals).toEqual([100, 100]);
  });

  it('中級4では、税を移した解答のほうが整形を移した解答より変更容易性スコアが高い', () => {
    // Arrange
    const taxSplit = sampleAnswerCodebase(taxStage);
    const formatSplit = sampleAnswerCodebase(formatStage);

    // Act
    const right = changeReadiness(taxStage, taxSplit);
    const wrong = changeReadiness(taxStage, formatSplit);

    // Assert
    expect(right).toBeGreaterThan(wrong);
  });

  it('中級5では、整形を移した解答のほうが税を移した解答より変更容易性スコアが高い', () => {
    // Arrange
    const taxSplit = sampleAnswerCodebase(taxStage);
    const formatSplit = sampleAnswerCodebase(formatStage);

    // Act
    const right = changeReadiness(formatStage, formatSplit);
    const wrong = changeReadiness(formatStage, taxSplit);

    // Assert
    expect(right).toBeGreaterThan(wrong);
  });

  it.each(volatileCases)('$stage.title: よく変わる処理だけを残してほかを外へ出す解き方は、100点で、模範解答を上回らない', ({ stage, stable }) => {
    // Arrange
    const keepVolatile = applySolutionSteps(stage.codebase, keepVolatileSteps(stable));

    // Act
    const total = scoreCodebase(keepVolatile, stage).total;
    const keepScore = changeReadiness(stage, keepVolatile);
    const sampleScore = changeReadiness(stage, sampleAnswerCodebase(stage));

    // Assert
    expect(total).toBe(100);
    expect(keepScore).toBeLessThanOrEqual(sampleScore);
  });

  it.each(volatileCases)('$stage.title: よく変わる処理を ReportController へ持ち上げる案は模範解答より変更容易性が低い', ({ stage, stable }) => {
    // Arrange
    const lifted = applySolutionSteps(stage.codebase, liftToControllerSteps(stable));

    // Act
    const liftedChangeScore = changeReadiness(stage, lifted);
    const sampleChangeScore = changeReadiness(stage, sampleAnswerCodebase(stage));

    expect(liftedChangeScore).toBeLessThan(sampleChangeScore);
  });

  it.each([taxStage, formatStage])('$title: 税と整形を1つのヘルパーへ移すと、模範解答より変更容易性スコアが低い', (stage) => {
    // Arrange
    const helper = applySolutionSteps(stage.codebase, helperSteps);

    // Act
    const helperScore = changeReadiness(stage, helper);
    const sampleScore = changeReadiness(stage, sampleAnswerCodebase(stage));

    // Assert
    expect(helperScore).toBeLessThan(sampleScore);
  });
});
