import { describe, expect, it } from 'vitest';
import type { ChangeRequest } from '../domain/change/ChangeRequest';
import { withChangePart } from '../domain/change/changePart';
import { measureChange } from '../domain/change/measureChange';
import { scoreChange } from '../domain/change/scoreChange';
import { moveMethod } from '../domain/codebase/moveMethod';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import type { CodeClass, Codebase, Method } from '../domain/codebase/Codebase';
import { sampleImplementation } from '../domain/change/sampleImplementation';
import { evaluateImplementationUseCase, isChangeChallengeCleared } from './ChangeRequestUseCases';

const taxRequest: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8 };
const stage = { limits: { method: 20, class: 100, file: 100 }, codebase: sampleCodebase() };

describe('evaluateImplementationUseCase', () => {
  const request: ChangeRequest = { ...taxRequest, partName: 'addReducedTax' };
const partId = 'method-part-req-tax';

const previousMethod: Method = {
  id: 'previous-part', name: 'previousPart', visibility: 'public',
  fragments: [{ id: 'previous-fragment', label: 'prior work', lines: 100, responsibility: 'tax' }],
};

function addPreviousPart(codeClass: CodeClass): CodeClass {
  return codeClass.id === 'class-tax'
    ? { ...codeClass, methods: [...codeClass.methods, previousMethod] }
    : codeClass;
}

function addPreviousPartToFile(file: Codebase['files'][number]): Codebase['files'][number] {
  return { ...file, classes: file.classes.map(addPreviousPart) };
}

  function placedIn(classId: string): ReturnType<typeof moveMethod> {
    return moveMethod(withChangePart(sampleCodebase(), request), partId, classId);
  }

  it("'modify': 挑戦前のコードのコストと初期状態のコストが入り、置き方は base と implemented の比較になる", () => {
    // Arrange
    const implemented = placedIn('class-tax');
    if (!implemented.ok) throw new Error('成功するはず');

    // Act
    const result = evaluateImplementationUseCase(stage, { design: sampleCodebase(), base: sampleCodebase(), sampleBase: sampleCodebase(), implemented: implemented.value }, request);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    expect(result.value.current?.impact.sites).toEqual(['method-place']);
    expect(result.value.initial?.score.total).toBe(result.value.current?.score.total);
    expect(result.value.placement.placement.partClassId).toBe('class-tax');
    expect(result.value.placement.score.total).toBe(90);
  });

  it('ボスの依頼には bossCounterfactual が付き、ボスでない依頼には付かない', () => {
    // Arrange
    const boss: ChangeRequest = { ...request, boss: true };
    const implemented = placedIn('class-tax');
    if (!implemented.ok) throw new Error('成功するはず');
    const codebases = { design: sampleCodebase(), base: sampleCodebase(), sampleBase: sampleCodebase(), implemented: implemented.value };

    // Act
    const bossResult = evaluateImplementationUseCase(stage, codebases, boss);
    const normalResult = evaluateImplementationUseCase(stage, codebases, request);

    // Assert
    if (!bossResult.ok || !normalResult.ok) throw new Error('成功するはず');
    expect(bossResult.value.bossCounterfactual?.score).toBe(bossResult.value.sample?.score);
    expect(normalResult.value.bossCounterfactual).toBeUndefined();
  });

  it("'extend': current と initial は null で、依頼の責務がコードになくても ok", () => {
    // Arrange
    const extend: ChangeRequest = { ...request, kind: 'extend', responsibility: 'gateway' };
    const moved = moveMethod(withChangePart(sampleCodebase(), extend), partId, 'class-tax');
    if (!moved.ok) throw new Error('成功するはず');

    // Act
    const result = evaluateImplementationUseCase(stage, { design: sampleCodebase(), base: sampleCodebase(), sampleBase: sampleCodebase(), implemented: moved.value }, extend);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    expect(result.value.current).toBeNull();
    expect(result.value.initial).toBeNull();
  });

  it('部品が未配置なら unplaced-part', () => {
    // Arrange
    const implemented = withChangePart(sampleCodebase(), request);

    // Act
    const result = evaluateImplementationUseCase(stage, { design: sampleCodebase(), base: sampleCodebase(), sampleBase: sampleCodebase(), implemented }, request);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unplaced-part' });
  });

  it("'modify' で責務がコードになければ no-sites", () => {
    // Arrange
    const noSites: ChangeRequest = { ...request, responsibility: 'shipping' };
    const implemented = moveMethod(withChangePart(sampleCodebase(), noSites), partId, 'class-tax');
    if (!implemented.ok) throw new Error('成功するはず');

    // Act
    const result = evaluateImplementationUseCase(stage, { design: sampleCodebase(), base: sampleCodebase(), sampleBase: sampleCodebase(), implemented: implemented.value }, noSites);

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-sites' });
  });

  it('積み重なったbaseの行数超過でcurrentが下がらずdesignの点数を保つ', () => {
    // Arrange
    const design = sampleCodebase();
    const base = { ...design, files: design.files.map(addPreviousPartToFile) };
    const implemented = placedIn('class-tax');
    if (!implemented.ok) throw new Error('成功するはず');
    const permissiveStage = { ...stage, limits: { ...stage.limits, method: 40 } };

    // Act
    const result = evaluateImplementationUseCase(permissiveStage, { design, base, sampleBase: base, implemented: implemented.value }, request);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    const designCost = measureChange(design, request, permissiveStage.limits);
    if (!designCost.ok) throw new Error('designのコストを測れるはず');
    expect(result.value.current?.score).toEqual(scoreChange(designCost.value));
  });

  it('解答例は、プレイヤーの積み重ねたコードではなく sampleBase の上で求める', () => {
    // Arrange
    const design = sampleCodebase();
    const base = { ...design, files: design.files.map(addPreviousPartToFile) };
    const implemented = placedIn('class-tax');
    if (!implemented.ok) throw new Error('成功するはず');
    const sampleBase = design;

    // Act
    const result = evaluateImplementationUseCase(stage, { design, base, sampleBase, implemented: implemented.value }, request);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    expect(result.value.sample).toEqual(sampleImplementation(sampleBase, request));
    expect(result.value.sample).not.toEqual(sampleImplementation(base, request));
  });
});

describe('isChangeChallengeCleared', () => {
  function outcomeOf(placed: number, sample: number | undefined) {
    return { placement: { score: { total: placed } }, sample: sample === undefined ? undefined : { score: sample } };
  }

  it('全件を確定し、どれも解答例と同じ点以上なら true', () => {
    // Arrange
    const outcomes = [outcomeOf(100, 100), outcomeOf(100, 100)];

    // Act
    const cleared = isChangeChallengeCleared(outcomes, 2);

    // Assert
    expect(cleared).toBe(true);
  });

  it('解答例より低い置き方があれば false', () => {
    expect(isChangeChallengeCleared([outcomeOf(90, 100), outcomeOf(100, 100)], 2)).toBe(false);
  });

  it('解答例でも100にならない依頼は、同じ点なら満たす', () => {
    expect(isChangeChallengeCleared([outcomeOf(80, 80)], 1)).toBe(true);
  });

  it('解答例が無い依頼は満たしたとみなす', () => {
    expect(isChangeChallengeCleared([outcomeOf(0, undefined)], 1)).toBe(true);
  });

  it('確定が依頼の数に足りなければ false', () => {
    expect(isChangeChallengeCleared([outcomeOf(100, 100)], 2)).toBe(false);
  });

  it('依頼が0件なら false', () => {
    expect(isChangeChallengeCleared([], 0)).toBe(false);
  });
});
