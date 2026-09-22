import { describe, expect, it } from 'vitest';
import { findChangeSites } from '../../domain/change/findChangeSites';
import { measureChange } from '../../domain/change/measureChange';
import { averageScore, scoreChange } from '../../domain/change/scoreChange';
import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { scoreCodebase } from '../../domain/scoring/score';
import type { Result } from '../../domain/shared/Result';
import { applySolutionSteps, sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { stages } from './stageCatalog';

/** ステージの狙いを飛ばした手順。これで100点になってしまうなら、ステージの数値の作りが甘い。 */
const shortcuts: ReadonlyArray<{ readonly stageId: string; readonly description: string; readonly steps: readonly SolutionStep[] }> = [
  {
    stageId: 'beginner-user-controller',
    description: 'Mailer を使わず、DBとメールの処理をまとめて UserRepository へ移す',
    steps: [
      { extract: { from: 'registerUser', fragmentIds: ['frag-save-user', 'frag-welcome-mail'], name: 'saveAndWelcome' } },
      { extract: { from: 'deleteUser', fragmentIds: ['frag-delete-user', 'frag-farewell-mail'], name: 'deleteAndFarewell' } },
      { move: { method: 'saveAndWelcome', toClass: 'UserRepository' } },
      { move: { method: 'deleteAndFarewell', toClass: 'UserRepository' } },
    ],
  },
  {
    stageId: 'intermediate-cyclic-dependency',
    description: 'countOrdersOf だけを Customer へ移す',
    steps: [
      { move: { method: 'countOrdersOf', toClass: 'Customer' } },
      { extract: { from: 'checkout', fragmentIds: ['frag-reserve-stock', 'frag-order-total'], name: 'prepareOrder' } },
    ],
  },
  {
    stageId: 'intermediate-cyclic-dependency',
    description: 'calculateOrderTotal だけを Order へ移す',
    steps: [
      { move: { method: 'calculateOrderTotal', toClass: 'Order' } },
      { extract: { from: 'checkout', fragmentIds: ['frag-reserve-stock', 'frag-order-total'], name: 'prepareOrder' } },
    ],
  },
];

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
  return result.value;
}

function longestMethodLines(codebase: Codebase): number {
  const methods = allClasses(codebase).flatMap((codeClass) => codeClass.methods);
  return Math.max(...methods.map((method) => methodLines(method)));
}

function changeReadiness(stage: Stage, codebase: Codebase): number {
  const scores = stage.changeRequests.map((request) => scoreChange(unwrap(measureChange(codebase, request, stage.limits))));
  return averageScore(scores);
}

function classesTouchedPerRequest(stage: Stage, codebase: Codebase): number[] {
  return stage.changeRequests.map((request) => unwrap(measureChange(codebase, request, stage.limits)).classesTouched);
}

function isNoWorse(before: readonly number[], after: readonly number[]): boolean {
  return after.every((count, index) => count <= (before[index] ?? 0));
}

function allRequestsHaveSites(stage: Stage): boolean {
  return stage.changeRequests.every((request) => findChangeSites(stage.codebase, request).length > 0);
}

function allIds(stage: Stage): string[] {
  const { files } = stage.codebase;
  const classes = allClasses(stage.codebase);
  const methods = classes.flatMap((codeClass) => codeClass.methods);
  const fragments = methods.flatMap((method) => method.fragments);
  return [...files, ...classes, ...methods, ...fragments].map((item) => item.id);
}

describe('stageCatalog', () => {
  it('チュートリアル・初級・中級・上級の順に、それぞれ1つ以上のステージが並んでいる', () => {
    // Arrange
    const expectedOrder = ['tutorial', 'beginner', 'intermediate', 'advanced'];

    // Act
    const levels = [...new Set(stages.map((stage) => stage.level))];

    // Assert
    expect(levels).toEqual(expectedOrder);
  });

  it('ステージIDは重複しない', () => {
    // Arrange
    const ids = stages.map((stage) => stage.id);

    // Act
    const unique = new Set(ids);

    // Assert
    expect(unique.size).toBe(ids.length);
  });

  describe.each(stages.map((stage) => [stage.title, stage] as const))('%s', (_title, stage) => {
    it('ステージ内のファイル・クラス・メソッド・処理のIDは重複しない', () => {
      // Arrange
      const ids = allIds(stage);

      // Act
      const unique = new Set(ids);

      // Assert
      expect(unique.size).toBe(ids.length);
    });

    it('どんなコードを表しているかの説明がある', () => {
      // Arrange
      const { description } = stage;

      // Act
      const trimmed = description.trim();

      // Assert
      expect(trimmed).not.toBe('');
    });

    it('実業務の規模に合わせ、80行以上のメソッドが1つ以上ある', () => {
      // Arrange
      const { codebase } = stage;

      // Act
      const longest = longestMethodLines(codebase);

      // Assert
      expect(longest).toBeGreaterThanOrEqual(80);
    });

    it('行数の上限は メソッド < クラス < ファイル の順に大きい', () => {
      // Arrange
      const { method, class: classLimit, file } = stage.limits;

      // Act
      const ascending = method < classLimit && classLimit < file;

      // Assert
      expect(ascending).toBe(true);
    });

    it('初期状態では減点がある', () => {
      // Arrange
      const { codebase } = stage;

      // Act
      const score = scoreCodebase(codebase, stage);

      // Assert
      expect(score.total).toBeLessThan(100);
    });

    it('模範解答どおりに操作すると100点になる', () => {
      // Arrange
      expect(sampleAnswerSteps[stage.id]).toBeDefined();

      // Act
      const solved = applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id] ?? []);

      // Assert
      expect(scoreCodebase(solved, stage)).toEqual(expect.objectContaining({ total: 100 }));
    });

    it('変更依頼が2件以上あり、どれも初期のコードに変更箇所がある', () => {
      // Arrange
      const { changeRequests } = stage;

      // Act
      const everyRequestHasSites = allRequestsHaveSites(stage);

      // Assert
      expect(changeRequests.length).toBeGreaterThanOrEqual(2);
      expect(everyRequestHasSites).toBe(true);
    });

    it('模範解答にすると、変更依頼のコストが初期状態より下がる(変更容易性スコアが上がる)', () => {
      // Arrange
      const solved = applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id] ?? []);

      // Act
      const before = changeReadiness(stage, stage.codebase);
      const after = changeReadiness(stage, solved);

      // Assert
      expect(after).toBeGreaterThan(before);
    });

    it('模範解答にしても、変更が必要なクラスの数は初期状態より増えない', () => {
      // Arrange
      const solved = applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id] ?? []);

      // Act
      const before = classesTouchedPerRequest(stage, stage.codebase);
      const after = classesTouchedPerRequest(stage, solved);

      // Assert
      expect(isNoWorse(before, after)).toBe(true);
    });
  });

  it.each(shortcuts)('$stageId: 「$description」では100点にならない', ({ stageId, steps }) => {
    // Arrange
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (stage === undefined) throw new Error(`ステージ ${stageId} がありません`);

    // Act
    const played = applySolutionSteps(stage.codebase, steps);

    // Assert
    expect(scoreCodebase(played, stage).total).toBeLessThan(100);
  });
});
