import { describe, expect, it } from 'vitest';
import { scoreCountUpInput } from './useCountUp';

describe('scoreCountUpInput', () => {
  it('点数が上がった直後で、celebration がいまの点数と一致するときは前の点数から数える', () => {
    // Arrange
    const celebration = { seq: 3, scoreBefore: 90, scoreAfter: 100 };

    // Act
    const input = scoreCountUpInput(celebration, 100);

    // Assert
    expect(input).toEqual({ seq: 3, start: 90, enabled: true });
  });

  it('celebration が無いときは数えない', () => {
    // Arrange / Act
    const input = scoreCountUpInput(null, 90);

    // Assert
    expect(input).toEqual({ seq: null, start: 90, enabled: false });
  });

  it('点数が下がったときは数えない', () => {
    // Arrange
    const celebration = { seq: 2, scoreBefore: 90, scoreAfter: 80 };

    // Act
    const input = scoreCountUpInput(celebration, 80);

    // Assert
    expect(input).toEqual({ seq: null, start: 80, enabled: false });
  });

  it('同点(解消だけの celebration)のときは数えない', () => {
    // Arrange
    const celebration = { seq: 2, scoreBefore: 90, scoreAfter: 90 };

    // Act
    const input = scoreCountUpInput(celebration, 90);

    // Assert
    expect(input).toEqual({ seq: null, start: 90, enabled: false });
  });

  it('古い celebration(取り消し等で点数が合わない)のときは数えない', () => {
    // Arrange
    const celebration = { seq: 3, scoreBefore: 90, scoreAfter: 100 };

    // Act
    const input = scoreCountUpInput(celebration, 90);

    // Assert
    expect(input).toEqual({ seq: null, start: 90, enabled: false });
  });
});
