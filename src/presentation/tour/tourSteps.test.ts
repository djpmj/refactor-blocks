import { describe, expect, it } from 'vitest';
import { nextTourStep, TOUR_STEPS, type TourEvent, type TourStep } from './tourSteps';

const steps: readonly TourStep[] = [
  { target: '#sidebar', text: 'Review the task', advance: { kind: 'next' } },
  { target: '#manual-fix-start', text: 'Start the opening fix', advance: { kind: 'manual-fix-started' } },
  { target: '#manual-fix', text: 'Release the opening fix', advance: { kind: 'manual-fix-released' } },
  { target: '#method', text: 'Select the method', advance: { kind: 'select-method', methodName: 'printMonthlyReport' } },
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
    const next = nextTourStep(steps, 3, expected);
    const unchanged = nextTourStep(steps, 3, other);

    // Assert
    expect(next).toBe(4);
    expect(unchanged).toBe(3);
  });

  it('手直しの開始だけで手順2から進み、リリースでは進まない', () => {
    // Arrange
    const started: TourEvent = { kind: 'manual-fix-started' };
    const released: TourEvent = { kind: 'manual-fix-released' };

    // Act
    const next = nextTourStep(steps, 1, started);
    const unchanged = nextTourStep(steps, 1, released);

    // Assert
    expect(next).toBe(2);
    expect(unchanged).toBe(1);
  });

  it('冒頭手直しのリリースだけで手順3から進み、別イベントでは進まない', () => {
    // Arrange
    const released: TourEvent = { kind: 'manual-fix-released' };
    const other: TourEvent = { kind: 'method-selected', methodName: 'printMonthlyReport' };

    // Act
    const next = nextTourStep(steps, 2, released);
    const unchanged = nextTourStep(steps, 2, other);

    // Assert
    expect(next).toBe(3);
    expect(unchanged).toBe(2);
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
    const mismatched: TourEvent = { kind: 'manual-fix-released' };

    // Act
    const skipped = nextTourStep(steps, 3, skip);
    const unchanged = nextTourStep(steps, 0, mismatched);

    // Assert
    expect(skipped).toBe(4);
    expect(unchanged).toBe(0);
  });

  it('最後の手順の文に行数の数字を書かない', () => {
    // Arrange
    const text = TOUR_STEPS[5].text;

    // Act
    const hasLineCount = /\d+行/.test(text);

    // Assert
    expect(hasLineCount).toBe(false);
  });
});
