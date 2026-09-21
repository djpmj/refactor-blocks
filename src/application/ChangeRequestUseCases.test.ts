import { describe, expect, it } from 'vitest';
import type { ChangeRequest } from '../domain/change/ChangeRequest';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import { evaluateChangeRequestUseCase } from './ChangeRequestUseCases';

const taxRequest: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8 };
const stage = { limits: { method: 20, class: 100, file: 100 }, codebase: sampleCodebase() };

describe('evaluateChangeRequestUseCase', () => {
  it('今のコードと初期状態のコードの両方に依頼を当てて、点数を返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = evaluateChangeRequestUseCase(stage, codebase, taxRequest, ['method-place']);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    expect(result.value.current.impact.sites).toEqual(['method-place']);
    expect(result.value.initial.score.total).toBe(result.value.current.score.total);
    expect(result.value.investigation).toEqual({ missed: [], extra: [] });
  });

  it('調査の漏れは今のコードの点数だけを下げ、初期状態の点数には影響しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = evaluateChangeRequestUseCase(stage, codebase, taxRequest, []);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    expect(result.value.investigation.missed).toEqual(['method-place']);
    expect(result.value.current.score.total).toBe(result.value.initial.score.total - 10);
  });

  it('変更箇所がなければ no-sites', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = evaluateChangeRequestUseCase(stage, codebase, { ...taxRequest, responsibility: 'shipping' }, []);

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-sites' });
  });
});
