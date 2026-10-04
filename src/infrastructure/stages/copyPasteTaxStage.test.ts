import { describe, expect, it } from 'vitest';
import { measurePain, painRequestOf } from '../../domain/change/changePain';
import { findChangeSites } from '../../domain/change/findChangeSites';
import { allClasses } from '../../domain/codebase/Codebase';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'intermediate-copy-paste-tax');
if (stage === undefined) throw new Error('中級9 (intermediate-copy-paste-tax) がありません');
const request = painRequestOf(stage);
if (request === undefined) throw new Error('中級9に modify の依頼がありません');

describe('中級9: コピペされた消費税計算', () => {
  it('初期状態は100点にならず、模範解答(抽出→統合→移動)で100点になる', () => {
    // Arrange
    const steps = sampleAnswerSteps[stage.id] ?? [];

    // Act
    const initial = scoreCodebase(stage.codebase, stage);
    const solved = scoreCodebase(applySolutionSteps(stage.codebase, steps), stage);

    // Assert
    expect(initial.total).toBeLessThan(100);
    expect(solved.total).toBe(100);
  });

  it('初期状態で tax の変更箇所が3メソッドあり、3つとも duplicateGroup tax-calc を共有する', () => {
    // Arrange
    const sites = findChangeSites(stage.codebase, request);

    // Act
    const taxFragments = allClasses(stage.codebase)
      .flatMap((codeClass) => codeClass.methods)
      .filter((method) => sites.includes(method.id))
      .flatMap((method) => method.fragments);
    const groups = taxFragments.filter((fragment) => fragment.responsibility === 'tax').map((fragment) => fragment.duplicateGroup);

    // Assert
    expect(sites).toHaveLength(3);
    expect(groups).toEqual(['tax-calc', 'tax-calc', 'tax-calc']);
  });

  it('模範解答にすると変更箇所が1か所になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id] ?? []);

    // Act
    const pain = measurePain(stage, solved);

    // Assert
    expect(pain?.current.siteIds).toHaveLength(1);
    expect(stage.why.trim()).not.toBe('');
  });
});
