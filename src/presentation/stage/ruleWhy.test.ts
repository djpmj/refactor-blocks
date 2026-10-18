import { describe, expect, it } from 'vitest';
import { RULE_LABEL } from './describeScore';
import { LINE_LIMIT_WHY, lineLimitWhy, RULE_WHY } from './ruleWhy';

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

describe('lineLimitWhy', () => {
  it('違反の種類ごとに重複なく method、class、file の順で返す', () => {
    // Arrange
    const kinds = ['file', 'class', 'method', 'class'] as const;

    // Act
    const result = lineLimitWhy(kinds);

    // Assert
    expect(result).toEqual([LINE_LIMIT_WHY.method, LINE_LIMIT_WHY.class, LINE_LIMIT_WHY.file]);
  });

  it('method の重複は一件にまとめる', () => {
    // Arrange
    const kinds = ['method', 'method'] as const;

    // Act
    const result = lineLimitWhy(kinds);

    // Assert
    expect(result).toEqual([LINE_LIMIT_WHY.method]);
  });

  it('違反がない場合は既定の method 説明を返す', () => {
    // Arrange
    const kinds: ('method' | 'class' | 'file')[] = [];

    // Act
    const result = lineLimitWhy(kinds);

    // Assert
    expect(result).toEqual([LINE_LIMIT_WHY.method]);
  });
});
