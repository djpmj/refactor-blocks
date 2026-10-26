import { describe, expect, it } from 'vitest';
import type { ChangeRequest } from '../change/ChangeRequest';
import type { ConceptCheck, Stage } from '../stage/Stage';
import { addMilestone, remainingMilestones } from './milestones';

const check: ConceptCheck = { id: 'c', question: '?', choices: [{ text: 'a', explanation: '' }, { text: 'b', explanation: '' }], answer: 0 };

function stageOf(checkCount: number, requestCount: number): Pick<Stage, 'id' | 'checks' | 'changeRequests'> {
  const request: ChangeRequest = { id: 'r', title: '', description: '', responsibility: 'x', linesPerSite: 1 };
  return { id: 'a', checks: Array.from({ length: checkCount }, () => check), changeRequests: Array.from({ length: requestCount }, () => request) };
}

describe('addMilestone', () => {
  it('空の記録に段階を足す', () => {
    // Arrange
    const milestones = {};

    // Act
    const next = addMilestone(milestones, 'a', 'concept-check');

    // Assert
    expect(next).toEqual({ a: ['concept-check'] });
    expect(milestones).toEqual({});
  });

  it('同じステージに別の段階を足すと並べて持つ', () => {
    // Arrange
    const milestones = { a: ['concept-check'] as const };

    // Act
    const next = addMilestone(milestones, 'a', 'change-request');

    // Assert
    expect(next).toEqual({ a: ['concept-check', 'change-request'] });
  });

  it('記録済みなら同じ参照を返す', () => {
    // Arrange
    const milestones = { a: ['concept-check'] as const };

    // Act
    const next = addMilestone(milestones, 'a', 'concept-check');

    // Assert
    expect(next).toBe(milestones);
  });

  it('別のステージの記録は変えない', () => {
    // Arrange
    const milestones = { b: ['change-request'] as const };

    // Act
    const next = addMilestone(milestones, 'a', 'concept-check');

    // Assert
    expect(next).toEqual({ a: ['concept-check'], b: ['change-request'] });
  });
});

describe('remainingMilestones', () => {
  it('記録なしなら両方残る', () => {
    expect(remainingMilestones(stageOf(2, 1), {})).toEqual(['concept-check', 'change-request']);
  });

  it('変更依頼だけ記録すれば理解度チェックが残る', () => {
    expect(remainingMilestones(stageOf(2, 1), { a: ['change-request'] })).toEqual(['concept-check']);
  });

  it('両方記録すれば何も残らない(記録の並びは問わない)', () => {
    expect(remainingMilestones(stageOf(2, 1), { a: ['change-request', 'concept-check'] })).toEqual([]);
  });

  it('理解度チェックが0問なら求めない', () => {
    expect(remainingMilestones(stageOf(0, 1), {})).toEqual(['change-request']);
  });

  it('変更依頼が0件なら求めない', () => {
    expect(remainingMilestones(stageOf(2, 0), {})).toEqual(['concept-check']);
  });
});
