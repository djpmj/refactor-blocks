import { describe, expect, it } from 'vitest';
import type { ChangeRequest } from '../change/ChangeRequest';
import { averageScore } from '../change/scoreChange';
import type { Method } from '../codebase/Codebase';
import { scoreCodebase } from '../scoring/score';
import { applySolutionSteps } from '../stage/sampleAnswer';
import type { BlankDesignProblem } from './BlankDesignProblem';
import { modelAnswerCodebase, reviewBlankDesign } from './reviewBlankDesign';
import { TRAY_FILE_ID, trayCodebase, withoutTray } from './tray';

const flow: Method = {
  id: 'method-flow',
  name: 'flow',
  visibility: 'public',
  fragments: [{ id: 'frag-flow', label: '一連の処理を呼ぶ', lines: 6, responsibility: 'flow', uses: ['method-tax', 'method-save'] }],
};
const tax: Method = {
  id: 'method-tax',
  name: 'calculateTax',
  visibility: 'public',
  fragments: [{ id: 'frag-tax', label: '税額を計算する', lines: 10, responsibility: 'tax' }],
};
const save: Method = {
  id: 'method-save',
  name: 'saveOrder',
  visibility: 'public',
  fragments: [{ id: 'frag-save', label: '保存する', lines: 10, responsibility: 'persistence' }],
};
const parts = [flow, tax, save];

const taxRequest: ChangeRequest = { id: 'req-tax', title: '税率を変えて', description: '税率を変えたい', responsibility: 'tax', linesPerSite: 10 };

function makeProblem(overrides: Partial<BlankDesignProblem> = {}): BlankDesignProblem {
  return {
    id: 'test-blank',
    level: 'beginner',
    title: 'テスト用の白紙設計',
    goal: '全部品を配置しよう',
    description: 'テスト用の要求文',
    limits: { method: 40, class: 80, file: 200 },
    dependencyLimit: 3,
    responsibilityLimit: 1,
    codebase: trayCodebase(parts),
    changeRequests: [taxRequest],
    modelAnswer: [
      { addFile: 'src/Flow.ts' },
      { addFile: 'src/Tax.ts' },
      { addFile: 'src/Save.ts' },
      { addClass: { name: 'Flow', file: 'src/Flow.ts' } },
      { addClass: { name: 'Tax', file: 'src/Tax.ts' } },
      { addClass: { name: 'Save', file: 'src/Save.ts' } },
      { move: { method: 'flow', toClass: 'Flow' } },
      { move: { method: 'calculateTax', toClass: 'Tax' } },
      { move: { method: 'saveOrder', toClass: 'Save' } },
    ],
    explanation: '流れ・税・保存で分けると、変わる理由ごとにクラスが分かれる。',
    ...overrides,
  };
}

describe('reviewBlankDesign', () => {
  it('正常系: 全部品を配置したコードベースで ok。player.score は scoreCodebase(withoutTray(codebase), problem) と一致する', () => {
    // Arrange
    const problem = makeProblem();
    const codebase = applySolutionSteps(problem.codebase, problem.modelAnswer);

    // Act
    const result = reviewBlankDesign(problem, codebase);

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.player.score).toEqual(scoreCodebase(withoutTray(codebase), problem));
  });

  it('正常系: 部品置き場の空のクラス・ファイルが残っていても、player.score の empty の減点は0', () => {
    // Arrange
    const problem = makeProblem();
    // move で全部品を移した後は、元の部品置き場のクラス・ファイルは空のまま残る
    const codebase = applySolutionSteps(problem.codebase, problem.modelAnswer);
    expect(codebase.files.find((file) => file.id === TRAY_FILE_ID)?.classes[0]?.methods).toEqual([]);

    // Act
    const result = reviewBlankDesign(problem, codebase);

    // Assert
    if (!result.ok) throw new Error(result.error);
    const emptyDeduction = result.value.player.score.deductions.find((deduction) => deduction.rule === 'empty');
    expect(emptyDeduction?.points ?? 0).toBe(0);
  });

  it('正常系: player.changes / model.changes は変更依頼と同じ数・同じ順で、changeScore はその平均', () => {
    // Arrange
    const problem = makeProblem();
    const codebase = applySolutionSteps(problem.codebase, problem.modelAnswer);

    // Act
    const result = reviewBlankDesign(problem, codebase);

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.player.changes.map((change) => change.impact)).toHaveLength(problem.changeRequests.length);
    expect(result.value.model.changes.map((change) => change.impact)).toHaveLength(problem.changeRequests.length);
    expect(result.value.player.changeScore).toBe(averageScore(result.value.player.changes.map((change) => change.score)));
  });

  it('正常系: player.codebase / model.codebase に部品置き場のファイルがない', () => {
    // Arrange
    const problem = makeProblem();
    const codebase = applySolutionSteps(problem.codebase, problem.modelAnswer);

    // Act
    const result = reviewBlankDesign(problem, codebase);

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.player.codebase.files.some((file) => file.id === TRAY_FILE_ID)).toBe(false);
    expect(result.value.model.codebase.files.some((file) => file.id === TRAY_FILE_ID)).toBe(false);
  });

  it('正常系: 部品を全部1クラスに入れた設計より、責務ごとに分けた模範解答のほうが score.total が高い', () => {
    // Arrange
    const problem = makeProblem();
    const allInOne = applySolutionSteps(problem.codebase, [
      { addFile: 'src/All.ts' },
      { addClass: { name: 'All', file: 'src/All.ts' } },
      { move: { method: 'flow', toClass: 'All' } },
      { move: { method: 'calculateTax', toClass: 'All' } },
      { move: { method: 'saveOrder', toClass: 'All' } },
    ]);

    // Act
    const naive = reviewBlankDesign(problem, allInOne);
    const model = reviewBlankDesign(problem, modelAnswerCodebase(problem));

    // Assert
    if (!naive.ok || !model.ok) throw new Error('unexpected error');
    expect(model.value.player.score.total).toBeGreaterThan(naive.value.player.score.total);
  });

  it("異常系: 部品が部品置き場に残っていると err('unplaced-parts')", () => {
    // Arrange
    const problem = makeProblem();

    // Act
    const result = reviewBlankDesign(problem, problem.codebase);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unplaced-parts' });
  });

  it("異常系: どの部品も持たない責務の変更依頼があると err('no-sites')", () => {
    // Arrange
    const problem = makeProblem({
      changeRequests: [{ id: 'req-none', title: '', description: '', responsibility: 'notification', linesPerSite: 5 }],
    });
    const codebase = applySolutionSteps(problem.codebase, problem.modelAnswer);

    // Act
    const result = reviewBlankDesign(problem, codebase);

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-sites' });
  });

  it('modelAnswerCodebase: 模範解答の手順を適用し、部品置き場を取り除いたコードベースを返す', () => {
    // Arrange
    const problem = makeProblem();

    // Act
    const codebase = modelAnswerCodebase(problem);

    // Assert
    expect(codebase.files.some((file) => file.id === TRAY_FILE_ID)).toBe(false);
    expect(codebase.files.map((file) => file.path).sort((a, b) => a.localeCompare(b))).toEqual(['src/Flow.ts', 'src/Save.ts', 'src/Tax.ts']);
  });
});
