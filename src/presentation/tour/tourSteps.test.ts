import { describe, expect, it } from 'vitest';
import { nextTourStep, type TourEvent, type TourStep } from './tourSteps';

const steps: readonly TourStep[] = [
  { target: '#sidebar', text: 'Review the task', advance: { kind: 'next' } },
  { target: '#manual-fix', text: 'Release the opening fix', advance: { kind: 'manual-fix-released' } },
  { target: '#method', text: 'Select the method', advance: { kind: 'select-method', methodName: 'printMonthlyReport' } },
  { target: '#fragments', text: 'Choose a fragment', advance: { kind: 'click-inside' } },
  { target: '#extract', text: 'Extract it', advance: { kind: 'extract' } },
];

describe('nextTourStep', () => {
  it('advances a next step and ends after the last step', () => {
    // Arrange
    const event: TourEvent = { kind: 'next' };

    // Act
    const next = nextTourStep(steps, 0, event);
    const finished = nextTourStep(steps, steps.length - 1, event);

    // Assert
    expect(next).toBe(1);
    expect(finished).toBeNull();
  });

  it('advances only when the expected method is selected', () => {
    // Arrange
    const expected: TourEvent = { kind: 'method-selected', methodName: 'printMonthlyReport' };
    const other: TourEvent = { kind: 'method-selected', methodName: 'other' };

    // Act
    const next = nextTourStep(steps, 2, expected);
    const unchanged = nextTourStep(steps, 2, other);

    // Assert
    expect(next).toBe(3);
    expect(unchanged).toBe(2);
  });

  it('冒頭手直しのリリースだけで次へ進み、別イベントでは進まない', () => {
    const released: TourEvent = { kind: 'manual-fix-released' };
    const other: TourEvent = { kind: 'method-selected', methodName: 'printMonthlyReport' };
    expect(nextTourStep(steps, 1, released)).toBe(2);
    expect(nextTourStep(steps, 1, other)).toBe(1);
  });

  it('advances after a click inside the target', () => {
    // Arrange
    const event: TourEvent = { kind: 'clicked-inside' };

    // Act
    const result = nextTourStep(steps, 3, event);

    // Assert
    expect(result).toBe(4);
  });

  it('advances after a successful method-count increase only', () => {
    // Arrange
    const increased: TourEvent = { kind: 'method-count', count: 4, countAtStepStart: 3 };
    const unchanged: TourEvent = { kind: 'method-count', count: 3, countAtStepStart: 3 };

    // Act
    const next = nextTourStep(steps, 4, increased);
    const same = nextTourStep(steps, 4, unchanged);

    // Assert
    expect(next).toBeNull();
    expect(same).toBe(4);
  });

  it('allows skipping when an action target is unavailable and ignores mismatched events', () => {
    // Arrange
    const skip: TourEvent = { kind: 'next' };
    const mismatched: TourEvent = { kind: 'clicked-inside' };

    // Act
    const skipped = nextTourStep(steps, 3, skip);
    const unchanged = nextTourStep(steps, 0, mismatched);

    // Assert
    expect(skipped).toBe(4);
    expect(unchanged).toBe(0);
  });
});
