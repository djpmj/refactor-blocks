import { describe, expect, it } from 'vitest';
import { allClasses } from '../../domain/codebase/Codebase';
import { remainingMilestones } from '../../domain/progress/milestones';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const drills = stages.filter((stage) => stage.level === 'drill');

const failures: ReadonlyArray<{ readonly stageId: string; readonly description: string; readonly steps: readonly SolutionStep[] }> = [
  { stageId: 'drill-extract-tail', description: '送信だけ抽出する', steps: [{ extract: { from: 'registerMember', fragmentIds: ['frag-drill-mail-send'], name: 'sendMail' } }] },
  {
    stageId: 'drill-extract-tail',
    description: '保存と本文を抽出する(mixed-method)',
    steps: [{ extract: { from: 'registerMember', fragmentIds: ['frag-drill-save-member', 'frag-drill-mail-body'], name: 'saveAndBuild' } }],
  },
  { stageId: 'drill-extract-middle', description: '小計だけ抽出する', steps: [{ extract: { from: 'issueInvoice', fragmentIds: ['frag-drill-subtotal'], name: 'calculateSubtotal' } }] },
  {
    stageId: 'drill-extract-middle',
    description: '読み込みと小計を抽出する(mixed-method)',
    steps: [{ extract: { from: 'issueInvoice', fragmentIds: ['frag-drill-load-order', 'frag-drill-subtotal'], name: 'loadAndSubtotal' } }],
  },
  {
    stageId: 'drill-move-method',
    description: '新しいクラスへ移すと ShippingCalculator が空のまま残る(empty)',
    steps: [
      { addFile: 'src/shipping/ShippingFee.ts' },
      { addClass: { name: 'ShippingFee', file: 'src/shipping/ShippingFee.ts' } },
      { move: { method: 'calculateShippingFee', toClass: 'ShippingFee' } },
    ],
  },
];

describe('1操作のドリル', () => {
  it('3本がカタログの最後に並ぶ', () => {
    // Arrange & Act
    const ids = drills.map((stage) => stage.id);

    // Assert
    expect(ids).toEqual(['drill-extract-tail', 'drill-extract-middle', 'drill-move-method']);
    expect(stages.slice(-3)).toEqual(drills);
  });

  it.each(drills)('$id は1手で100点になり、クリア後の段階がない', (stage) => {
    // Arrange
    const steps = sampleAnswerSteps[stage.id] ?? [];
    const fragmentCount = allClasses(stage.codebase).flatMap((codeClass) => codeClass.methods).flatMap((method) => method.fragments).length;

    // Act
    const initialScore = scoreCodebase(stage.codebase, stage).total;
    const answeredScore = scoreCodebase(applySolutionSteps(stage.codebase, steps), stage).total;

    // Assert
    expect(stage.checks).toEqual([]);
    expect(stage.changeRequests).toEqual([]);
    expect([['Extract Method'], ['Move Method']]).toContainEqual(stage.learns);
    expect(steps).toHaveLength(1);
    expect(steps[0] && ('extract' in steps[0] || 'move' in steps[0])).toBe(true);
    expect(stage.codebase.files.length).toBeLessThanOrEqual(2);
    expect(fragmentCount).toBeLessThanOrEqual(6);
    expect(initialScore).toBeLessThan(100);
    expect(answeredScore).toBe(100);
    expect(remainingMilestones(stage, {})).toEqual([]);
  });

  it.each(failures)('$stageId: 「$description」と100点にならない', ({ stageId, steps }) => {
    // Arrange
    const stage = drills.find((item) => item.id === stageId);
    if (stage === undefined) throw new Error(stageId);

    // Act
    const played = applySolutionSteps(stage.codebase, steps);

    // Assert
    expect(scoreCodebase(played, stage).total).toBeLessThan(100);
  });
});
