import { describe, expect, it } from 'vitest';
import { isMilestones, isProgress } from './progressStorage';

describe('isProgress', () => {
  it('文字列キーと0〜100の数値の組ならtrue', () => {
    // Arrange
    const value = { 'stage-1': 80, 'stage-2': 100 };

    // Act & Assert
    expect(isProgress(value)).toBe(true);
  });

  it('空オブジェクトはtrue', () => {
    // Arrange
    const value = {};

    // Act & Assert
    expect(isProgress(value)).toBe(true);
  });

  it('値が数値でなければfalse', () => {
    // Arrange
    const value = { 'stage-1': '80' };

    // Act & Assert
    expect(isProgress(value)).toBe(false);
  });

  it('値が範囲外の数値ならfalse', () => {
    // Arrange
    const value = { 'stage-1': 150 };

    // Act & Assert
    expect(isProgress(value)).toBe(false);
  });

  it('null・配列・プリミティブはfalse', () => {
    expect(isProgress(null)).toBe(false);
    expect(isProgress([1, 2])).toBe(false);
    expect(isProgress('not an object')).toBe(false);
    expect(isProgress(42)).toBe(false);
  });
});

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
