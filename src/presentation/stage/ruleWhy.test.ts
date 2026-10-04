import { describe, expect, it } from 'vitest';
import { RULE_LABEL } from './describeScore';
import { RULE_WHY } from './ruleWhy';

describe('RULE_WHY', () => {
  it('全ルールに空でない理由がある', () => {
    // Arrange
    const rules = Object.keys(RULE_LABEL);

    // Act
    const entries = Object.values(RULE_WHY);

    // Assert
    expect(rules.length).toBeGreaterThan(0);
    for (const { trouble, because } of entries) {
      expect(trouble.trim()).not.toBe('');
      expect(because.trim()).not.toBe('');
    }
  });

  it('キー集合が RULE_LABEL と一致する', () => {
    // Arrange
    const labelKeys = Object.keys(RULE_LABEL).sort((a, b) => a.localeCompare(b));

    // Act
    const whyKeys = Object.keys(RULE_WHY).sort((a, b) => a.localeCompare(b));

    // Assert
    expect(whyKeys).toEqual(labelKeys);
  });
});
