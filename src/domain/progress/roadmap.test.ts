import { describe, expect, it } from 'vitest';
import type { Stage } from '../stage/Stage';
import { recommendNextStage, stageStatus } from './roadmap';

function stageOf(id: string): Stage {
  return {
    id,
    level: 'tutorial',
    title: id,
    why: '',
    goal: '',
    description: '',
    learns: ['Extract Method'],
    limits: { method: 10, class: 20, file: 30 },
    dependencyLimit: 3,
    responsibilityLimit: 2,
    codebase: { files: [] },
    changeRequests: [],
  };
}

describe('stageStatus', () => {
  it('自己ベストも下書きも無ければ未挑戦', () => {
    // Arrange
    const progress = {};

    // Act
    const status = stageStatus('a', progress, false);

    // Assert
    expect(status).toEqual({ kind: 'not-started' });
  });

  it('自己ベストが無く下書きがあれば挑戦中', () => {
    // Arrange
    const progress = {};

    // Act
    const status = stageStatus('a', progress, true);

    // Assert
    expect(status).toEqual({ kind: 'in-progress' });
  });

  it('自己ベストが100未満ならその点(下書きの有無は問わない)', () => {
    // Arrange
    const progress = { a: 60 };

    // Act
    const withDraft = stageStatus('a', progress, true);
    const withoutDraft = stageStatus('a', progress, false);

    // Assert
    expect(withDraft).toEqual({ kind: 'scored', best: 60 });
    expect(withoutDraft).toEqual({ kind: 'scored', best: 60 });
  });

  it('自己ベストが100ならクリア(下書きがあっても)', () => {
    // Arrange
    const progress = { a: 100 };

    // Act
    const status = stageStatus('a', progress, true);

    // Assert
    expect(status).toEqual({ kind: 'cleared' });
  });
});

describe('recommendNextStage', () => {
  const stages = [stageOf('a'), stageOf('b'), stageOf('c')];

  it('記録が空なら先頭', () => {
    // Arrange
    const progress = {};

    // Act
    const next = recommendNextStage(stages, progress);

    // Assert
    expect(next?.id).toBe('a');
  });

  it('先頭から2つが100点で3つ目が60点なら3つ目', () => {
    // Arrange
    const progress = { a: 100, b: 100, c: 60 };

    // Act
    const next = recommendNextStage(stages, progress);

    // Assert
    expect(next?.id).toBe('c');
  });

  it('先頭が未記録で2つ目が100点なら先頭', () => {
    // Arrange
    const progress = { b: 100 };

    // Act
    const next = recommendNextStage(stages, progress);

    // Assert
    expect(next?.id).toBe('a');
  });

  it('全ステージが100点なら undefined', () => {
    // Arrange
    const progress = { a: 100, b: 100, c: 100 };

    // Act
    const next = recommendNextStage(stages, progress);

    // Assert
    expect(next).toBeUndefined();
  });

  it('stages が空なら undefined', () => {
    // Arrange
    const progress = {};

    // Act
    const next = recommendNextStage([], progress);

    // Assert
    expect(next).toBeUndefined();
  });
});
