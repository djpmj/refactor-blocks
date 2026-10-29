import { describe, expect, it } from 'vitest';
import { isQuizRecord } from './quizRecordStorage';

describe('isQuizRecord', () => {
  it('値がすべて correct か wrong のオブジェクトならtrue', () => {
    // Arrange・Act・Assert
    expect(isQuizRecord({})).toBe(true);
    expect(isQuizRecord({ q1: 'correct', q2: 'wrong' })).toBe(true);
  });

  it('オブジェクト以外はfalse', () => {
    // Arrange・Act・Assert
    expect(isQuizRecord(null)).toBe(false);
    expect(isQuizRecord([])).toBe(false);
    expect(isQuizRecord('x')).toBe(false);
  });

  it('correct・wrong 以外の値を含むとfalse', () => {
    // Arrange・Act・Assert
    expect(isQuizRecord({ q1: true })).toBe(false);
    expect(isQuizRecord({ q1: 'a' })).toBe(false);
  });
});
