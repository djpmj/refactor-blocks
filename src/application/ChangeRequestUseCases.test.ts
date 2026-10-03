import { describe, expect, it } from 'vitest';
import type { ChangeRequest } from '../domain/change/ChangeRequest';
import { withChangePart } from '../domain/change/changePart';
import { moveMethod } from '../domain/codebase/moveMethod';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import { evaluateImplementationUseCase } from './ChangeRequestUseCases';

const taxRequest: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8 };
const stage = { limits: { method: 20, class: 100, file: 100 }, codebase: sampleCodebase() };

describe('evaluateImplementationUseCase', () => {
  const request: ChangeRequest = { ...taxRequest, partName: 'addReducedTax' };
  const partId = 'method-part-req-tax';

  function placedIn(classId: string): ReturnType<typeof moveMethod> {
    return moveMethod(withChangePart(sampleCodebase(), request), partId, classId);
  }

  it("'modify': 挑戦前のコードのコストと初期状態のコストが入り、置き方は base と implemented の比較になる", () => {
    // Arrange
    const implemented = placedIn('class-tax');
    if (!implemented.ok) throw new Error('成功するはず');

    // Act
    const result = evaluateImplementationUseCase(stage, sampleCodebase(), implemented.value, request);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    expect(result.value.current?.impact.sites).toEqual(['method-place']);
    expect(result.value.initial?.score.total).toBe(result.value.current?.score.total);
    expect(result.value.placement.placement.partClassId).toBe('class-tax');
    expect(result.value.placement.score.total).toBe(90);
  });

  it("'extend': current と initial は null で、依頼の責務がコードになくても ok", () => {
    // Arrange
    const extend: ChangeRequest = { ...request, kind: 'extend', responsibility: 'gateway' };
    const moved = moveMethod(withChangePart(sampleCodebase(), extend), partId, 'class-tax');
    if (!moved.ok) throw new Error('成功するはず');

    // Act
    const result = evaluateImplementationUseCase(stage, sampleCodebase(), moved.value, extend);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    expect(result.value.current).toBeNull();
    expect(result.value.initial).toBeNull();
  });

  it('部品が未配置なら unplaced-part', () => {
    // Arrange
    const implemented = withChangePart(sampleCodebase(), request);

    // Act
    const result = evaluateImplementationUseCase(stage, sampleCodebase(), implemented, request);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unplaced-part' });
  });

  it("'modify' で責務がコードになければ no-sites", () => {
    // Arrange
    const noSites: ChangeRequest = { ...request, responsibility: 'shipping' };
    const implemented = moveMethod(withChangePart(sampleCodebase(), noSites), partId, 'class-tax');
    if (!implemented.ok) throw new Error('成功するはず');

    // Act
    const result = evaluateImplementationUseCase(stage, sampleCodebase(), implemented.value, noSites);

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-sites' });
  });
});
