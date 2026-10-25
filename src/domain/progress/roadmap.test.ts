import { describe, expect, it } from 'vitest';
import type { Stage } from '../stage/Stage';
import { conceptMastery, isStageCleared, recommendNextStage, stageStatus } from './roadmap';

function stageOf(id: string, learns: readonly string[] = ['Extract Method']): Stage {
  return {
    id,
    level: 'tutorial',
    title: id,
    why: '',
    goal: '',
    problem: '',
    description: '',
    learns,
    checks: [],
    limits: { method: 10, class: 20, file: 30 },
    dependencyLimit: 3,
    responsibilityLimit: 2,
    codebase: { files: [] },
    classNames: {},
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

describe('isStageCleared', () => {
  it('自己ベストが100ならクリア', () => {
    // Arrange
    const progress = { a: 100 };

    // Act
    const cleared = isStageCleared('a', progress);

    // Assert
    expect(cleared).toBe(true);
  });

  it('自己ベストが99ならクリアでない', () => {
    // Arrange
    const progress = { a: 99 };

    // Act
    const cleared = isStageCleared('a', progress);

    // Assert
    expect(cleared).toBe(false);
  });

  it('記録が無ければクリアでない', () => {
    // Arrange
    const progress = {};

    // Act
    const cleared = isStageCleared('a', progress);

    // Assert
    expect(cleared).toBe(false);
  });
});

describe('conceptMastery', () => {
  const none = () => false;

  it('ステージが空なら空配列', () => {
    // Arrange
    const stages: readonly Stage[] = [];

    // Act
    const result = conceptMastery(stages, none);

    // Assert
    expect(result).toEqual([]);
  });

  it('概念ごとに total と remaining を数える', () => {
    // Arrange
    const a = stageOf('a', ['Extract Method']);
    const b = stageOf('b', ['Extract Method', 'Move Method']);

    // Act
    const result = conceptMastery([a, b], none);

    // Assert
    expect(result).toEqual([
      { concept: 'Extract Method', total: 2, cleared: 0, remaining: [a, b] },
      { concept: 'Move Method', total: 1, cleared: 0, remaining: [b] },
    ]);
  });

  it('クリアしたステージは cleared に数え、remaining から外す', () => {
    // Arrange
    const a = stageOf('a', ['Extract Method']);
    const b = stageOf('b', ['Extract Method', 'Move Method']);

    // Act
    const result = conceptMastery([a, b], (id) => id === 'b');

    // Assert
    expect(result).toEqual([
      { concept: 'Extract Method', total: 2, cleared: 1, remaining: [a] },
      { concept: 'Move Method', total: 1, cleared: 1, remaining: [] },
    ]);
  });

  it('並びは概念が stages で最初に出てくる順', () => {
    // Arrange
    const a = stageOf('a', ['継承']);
    const b = stageOf('b', ['Strategy', '継承']);

    // Act
    const result = conceptMastery([a, b], none);

    // Assert
    expect(result.map((m) => m.concept)).toEqual(['継承', 'Strategy']);
  });

  it('remaining は stages の並び順を保つ', () => {
    // Arrange
    const c = stageOf('c');
    const a = stageOf('a');

    // Act
    const result = conceptMastery([c, a], none);

    // Assert
    expect(result[0]?.remaining.map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('全ステージクリアなら全概念で cleared === total かつ remaining が空', () => {
    // Arrange
    const stages = [stageOf('a', ['X']), stageOf('b', ['X', 'Y'])];

    // Act
    const result = conceptMastery(stages, () => true);

    // Assert
    expect(result.every((m) => m.cleared === m.total && m.remaining.length === 0)).toBe(true);
  });

  it('isCleared の述語だけで判定する', () => {
    // Arrange
    const a = stageOf('a');
    const b = stageOf('b');

    // Act
    const result = conceptMastery([a, b], (id) => id === 'b');

    // Assert
    expect(result[0]).toEqual({ concept: 'Extract Method', total: 2, cleared: 1, remaining: [a] });
  });
});
