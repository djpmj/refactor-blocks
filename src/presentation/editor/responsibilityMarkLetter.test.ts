import { describe, expect, it } from 'vitest';
import { responsibilityMarkLetter } from './responsibilityMarkLetter';

describe('responsibilityMarkLetter', () => {
  it('色の周期を越えても異なる英字の印を付けられる', () => {
    // Arrange
    const numbers = [0, 8, 25, 26, 27];

    // Act
    const letters = numbers.map(responsibilityMarkLetter);

    // Assert
    expect(letters).toEqual(['A', 'I', 'Z', 'AA', 'AB']);
  });
});
