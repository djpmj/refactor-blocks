import { describe, expect, it } from 'vitest';
import { findClass } from '../../domain/codebase/Codebase';
import { scoreCodebase } from '../../domain/scoring/score';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import { intermediateStages } from './intermediateStages';

describe('intermediate-middle-man', () => {
  const stage = intermediateStages.find(({ id }) => id === 'intermediate-middle-man');
  if (stage === undefined) throw new Error('中級12がありません');

  it('初期状態はMiddle Manで90点、模範解答はManagerを削除して100点になる', () => {
    // Arrange / Act
    const initial = scoreCodebase(stage.codebase, stage);
    const solved = sampleAnswerCodebase(stage);
    const finalScore = scoreCodebase(solved, stage);

    // Assert
    expect(initial.total).toBe(90);
    expect(initial.deductions.find(({ rule }) => rule === 'middle-man')).toEqual({ rule: 'middle-man', count: 1, points: 10 });
    expect(findClass(solved, 'class-order-manager')).toBeUndefined();
    expect(finalScore.total).toBe(100);
  });
});
