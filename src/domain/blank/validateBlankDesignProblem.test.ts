import { describe, expect, it } from 'vitest';
import type { Method } from '../codebase/Codebase';
import type { BlankDesignProblem } from './BlankDesignProblem';
import { trayCodebase } from './tray';
import { validateBlankDesignProblem } from './validateBlankDesignProblem';

const flow: Method = {
  id: 'method-flow',
  name: 'flow',
  visibility: 'public',
  fragments: [{ id: 'frag-flow', label: '一連の処理を呼ぶ', lines: 3, responsibility: 'flow', uses: ['method-tax', 'method-save'] }],
};
const tax: Method = {
  id: 'method-tax',
  name: 'calculateTax',
  visibility: 'public',
  fragments: [{ id: 'frag-tax', label: '税額を計算する', lines: 3, responsibility: 'tax' }],
};
const save: Method = {
  id: 'method-save',
  name: 'saveOrder',
  visibility: 'public',
  fragments: [{ id: 'frag-save', label: '保存する', lines: 3, responsibility: 'persistence' }],
};

const problem: BlankDesignProblem = {
  id: 'test-blank',
  level: 'beginner',
  title: 'テスト用の白紙設計',
  learns: ['責務の分離'],
  outcome: '',
  checks: [],
  why: '役割ごとに配置すると、変更先を見つけやすくなります。',
  goal: '全部品を配置しよう',
  problem: '',
  description: 'テスト用の要求文',
  limits: { method: 40, class: 80, file: 200 },
  dependencyLimit: 3,
  responsibilityLimit: 1,
  codebase: trayCodebase([flow, tax, save]),
  classNames: { flow: 'Flow', tax: 'Tax', persistence: 'Save' },
  responsibilityNames: { flow: '流れ', tax: '税', persistence: '保存' },
  changeRequests: [{ id: 'req-tax', title: '税率を変えて', description: '税率を変えたい', responsibility: 'tax', linesPerSite: 10 }],
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
  explanation: '流れ・税・保存で分ける。',
};

const callerPart: Method = {
  id: 'method-caller',
  name: 'caller',
  visibility: 'public',
  fragments: [{ id: 'frag-caller', label: '呼ぶ', lines: 1, responsibility: 'call' }],
};

function withParts(parts: readonly Method[]): BlankDesignProblem {
  return { ...problem, codebase: trayCodebase(parts) };
}

describe('validateBlankDesignProblem', () => {
  it('決まりを満たす問題は ok', () => {
    // Arrange & Act
    const result = validateBlankDesignProblem(problem);

    // Assert
    expect(result).toEqual({ ok: true, value: problem });
  });

  it('部品置き場のファイルが2つあると tray-shape', () => {
    // Arrange
    const [trayFile] = problem.codebase.files;
    const broken = { ...problem, codebase: { files: [trayFile, { ...trayFile, id: 'file-extra' }] } };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'tray-shape' });
  });

  it('ファイルIDが TRAY_FILE_ID でないと tray-shape', () => {
    // Arrange
    const [trayFile] = problem.codebase.files;
    const broken = { ...problem, codebase: { files: [{ ...trayFile, id: 'file-other' }] } };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'tray-shape' });
  });

  it('部品置き場のクラスが2つあると tray-shape', () => {
    // Arrange
    const [trayFile] = problem.codebase.files;
    const [trayClass] = trayFile.classes;
    const broken = { ...problem, codebase: { files: [{ ...trayFile, classes: [trayClass, { ...trayClass, id: 'class-extra' }] }] } };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'tray-shape' });
  });

  it("'call' の責務は classNames・responsibilityNames に無くても ok", () => {
    // Arrange: 呼び出し役の部品(責務 'call')を足し、模範解答でも配置する
    const withCall = {
      ...withParts([flow, tax, save, callerPart]),
      modelAnswer: [...problem.modelAnswer, { move: { method: 'caller', toClass: 'Flow' } }],
    };

    // Act
    const result = validateBlankDesignProblem(withCall);

    // Assert
    expect(result).toEqual({ ok: true, value: withCall });
  });

  it("変更依頼の責務に 'call' は選べず unknown-change-responsibility", () => {
    // Arrange
    const broken = { ...withParts([flow, tax, save, callerPart]), changeRequests: [{ ...problem.changeRequests[0], responsibility: 'call' }] };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unknown-change-responsibility' });
  });

  it('部品が0個だと no-parts', () => {
    // Arrange & Act
    const result = validateBlankDesignProblem(withParts([]));

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-parts' });
  });

  it('部品のメソッドIDが重複すると duplicate-part-id', () => {
    // Arrange
    const broken = withParts([flow, tax, { ...save, id: 'method-tax' }]);

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'duplicate-part-id' });
  });

  it('Fragment IDが重複すると duplicate-part-id', () => {
    // Arrange
    const broken = withParts([flow, tax, { ...save, fragments: [{ ...save.fragments[0], id: 'frag-tax' }] }]);

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'duplicate-part-id' });
  });

  it('uses に存在しないメソッドIDがあると unknown-use', () => {
    // Arrange
    const broken = withParts([{ ...flow, fragments: [{ ...flow.fragments[0], uses: ['method-blank-nothing'] }] }, tax, save]);

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unknown-use' });
  });

  it('classNames から責務を消すと missing-responsibility-name', () => {
    // Arrange
    const broken = { ...problem, classNames: { flow: 'Flow', persistence: 'Save' } };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'missing-responsibility-name' });
  });

  it('responsibilityNames から責務を消すと missing-responsibility-name', () => {
    // Arrange
    const broken = { ...problem, responsibilityNames: { flow: '流れ', persistence: '保存' } };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'missing-responsibility-name' });
  });

  it('変更依頼の責務が部品にないと unknown-change-responsibility', () => {
    // Arrange
    const broken = { ...problem, changeRequests: [{ ...problem.changeRequests[0], responsibility: 'unknown' }] };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unknown-change-responsibility' });
  });

  it('模範解答の move を1つ消すと model-answer-unplaced', () => {
    // Arrange
    const broken = { ...problem, modelAnswer: problem.modelAnswer.slice(0, -1) };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'model-answer-unplaced' });
  });

  it('誤りが2つあるときは先に見つかる no-parts を返す', () => {
    // Arrange
    const broken = { ...withParts([]), changeRequests: [{ ...problem.changeRequests[0], responsibility: 'unknown' }] };

    // Act
    const result = validateBlankDesignProblem(broken);

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-parts' });
  });
});
