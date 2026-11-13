import { describe, expect, it } from 'vitest';
import { allClasses } from '../../domain/codebase/Codebase';
import { classDependencies } from '../../domain/codebase/dependencies';
import { measurePain } from '../../domain/change/changePain';
import { findLayerViolations } from '../../domain/scoring/layers';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'advanced-mail-adapter');
if (stage === undefined) throw new Error('メール Adapter ステージがありません');
const solution = sampleAnswerSteps[stage.id] ?? [];

describe('上級10: メール Adapter', () => {
  it('初期40点から9手で100点になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const initial = scoreCodebase(stage.codebase, stage);
    const final = scoreCodebase(solved, stage);
    // Assert
    expect(solution).toHaveLength(9);
    expect(initial.total).toBe(40);
    expect(final.total).toBe(100);
    expect(initial.deductions.filter((deduction) => deduction.count > 0).map((deduction) => [deduction.rule, deduction.count]))
      .toEqual([['responsibility', 3], ['layer', 3]]);
    expect(allClasses(solved).find((candidate) => candidate.name === 'SendGridMailAdapter')?.interfaceIds)
      .toContain('class-mail-sender');
  });

  it('SDK への直接依存を Adapter に集める', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const initialLayers = findLayerViolations(stage.codebase, stage.layers);
    const finalLayers = findLayerViolations(solved, stage.layers);
    const dependencies = classDependencies(solved);
    const adapter = allClasses(solved).find((candidate) => candidate.name === 'SendGridMailAdapter');
    // Assert
    expect(initialLayers).toHaveLength(3);
    expect(initialLayers.every((violation) => violation.toClassId === 'class-mail-sendgrid-client' && violation.kind === 'skip')).toBe(true);
    expect(finalLayers).toEqual([]);
    expect(adapter?.methods.map((method) => method.name)).toEqual(['sendMail']);
    expect(adapter?.methods.flatMap((method) => method.fragments).map((fragment) => fragment.responsibility))
      .toEqual(['mail-sdk-call']);
    const originalSdk = allClasses(stage.codebase).find((candidate) => candidate.name === 'SendGridClient');
    const solvedSdk = allClasses(solved).find((candidate) => candidate.name === 'SendGridClient');
    expect(solvedSdk).toEqual(originalSdk);
    for (const source of ['class-mail-order-service', 'class-mail-member-service', 'class-mail-reset-service']) {
      const owner = allClasses(solved).find((candidate) => candidate.id === source);
      expect(owner?.methods.flatMap((method) => method.fragments).every((fragment) => fragment.responsibility !== 'mail-sdk-call')).toBe(true);
      expect(dependencies.filter((dependency) => dependency.from === source).map((dependency) => dependency.to))
        .toEqual([adapter?.id]);
    }
    expect(dependencies.filter((dependency) => dependency.to === 'class-mail-sendgrid-client').map((dependency) => dependency.from))
      .toEqual([adapter?.id]);
  });

  it('インターフェースを実装しない近道は契約違反になる', () => {
    // Arrange
    const incomplete = solution.filter((step) => !('addInterface' in step));
    // Act
    const score = scoreCodebase(applySolutionSteps(stage.codebase, incomplete), stage);
    // Assert
    expect(score.total).toBeLessThan(100);
    expect(score.deductions).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'contract', count: 1 })]));
  });

  it('SDK 変更の場所が3クラスから Adapter 1クラスに減る', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const pain = measurePain(stage, solved);
    // Assert
    expect(pain?.initial.classes).toBe(3);
    expect(pain?.current.classes).toBe(1);
    expect(stage.changeRequests.map((request) => request.rumor !== undefined)).toEqual([false, true]);
    for (const check of stage.checks) {
      expect(check.choices[check.answer].text.length).toBeLessThan(Math.max(...check.choices.map((choice) => choice.text.length)));
    }
  });
});
