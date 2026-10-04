import { describe, expect, it } from 'vitest';
import { judgeCheck, validateCheck } from './conceptCheck';
import type { ConceptCheck } from './Stage';

function makeCheck(overrides: Partial<ConceptCheck> = {}): ConceptCheck {
  return {
    id: 'c1',
    question: '問題文',
    choices: [
      { text: 'A', explanation: 'aの解説' },
      { text: 'B', explanation: 'bの解説' },
      { text: 'C', explanation: 'cの解説' },
    ],
    answer: 1,
    ...overrides,
  };
}

describe('judgeCheck', () => {
  it('正解の添字を選ぶと正解になる', () => {
    // Arrange
    const check = makeCheck();

    // Act
    const result = judgeCheck(check, 1);

    // Assert
    expect(result).toEqual({ correct: true, answer: 1 });
  });

  it('別の添字を選ぶと不正解で、正解の添字が返る', () => {
    // Arrange
    const check = makeCheck();

    // Act
    const result = judgeCheck(check, 0);

    // Assert
    expect(result).toEqual({ correct: false, answer: 1 });
  });

  it.each([-1, 3])('範囲外の添字(%i)は不正解', (chosen) => {
    // Arrange
    const check = makeCheck();

    // Act
    const result = judgeCheck(check, chosen);

    // Assert
    expect(result.correct).toBe(false);
  });
});

describe('validateCheck', () => {
  it('決まりを満たせば ok', () => {
    // Arrange
    const check = makeCheck();

    // Act
    const result = validateCheck(check);

    // Assert
    expect(result).toEqual({ ok: true, value: check });
  });

  it('選択肢2個は too-few-choices、5個は too-many-choices', () => {
    // Arrange
    const choice = (text: string) => ({ text, explanation: 'x' });
    const few = makeCheck({ choices: [choice('A'), choice('B')], answer: 0 });
    const many = makeCheck({ choices: ['A', 'B', 'C', 'D', 'E'].map(choice) });

    // Act
    const fewResult = validateCheck(few);
    const manyResult = validateCheck(many);

    // Assert
    expect(fewResult).toEqual({ ok: false, error: 'too-few-choices' });
    expect(manyResult).toEqual({ ok: false, error: 'too-many-choices' });
  });

  it.each([-1, 3])('answer が範囲外(%i)は answer-out-of-range', (answer) => {
    // Arrange
    const check = makeCheck({ answer });

    // Act
    const result = validateCheck(check);

    // Assert
    expect(result).toEqual({ ok: false, error: 'answer-out-of-range' });
  });

  it('問題文・選択肢・解説が空白だけなら empty-text', () => {
    // Arrange
    const base = makeCheck();
    const blankQuestion = makeCheck({ question: '  ' });
    const blankChoice = makeCheck({ choices: [{ text: ' ', explanation: 'x' }, ...base.choices.slice(1)] });
    const blankExplanation = makeCheck({ choices: [{ text: 'A', explanation: '' }, ...base.choices.slice(1)] });

    // Act
    const results = [blankQuestion, blankChoice, blankExplanation].map(validateCheck);

    // Assert
    expect(results).toEqual(Array.from({ length: 3 }, () => ({ ok: false, error: 'empty-text' })));
  });

  it('同じ文の選択肢が2つあれば duplicate-choice', () => {
    // Arrange
    const check = makeCheck({
      choices: [
        { text: 'A', explanation: 'x' },
        { text: 'A', explanation: 'y' },
        { text: 'C', explanation: 'z' },
      ],
    });

    // Act
    const result = validateCheck(check);

    // Assert
    expect(result).toEqual({ ok: false, error: 'duplicate-choice' });
  });
});
