import { describe, expect, it } from 'vitest';
import { isMilestones } from './progressStorage';

describe('isMilestones', () => {
  it('文字列キーと既知の段階名の配列の組ならtrue', () => {
    expect(isMilestones({ 'stage-1': ['concept-check', 'change-request'] })).toBe(true);
    expect(isMilestones({})).toBe(true);
  });

  it('値が配列でなければfalse', () => {
    expect(isMilestones({ 'stage-1': 'concept-check' })).toBe(false);
  });

  it('知らない段階名・文字列でない要素はfalse', () => {
    expect(isMilestones({ 'stage-1': ['quiz'] })).toBe(false);
    expect(isMilestones({ 'stage-1': [1] })).toBe(false);
  });

  it('null・配列・プリミティブはfalse', () => {
    expect(isMilestones(null)).toBe(false);
    expect(isMilestones([])).toBe(false);
    expect(isMilestones('x')).toBe(false);
  });
});
