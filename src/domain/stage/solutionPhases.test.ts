import { describe, expect, it } from 'vitest';
import { phaseOfStep, type SolutionPhase } from './solutionPhases';

const phases: readonly SolutionPhase[] = [
  { title: '1つ目', why: 'a', from: 0 },
  { title: '2つ目', why: 'b', from: 8 },
  { title: '3つ目', why: 'c', from: 11 },
];

describe('phaseOfStep', () => {
  it.each([
    [0, '1つ目'],
    [7, '1つ目'],
    [8, '2つ目'],
    [10, '2つ目'],
    [11, '3つ目'],
    [19, '3つ目'],
  ])('手順%iは%sに属する', (stepIndex, title) => {
    // Arrange & Act
    const phase = phaseOfStep(phases, stepIndex);

    // Assert
    expect(phase?.title).toBe(title);
  });

  it('方針が空なら undefined', () => {
    // Arrange & Act
    const phase = phaseOfStep([], 3);

    // Assert
    expect(phase).toBeUndefined();
  });
});
