import { describe, expect, it } from 'vitest';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { describeCritiqueTiming } from './describeCritiqueTiming';

const [stage] = stages;
const codebase = stage.codebase;
const otherCodebase = { ...stage.codebase };

describe('describeCritiqueTiming', () => {
  it('取得時と同じ参照のコードなら古くなく、点数と手数を出す', () => {
    // Arrange
    const snapshot = { codebase, total: 72, moves: 2 };

    // Act
    const timing = describeCritiqueTiming(snapshot, codebase);

    // Assert
    expect(timing).toEqual({ stale: false, text: '72点・2手の時点の講評です' });
  });

  it('手数が undefined なら点数だけを出す', () => {
    // Arrange
    const snapshot = { codebase, total: 72, moves: undefined };

    // Act
    const timing = describeCritiqueTiming(snapshot, codebase);

    // Assert
    expect(timing).toEqual({ stale: false, text: '72点の時点の講評です' });
  });

  it('手数が0でも「0手」と出す', () => {
    // Arrange
    const snapshot = { codebase, total: 72, moves: 0 };

    // Act
    const timing = describeCritiqueTiming(snapshot, codebase);

    // Assert
    expect(timing.text).toBe('72点・0手の時点の講評です');
  });

  it('別の参照のコードなら古いと出す', () => {
    // Arrange
    const snapshot = { codebase, total: 72, moves: 2 };

    // Act
    const timing = describeCritiqueTiming(snapshot, otherCodebase);

    // Assert
    expect(timing).toEqual({ stale: true, text: 'この講評は古くなりました(72点・2手の時点)。今のコードとは違います' });
  });

  it('内容が同じでも別の参照なら古い(参照で比べる)', () => {
    // Arrange
    const snapshot = { codebase, total: 72, moves: 1 };

    // Act
    const timing = describeCritiqueTiming(snapshot, structuredClone(codebase));

    // Assert
    expect(timing.stale).toBe(true);
  });

  it('古い+手数なしなら点数だけで古いと出す', () => {
    // Arrange
    const snapshot = { codebase, total: 72, moves: undefined };

    // Act
    const timing = describeCritiqueTiming(snapshot, otherCodebase);

    // Assert
    expect(timing.text).toBe('この講評は古くなりました(72点の時点)。今のコードとは違います');
  });
});
