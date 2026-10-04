import { describe, expect, it } from 'vitest';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { stages } from './stageCatalog';

const found = stages.find((candidate) => candidate.id === 'intermediate-layered-order-api');
if (found === undefined) throw new Error('中級11 (intermediate-layered-order-api) がありません');
const stage: Stage = found;

/** 保存の処理だけを抜き出して OrderRepository へ移し、呼び出しを Controller に残した手順。 */
const repositoryOnly: readonly SolutionStep[] = [
  { extract: { from: 'placeOrder', fragmentIds: ['frag-place-save'], name: 'saveOrder' } },
  { move: { method: 'saveOrder', toClass: 'OrderRepository' } },
];

function layerCount(steps: readonly SolutionStep[]): number {
  const played = applySolutionSteps(stage.codebase, steps);
  return scoreCodebase(played, stage).deductions.find((deduction) => deduction.rule === 'layer')?.count ?? -1;
}

describe('中級11: Controller に全部書いてある注文API', () => {
  it('初期状態は100点にならず、模範解答で100点になる', () => {
    // Arrange
    const steps = sampleAnswerSteps[stage.id] ?? [];

    // Act
    const initial = scoreCodebase(stage.codebase, stage);
    const solved = scoreCodebase(applySolutionSteps(stage.codebase, steps), stage);

    // Assert
    expect(initial.total).toBeLessThan(100);
    expect(solved.total).toBe(100);
  });

  it('保存だけを Repository へ移して Controller に呼び出しを残すと、層を飛ばしているので layer が減点される', () => {
    // Arrange / Act
    const count = layerCount(repositoryOnly);

    // Assert
    expect(count).toBe(1);
  });

  it('模範解答(Controller → Service → Repository)では layer の減点が0', () => {
    // Arrange / Act
    const count = layerCount(sampleAnswerSteps[stage.id] ?? []);

    // Assert
    expect(count).toBe(0);
  });

  it('層を持つのはこのステージだけ(既存ステージの採点は変わらない)', () => {
    // Arrange / Act
    const withLayers = stages.filter((candidate) => candidate.layers !== undefined).map((candidate) => candidate.id);

    // Assert
    expect(withLayers).toEqual([stage.id]);
  });
});
