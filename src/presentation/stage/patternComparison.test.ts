import { describe, expect, it } from 'vitest';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { PATTERN_COMPARISON } from './patternComparison';

describe('PATTERN_COMPARISON', () => {
  it('すべての stageId が上級ステージとして存在する', () => {
    // Arrange
    const ids = PATTERN_COMPARISON.map((entry) => entry.stageId);

    // Act
    const levelOf = (id: string) => stages.find((stage) => stage.id === id)?.level;
    const levels = ids.map(levelOf);

    // Assert
    expect(levels).toEqual(ids.map(() => 'advanced'));
  });

  it('name と stageId が重複しない', () => {
    // Arrange
    const entries = PATTERN_COMPARISON;

    // Act
    const names = new Set(entries.map((entry) => entry.name));
    const ids = new Set(entries.map((entry) => entry.stageId));

    // Assert
    expect(names.size).toBe(entries.length);
    expect(ids.size).toBe(entries.length);
  });

  it('4つの観点がどれも空文字でない', () => {
    // Arrange
    const entries = PATTERN_COMPARISON;

    // Act
    const isBlank = (text: string) => text.trim() === '';
    const blank = entries.filter((e) => [e.whenToUse, e.whatVaries, e.structure, e.notSuitedFor].some(isBlank));

    // Assert
    expect(blank).toEqual([]);
  });

  it('5件で、Strategy → State → Template Method → Factory → ISP の順に並ぶ', () => {
    // Arrange
    const entries = PATTERN_COMPARISON;

    // Act
    const names = entries.map((entry) => entry.name);

    // Assert
    expect(names).toEqual(['Strategy', 'State', 'Template Method', 'Factory', 'ISP(インターフェース分離)']);
  });
});
