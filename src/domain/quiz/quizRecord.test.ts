import { describe, expect, it } from 'vitest';
import { recordQuizAnswer, summarizeQuizRecord } from './quizRecord';

describe('recordQuizAnswer', () => {
  it('正解なら correct を足す', () => {
    // Arrange・Act
    const result = recordQuizAnswer({}, 'q1', true);

    // Assert
    expect(result).toEqual({ q1: 'correct' });
  });

  it('不正解なら wrong を足す', () => {
    // Arrange・Act
    const result = recordQuizAnswer({}, 'q1', false);

    // Assert
    expect(result).toEqual({ q1: 'wrong' });
  });

  it('wrong のあとに正解すると correct になる', () => {
    // Arrange・Act
    const result = recordQuizAnswer({ q1: 'wrong' }, 'q1', true);

    // Assert
    expect(result).toEqual({ q1: 'correct' });
  });

  it('一度 correct になった問題は、あとでまちがえても correct のまま', () => {
    // Arrange・Act
    const result = recordQuizAnswer({ q1: 'correct' }, 'q1', false);

    // Assert
    expect(result).toEqual({ q1: 'correct' });
  });

  it('他の問題の記録は残る', () => {
    // Arrange・Act
    const result = recordQuizAnswer({ q2: 'wrong' }, 'q1', true);

    // Assert
    expect(result).toEqual({ q1: 'correct', q2: 'wrong' });
  });

  it('元の記録を変更しない', () => {
    // Arrange
    const record = { q1: 'wrong' } as const;

    // Act
    recordQuizAnswer(record, 'q1', true);

    // Assert
    expect(record).toEqual({ q1: 'wrong' });
  });
});

describe('summarizeQuizRecord', () => {
  it('1問も答えていなければ answered は0', () => {
    // Arrange・Act
    const result = summarizeQuizRecord(['q1', 'q2'], {});

    // Assert
    expect(result).toEqual({ correct: 0, answered: 0, total: 2 });
  });

  it('正解と不正解を数える', () => {
    // Arrange・Act
    const result = summarizeQuizRecord(['q1', 'q2'], { q1: 'correct', q2: 'wrong' });

    // Assert
    expect(result).toEqual({ correct: 1, answered: 2, total: 2 });
  });

  it('全問正解', () => {
    // Arrange・Act
    const result = summarizeQuizRecord(['q1', 'q2'], { q1: 'correct', q2: 'correct' });

    // Assert
    expect(result).toEqual({ correct: 2, answered: 2, total: 2 });
  });

  it('quizIds に無いIDの記録は数えない', () => {
    // Arrange・Act
    const result = summarizeQuizRecord(['q1'], { q1: 'wrong', old: 'correct' });

    // Assert
    expect(result).toEqual({ correct: 0, answered: 1, total: 1 });
  });

  it('問題が無ければすべて0', () => {
    // Arrange・Act
    const result = summarizeQuizRecord([], {});

    // Assert
    expect(result).toEqual({ correct: 0, answered: 0, total: 0 });
  });
});
