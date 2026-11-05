import { describe, expect, it } from 'vitest';
import { isValidIdentifier, validateClassName } from './naming';
import { sampleCodebase } from './testFixtures';

describe('isValidIdentifier', () => {
  it.each([
    ['calculateTotal', true], ['TaxCalculator', true], ['_cache', true], ['x', true],
    ['method2', true], ['snake_case', true], ['1bad', false], ['bad name', false],
    ['1bad name', false], ['bad-name', false], ['bad.name', false], ['$x', false],
    ['メソッド', false], ['naïve', false], ['', false], [' padded', false],
  ])('%s -> %s', (name, valid) => {
    // Arrange
    const input = name;

    // Act
    const result = isValidIdentifier(input);

    // Assert
    expect(result).toBe(valid);
  });
});

describe('validateClassName', () => {
  it.each([
    ['Tax Calculator', { ok: false, error: 'invalid-class-name' }],
    ['  ', { ok: false, error: 'empty-class-name' }],
    [' TaxPolicy ', { ok: true, value: 'TaxPolicy' }],
  ])('%s', (name, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = validateClassName(codebase, name);

    // Assert
    expect(result).toEqual(expected);
  });
});
