import { describe, expect, it } from 'vitest';
import { measureChange } from '../../domain/change/measureChange';
import { measurePain } from '../../domain/change/changePain';
import { isClearlyRelieved } from '../../domain/change/painRelief';
import { scoreChange } from '../../domain/change/scoreChange';
import { findClass, findMethod } from '../../domain/codebase/Codebase';
import { classDependencies } from '../../domain/codebase/dependencies';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import { scoreCodebase } from '../../domain/scoring/score';
import { findMiddleManClasses } from '../../domain/scoring/middleMan';
import { applySolutionSteps, sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'intermediate-law-of-demeter');
if (stage === undefined) throw new Error('intermediate-law-of-demeter がありません');
const solution = sampleAnswerSteps[stage.id];
if (solution === undefined) throw new Error('intermediate-law-of-demeter の模範解答がありません');

const dependencyNames = (codebase: typeof stage.codebase, fromId: string): string[] =>
  classDependencies(codebase).filter((dependency) => dependency.from === fromId).map((dependency) => dependency.to);

describe('中級: 注文から住所までたどる宛名印刷(Law of Demeter)', () => {
  it('メソッドの上限は11行で(2Fragmentのメソッドは最小8行、変更依頼で+2行)、goal にも「メソッドは11行以内」と書かれている', () => {
    // Arrange / Act
    const { limits, goal } = stage;

    // Assert
    expect(limits).toEqual({ method: 11, class: 30, file: 40 });
    expect(goal).toContain('メソッドは11行以内');
  });

  it('上限11行で、初期は行数違反(印刷クラス2つ)で、模範解答の最後は行数違反が0件', () => {
    // Arrange / Act
    const solved = applySolutionSteps(stage.codebase, solution);
    const lineViolations = (codebase: typeof stage.codebase) => findLineLimitViolations(codebase, stage.limits).map((violation) => violation.targetId);

    // Assert
    expect(lineViolations(stage.codebase)).toEqual(['method-print-label', 'method-print-note']);
    expect(lineViolations(solved)).toEqual([]);
  });

  it('初期状態は60点(行数2件・結合度2件)', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const score = scoreCodebase(codebase, stage);

    // Assert
    expect(score.total).toBe(60);
    expect(score.deductions.filter((d) => d.count > 0).map((d) => [d.rule, d.count])).toEqual([['line-limit', 2], ['coupling', 2]]);
  });

  it('初期状態は ShippingLabelPrinter が Order・Customer・Address の3つに依存している', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const targets = dependencyNames(codebase, 'class-shipping-label-printer');

    // Assert
    expect(new Set(targets)).toEqual(new Set(['class-order', 'class-customer', 'class-address']));
  });

  it('模範解答の最後まで適用すると100点で、依存は4本・各クラス1つ以下・循環なし', () => {
    // Arrange / Act
    const solved = applySolutionSteps(stage.codebase, solution);
    const dependencies = classDependencies(solved);

    // Assert
    expect(scoreCodebase(solved, stage).total).toBe(100);
    expect(dependencies).toHaveLength(4);
    expect(dependencies.some((dependency) => dependency.cyclic)).toBe(false);
    expect(new Set(dependencies.map((dependency) => dependency.from)).size).toBe(4);
  });

  it('模範解答のあと、getCustomer と getAddress は private で、横流しだけのクラスはない', () => {
    // Arrange / Act
    const solved = applySolutionSteps(stage.codebase, solution);

    // Assert
    expect(findMethod(solved, 'method-get-customer')?.visibility).toBe('private');
    expect(findMethod(solved, 'method-get-address')?.visibility).toBe('private');
    expect(findMiddleManClasses(solved)).toEqual([]);
  });

  it('Customer へ移しただけ(4手目まで)では、印刷クラスが Order・Customer の2つに依存して100点未満', () => {
    // Arrange / Act
    const partial = applySolutionSteps(stage.codebase, solution.slice(0, 4));

    // Assert
    expect(new Set(dependencyNames(partial, 'class-shipping-label-printer'))).toEqual(new Set(['class-order', 'class-customer']));
    expect(scoreCodebase(partial, stage).total).toBeLessThan(100);
  });

  it('近道: 3つの呼び出しを抽出して Merge し、丸ごと Order へ移すと90点(coupling 1件だけ)', () => {
    // Arrange
    const shortcut: readonly SolutionStep[] = [
      { extract: { from: 'printLabel', fragmentIds: ['frag-label-get-customer', 'frag-label-get-address', 'frag-label-format-address'], name: 'buildAddressLine' } },
      { extract: { from: 'printNote', fragmentIds: ['frag-note-get-customer', 'frag-note-get-address', 'frag-note-format-address'], name: 'buildAddressLine' } },
      { merge: { methodA: 'buildAddressLine', methodAClass: 'ShippingLabelPrinter', methodB: 'buildAddressLine', methodBClass: 'DeliveryNotePrinter', name: 'buildAddressLine' } },
      { move: { method: 'buildAddressLine', toClass: 'Order' } },
    ];

    // Act
    const score = scoreCodebase(applySolutionSteps(stage.codebase, shortcut), stage);

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions.filter((d) => d.count > 0).map((d) => [d.rule, d.count])).toEqual([['coupling', 1]]);
  });

  it('住所の変更依頼は、波及が初期2クラス・解答後は Customer だけ', () => {
    // Arrange
    const request = stage.changeRequests.find((candidate) => candidate.id === 'req-address-building');
    if (request === undefined) throw new Error('req-address-building がありません');
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const before = measureChange(stage.codebase, request, stage.limits);
    const after = measureChange(solved, request, stage.limits);

    // Assert
    if (!before.ok || !after.ok) throw new Error('変更依頼の測定に失敗しました');
    expect(before.value.rippleClasses).toHaveLength(2);
    expect(after.value.rippleClasses).toEqual(['class-customer']);
    expect([scoreChange(before.value).total, scoreChange(after.value).total]).toEqual([90, 95]);
  });

  it('バーコードの変更依頼は、解答後に「はっきり楽になる」', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const pain = measurePain(stage, solved);

    // Assert
    if (pain === undefined) throw new Error('痛みを測れません');
    expect(pain.request.id).toBe('req-label-barcode');
    expect(isClearlyRelieved(pain.initial, pain.current)).toBe(true);
    expect(findClass(solved, 'class-order')).toBeDefined();
  });
});
