import { describe, expect, it } from 'vitest';
import { stageStep } from './stageStep';

describe('stageStep', () => {
  it('modify 依頼がなければ手直しを飛ばす', () => {
    expect(stageStep({ score: 50, hasModifyRequest: false, openingDone: false, closingSolved: false })).toBe('refactor');
    expect(stageStep({ score: 100, hasModifyRequest: false, openingDone: false, closingSolved: false })).toBe('change-request');
  });

  it('modify 依頼があれば点数に関係なく冒頭手直しを先にする', () => {
    expect(stageStep({ score: 100, hasModifyRequest: true, openingDone: false, closingSolved: false })).toBe('opening-fix');
    expect(stageStep({ score: 50, hasModifyRequest: true, openingDone: false, closingSolved: false })).toBe('opening-fix');
  });

  it('100点未満ならrefactor、100点なら仕上げの正解まで止める', () => {
    expect(stageStep({ score: 99, hasModifyRequest: true, openingDone: true, closingSolved: true })).toBe('refactor');
    expect(stageStep({ score: 100, hasModifyRequest: true, openingDone: true, closingSolved: false })).toBe('closing-fix');
    expect(stageStep({ score: 100, hasModifyRequest: true, openingDone: true, closingSolved: true })).toBe('change-request');
  });
});
