import { describe, expect, it } from 'vitest';
import type { Stage } from '../stage/Stage';
import { conceptMastery, isStageCleared, recommendNextStage, recommendReviewStage, stageStatus } from './roadmap';

function stageOf(id: string, learns: readonly string[] = ['Extract Method'], withSteps = false): Stage {
  return {
    id,
    level: 'tutorial',
    title: id,
    why: '',
    goal: '',
    problem: '',
    description: '',
    learns,
    checks: withSteps ? [{ id: 'c', question: '?', choices: [{ text: 'a', explanation: '' }, { text: 'b', explanation: '' }], answer: 0 }] : [],
    limits: { method: 10, class: 20, file: 30 },
    dependencyLimit: 3,
    responsibilityLimit: 2,
    codebase: { files: [] },
    classNames: {},
    responsibilityNames: {},
    changeRequests: withSteps ? [{ id: 'r', title: '', description: '', responsibility: 'x', linesPerSite: 1 }] : [],
  };
}

describe('stageStatus', () => {
  it('自己ベストも下書きも無ければ未挑戦', () => {
    // Arrange
    const progress = {};

    // Act
    const status = stageStatus(stageOf('a'), progress, {}, false);

    // Assert
    expect(status).toEqual({ kind: 'not-started' });
  });

  it('自己ベストが無く下書きがあれば挑戦中', () => {
    // Arrange
    const progress = {};

    // Act
    const status = stageStatus(stageOf('a'), progress, {}, true);

    // Assert
    expect(status).toEqual({ kind: 'in-progress' });
  });

  it('自己ベストが100未満ならその点(下書きの有無は問わない)', () => {
    // Arrange
    const progress = { a: 60 };

    // Act
    const withDraft = stageStatus(stageOf('a'), progress, {}, true);
    const withoutDraft = stageStatus(stageOf('a'), progress, {}, false);

    // Assert
    expect(withDraft).toEqual({ kind: 'scored', best: 60 });
    expect(withoutDraft).toEqual({ kind: 'scored', best: 60 });
  });

  it('自己ベストが100ならクリア(下書きがあっても)', () => {
    // Arrange
    const progress = { a: 100 };

    // Act
    const status = stageStatus(stageOf('a'), progress, {}, true);

    // Assert
    expect(status).toEqual({ kind: 'cleared' });
  });

  it('自己ベスト100で記録なしなら、残りの段階つきの perfect', () => {
    // Arrange
    const stage = stageOf('a', ['x'], true);

    // Act
    const status = stageStatus(stage, { a: 100 }, {}, false);

    // Assert
    expect(status).toEqual({ kind: 'perfect', remaining: ['concept-check', 'change-request'] });
  });

  it('自己ベスト100で両方記録ならクリア', () => {
    // Arrange
    const stage = stageOf('a', ['x'], true);

    // Act
    const status = stageStatus(stage, { a: 100 }, { a: ['concept-check', 'change-request'] }, false);

    // Assert
    expect(status).toEqual({ kind: 'cleared' });
  });

  it('自己ベスト60なら段階を記録していても60点(100点が先)', () => {
    // Arrange
    const stage = stageOf('a', ['x'], true);

    // Act
    const status = stageStatus(stage, { a: 60 }, { a: ['concept-check', 'change-request'] }, false);

    // Assert
    expect(status).toEqual({ kind: 'scored', best: 60 });
  });
});

describe('recommendNextStage', () => {
  const stages = [stageOf('a'), stageOf('b'), stageOf('c')];
  const allDone = {};

  it('記録が空なら先頭', () => {
    // Arrange
    const progress = {};

    // Act
    const next = recommendNextStage(stages, progress, allDone);

    // Assert
    expect(next?.id).toBe('a');
  });

  it('先頭から2つが100点で3つ目が60点なら3つ目', () => {
    // Arrange
    const progress = { a: 100, b: 100, c: 60 };

    // Act
    const next = recommendNextStage(stages, progress, allDone);

    // Assert
    expect(next?.id).toBe('c');
  });

  it('先頭が未記録で2つ目が100点なら先頭', () => {
    // Arrange
    const progress = { b: 100 };

    // Act
    const next = recommendNextStage(stages, progress, allDone);

    // Assert
    expect(next?.id).toBe('a');
  });

  it('100点で残りありの a が、未挑戦の b より先におすすめされる', () => {
    // Arrange
    const withSteps = [stageOf('a', ['x'], true), stageOf('b')];

    // Act
    const next = recommendNextStage(withSteps, { a: 100 }, {});

    // Assert
    expect(next?.id).toBe('a');
  });

  it('a が全段階済みで b が100点残りありなら b', () => {
    // Arrange
    const withSteps = [stageOf('a', ['x'], true), stageOf('b', ['x'], true)];

    // Act
    const next = recommendNextStage(withSteps, { a: 100, b: 100 }, { a: ['concept-check', 'change-request'] });

    // Assert
    expect(next?.id).toBe('b');
  });

  it('全ステージが100点なら undefined', () => {
    // Arrange
    const progress = { a: 100, b: 100, c: 100 };

    // Act
    const next = recommendNextStage(stages, progress, allDone);

    // Assert
    expect(next).toBeUndefined();
  });

  it('stages が空なら undefined', () => {
    // Arrange
    const progress = {};

    // Act
    const next = recommendNextStage([], progress, {});

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

describe('recommendReviewStage', () => {
  const stages = [stageOf('a'), stageOf('b'), stageOf('c')];

  it('記録が空なら undefined', () => {
    // Act & Assert
    expect(recommendReviewStage(stages, { a: 100 }, {})).toBeUndefined();
  });

  it('並び順で最初の、100点で clearedWith があるステージを返す', () => {
    // Arrange
    const progress = { a: 100, b: 100, c: 100 };
    const assists = { b: { clearedWith: 'step' }, c: { clearedWith: 'answer' } } as const;

    // Act
    const review = recommendReviewStage(stages, progress, assists);

    // Assert
    expect(review?.id).toBe('b');
  });

  it('自己ベストが100未満のステージと、attempt だけのステージは選ばない', () => {
    // Arrange
    const progress = { a: 80, b: 100 };
    const assists = { a: { clearedWith: 'step' }, b: { attempt: 'answer' } } as const;

    // Act & Assert
    expect(recommendReviewStage(stages, progress, assists)).toBeUndefined();
  });

  it('stages が空なら undefined', () => {
    // Act & Assert
    expect(recommendReviewStage([], { a: 100 }, { a: { clearedWith: 'step' } })).toBeUndefined();
  });
});
