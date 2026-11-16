import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { measureExtendPain, measurePain } from '../../domain/change/changePain';
import { measureChange } from '../../domain/change/measureChange';
import { scoreChange } from '../../domain/change/scoreChange';
import { allClasses } from '../../domain/codebase/Codebase';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'advanced-composite-item');
if (stage === undefined) throw new Error('単品とセットのステージがありません');
const solution = sampleAnswerSteps[stage.id] ?? [];

describe('上級12: 単品とセット(Composite)', () => {
  it('上級の末尾にあり、模範解答は14手で初期50点から100点になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const initial = scoreCodebase(stage.codebase, stage);
    const final = scoreCodebase(solved, stage);
    // Assert
    expect(solution).toHaveLength(14);
    expect(initial.total).toBe(50);
    expect(initial.deductions.filter((deduction) => deduction.count > 0).map((deduction) => deduction.rule).sort((a, b) => a.localeCompare(b))).toEqual(['line-limit', 'responsibility']);
    expect(final.total).toBe(100);
  });

  it('初期は CartService の2メソッドが行数上限を超える', () => {
    // Arrange / Act
    const violations = findLineLimitViolations(stage.codebase, stage.limits);
    // Assert
    for (const id of ['method-cart-price-item', 'method-cart-list-item']) {
      expect(violations).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'method', targetId: id })]));
    }
  });

  it('解答後は SingleItem・BundleItem が CatalogItem を実装し、CartService は呼び出しだけが残る', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const classes = allClasses(solved);
    const contract = classes.find((codeClass) => codeClass.name === 'CatalogItem');
    // Assert
    for (const name of ['SingleItem', 'BundleItem']) {
      const codeClass = classes.find((candidate) => candidate.name === name);
      expect(codeClass?.interfaceIds).toContain(contract?.id);
      expect(codeClass?.methods.map((method) => method.name).sort((a, b) => a.localeCompare(b))).toEqual(['getPrice', 'writeLines']);
      const responsibilities = codeClass?.methods.flatMap((method) => method.fragments).map((fragment) => fragment.responsibility);
      expect(new Set(responsibilities).size).toBe(1);
    }
    const cart = classes.find((codeClass) => codeClass.name === 'CartService');
    expect(cart?.methods.flatMap((method) => method.fragments).every((fragment) => fragment.responsibility === 'call')).toBe(true);
  });

  it('解答後は BundleItem → CatalogItem の依存があり、循環しない', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const score = scoreCodebase(solved, stage);
    const bundle = allClasses(solved).find((codeClass) => codeClass.name === 'BundleItem');
    const calls = bundle?.methods.flatMap((method) => method.fragments).flatMap((fragment) => fragment.uses ?? []) ?? [];
    // Assert
    expect(calls).toEqual(expect.arrayContaining(['method-catalog-item-get-price', 'method-catalog-item-write-lines']));
    expect(score.deductions.filter((deduction) => deduction.count > 0)).toEqual([]);
  });

  it('インターフェースの実装を抜くと100点にならない', () => {
    // Arrange
    const incomplete = solution.filter((step) => !('addInterface' in step));
    // Act
    const score = scoreCodebase(applySolutionSteps(stage.codebase, incomplete), stage);
    // Assert
    expect(score.total).toBeLessThan(100);
  });

  it('ギフトカードは新クラスで足せ、空セットの変更は読む行数が減る', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const extend = measureExtendPain(stage, solved, stage.changeRequests[0]);
    const modify = measurePain(stage, solved);
    // Assert
    expect(extend?.initialModified.length).toBeGreaterThanOrEqual(1);
    expect(extend?.currentModified).toEqual([]);
    expect(extend?.currentTarget).toEqual({ kind: 'new-class', implementing: 'CatalogItem' });
    expect(modify?.initial.readLines).toBe(26);
    expect(modify?.current.readLines).toBe(16);
    const costOf = (codebase: typeof solved): number | undefined => {
      const impact = measureChange(codebase, stage.changeRequests[1], stage.limits);
      return impact.ok ? scoreChange(impact.value).total : undefined;
    };
    expect(costOf(stage.codebase)).toBe(50);
    expect(costOf(solved)).toBe(95);
  });

  it('依頼は extend・modify の2件で、理解度チェックは最長の選択肢が正解でない', () => {
    // Arrange / Act
    const kinds = stage.changeRequests.map(changeKindOf);
    // Assert
    expect(kinds).toEqual(['extend', 'modify']);
    expect(stage.checks.map((check) => check.answer)).toEqual([2, 0]);
    for (const check of stage.checks) {
      expect(check.choices[check.answer].text.length).toBeLessThan(Math.max(...check.choices.map((choice) => choice.text.length)));
    }
  });
});
