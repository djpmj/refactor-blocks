import { describe, expect, it } from 'vitest';
import { nextTourStep, TOUR_STEPS, tourResultOf, tourResultText, type TourEvent, type TourResult, type TourStep } from './tourSteps';

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
    const hasLineCount = /\d行/.test(text);

    // Assert
    expect(hasLineCount).toBe(false);
  });
});

describe('tourResultOf', () => {
  it.each([
    [{ total: 90, deducted: 10 }, { total: 100, deducted: 0 }, 'cleared'],
    [{ total: 70, deducted: 30 }, { total: 90, deducted: 10 }, 'improved'],
    [{ total: 90, deducted: 10 }, { total: 80, deducted: 20 }, 'worsened'],
    [{ total: 90, deducted: 10 }, { total: 90, deducted: 10 }, 'unchanged'],
    [{ total: 100, deducted: 0 }, { total: 100, deducted: 0 }, 'cleared'],
    [{ total: 0, deducted: 120 }, { total: 0, deducted: 110 }, 'improved'],
  ] as const)('前 %j・後 %j は %s', (before, after, kind) => {
    // Arrange / Act
    const result = tourResultOf(before, after);

    // Assert
    expect(result).toEqual({ kind, totalBefore: before.total, totalAfter: after.total });
  });
});

describe('tourResultText', () => {
  const textOf = (kind: TourResult['kind'], totalBefore: number, totalAfter: number) => tourResultText({ kind, totalBefore, totalAfter });

  it('cleared はクリア条件を満たしたと伝え、続けさせない', () => {
    // Arrange / Act
    const text = textOf('cleared', 90, 100);

    // Assert
    expect(text).toContain('クリア条件をすべて満たしました');
    expect(text).toContain('100 点');
    expect(text).not.toContain('続けてみよう');
  });

  it('improved は前後の点数を出す', () => {
    // Arrange / Act / Assert
    expect(textOf('improved', 70, 90)).toContain('70 → 90 点に上がりました');
  });

  it('worsened は下がったことと元に戻す手段を伝える', () => {
    // Arrange / Act
    const text = textOf('worsened', 90, 80);

    // Assert
    expect(text).toContain('90 → 80 点に下がりました');
    expect(text).toContain('元に戻す');
  });

  it('unchanged は新しいメソッドができたとは言わない', () => {
    // Arrange / Act
    const text = textOf('unchanged', 90, 90);

    // Assert
    expect(text).toContain('90 点のまま');
    expect(text).not.toContain('新しいメソッドができ');
  });

  it('4種類とも行数の数字を書かない', () => {
    // Arrange
    const kinds = ['cleared', 'improved', 'worsened', 'unchanged'] as const;

    // Act
    const hasLineCount = kinds.map((kind) => /\d行/.test(textOf(kind, 70, 90)));

    // Assert
    expect(hasLineCount).toEqual([false, false, false, false]);
  });
});
