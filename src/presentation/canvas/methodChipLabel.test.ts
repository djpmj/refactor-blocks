import { describe, expect, it } from 'vitest';
import { methodChipLabel } from './methodChipLabel';

describe('methodChipLabel', () => {
  it('formats visibility and line count without warnings', () => {
    // Arrange
    const input = { name: 'getBalance', visibility: 'public' as const, lines: 7, overLimit: false, mixed: false, fixed: false };

    // Act
    const label = methodChipLabel(input);

    // Assert
    expect(label).toBe('getBalance()、public、7行');
  });

  it('adds warnings in order and includes the fixed mark', () => {
    // Arrange
    const input = { name: 'checkout', visibility: 'private' as const, lines: 23, lineLimit: 20, overLimit: true, mixed: true, fixed: true };

    // Act
    const label = methodChipLabel(input);

    // Assert
    expect(label).toBe('checkout()、private、23行、行数の上限 20行を超えています、別々の仕事が混ざっています、「直した」印あり');
  });
});
