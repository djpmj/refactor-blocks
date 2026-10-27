import { describe, expect, it } from 'vitest';
import { isStageAssists, markAssist, recordClear, resetAttempt, retryMark, type Assists } from './assists';

describe('markAssist', () => {
  it('記録が空なら attempt を記録する', () => {
    // Act
    const next = markAssist({}, 'a', 'step');

    // Assert
    expect(next).toEqual({ a: { attempt: 'step' } });
  });

  it('より強い助けなら attempt が上がる', () => {
    // Arrange
    const assists: Assists = { a: { attempt: 'step' } };

    // Act
    const next = markAssist(assists, 'a', 'answer');

    // Assert
    expect(next).toEqual({ a: { attempt: 'answer' } });
  });

  it('より弱い助けでは変わらず、同じ参照を返す', () => {
    // Arrange
    const assists: Assists = { a: { attempt: 'answer' } };

    // Act
    const next = markAssist(assists, 'a', 'step');

    // Assert
    expect(next).toBe(assists);
  });

  it('他のステージの記録と同じステージの clearedWith は変えない', () => {
    // Arrange
    const assists: Assists = { a: { clearedWith: 'step' }, b: { attempt: 'ghost' } };

    // Act
    const next = markAssist(assists, 'a', 'ghost');

    // Assert
    expect(next).toEqual({ a: { clearedWith: 'step', attempt: 'ghost' }, b: { attempt: 'ghost' } });
  });
});

describe('resetAttempt', () => {
  it('attempt だけ消え、clearedWith は残る', () => {
    // Arrange
    const assists: Assists = { a: { attempt: 'ghost', clearedWith: 'ghost' } };

    // Act
    const next = resetAttempt(assists, 'a');

    // Assert
    expect(next).toEqual({ a: { clearedWith: 'ghost' } });
  });

  it('attempt だけのステージは記録ごと消える', () => {
    // Act
    const next = resetAttempt({ a: { attempt: 'step' }, b: { attempt: 'step' } }, 'a');

    // Assert
    expect(next).toEqual({ b: { attempt: 'step' } });
  });

  it('記録が無い・attempt が無いステージは同じ参照を返す', () => {
    // Arrange
    const assists: Assists = { a: { clearedWith: 'step' } };

    // Act & Assert
    expect(resetAttempt(assists, 'a')).toBe(assists);
    expect(resetAttempt(assists, 'zzz')).toBe(assists);
  });
});

describe('recordClear', () => {
  it('初めての100点は attempt を clearedWith にする', () => {
    // Act
    const next = recordClear({ a: { attempt: 'answer' } }, 'a', false);

    // Assert
    expect(next).toEqual({ a: { attempt: 'answer', clearedWith: 'answer' } });
  });

  it('初めての100点で attempt が無ければ変わらない(自力)', () => {
    // Arrange
    const assists: Assists = {};

    // Act & Assert
    expect(recordClear(assists, 'a', false)).toBe(assists);
  });

  it('100点済みで clearedWith が無ければ、attempt があっても印を付けない', () => {
    // Arrange
    const assists: Assists = { a: { attempt: 'answer' } };

    // Act & Assert
    expect(recordClear(assists, 'a', true)).toBe(assists);
  });

  it('100点済みで、より弱い助けでクリアし直すと弱まる', () => {
    // Act
    const next = recordClear({ a: { attempt: 'step', clearedWith: 'answer' } }, 'a', true);

    // Assert
    expect(next).toEqual({ a: { attempt: 'step', clearedWith: 'step' } });
  });

  it('100点済みで、より強い助けでは強めない', () => {
    // Arrange
    const assists: Assists = { a: { attempt: 'answer', clearedWith: 'step' } };

    // Act & Assert
    expect(recordClear(assists, 'a', true)).toBe(assists);
  });

  it('100点済みで、助けなしでクリアし直すと clearedWith が消える', () => {
    // Act
    const next = recordClear({ a: { clearedWith: 'ghost' }, b: { attempt: 'step' } }, 'a', true);

    // Assert
    expect(next).toEqual({ b: { attempt: 'step' } });
  });

  it('100点済みで同じ段階なら同じ参照を返す', () => {
    // Arrange
    const assists: Assists = { a: { attempt: 'ghost', clearedWith: 'ghost' } };

    // Act & Assert
    expect(recordClear(assists, 'a', true)).toBe(assists);
  });
});

describe('retryMark', () => {
  it('clearedWith を返す', () => {
    expect(retryMark({ a: { clearedWith: 'ghost' } }, 'a')).toBe('ghost');
  });

  it('記録が無い・attempt だけなら undefined', () => {
    expect(retryMark({ a: { attempt: 'step' } }, 'a')).toBeUndefined();
    expect(retryMark({}, 'a')).toBeUndefined();
  });
});

describe('isStageAssists', () => {
  it('3つの段階か未指定だけを通す', () => {
    // Act & Assert
    expect(isStageAssists({})).toBe(true);
    expect(isStageAssists({ attempt: 'answer', clearedWith: 'step' })).toBe(true);
    expect(isStageAssists({ attempt: 'hint' })).toBe(false);
    expect(isStageAssists({ clearedWith: 3 })).toBe(false);
    expect(isStageAssists(3)).toBe(false);
    expect(isStageAssists(null)).toBe(false);
    expect(isStageAssists([])).toBe(false);
  });
});
