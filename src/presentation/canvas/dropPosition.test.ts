import { describe, expect, it } from 'vitest';
import { fileTopLeftAtDrop } from './dropPosition';

describe('fileTopLeftAtDrop', () => {
  it('places the file center and header around the drop point', () => {
    // Arrange
    const drop = { x: 500, y: 300 };
    const size = { width: 240, height: 200 };

    // Act
    const position = fileTopLeftAtDrop(drop, size);

    // Assert
    expect(position).toEqual({ x: 380, y: 282 });
  });

  it('keeps negative canvas coordinates signed', () => {
    // Arrange
    const drop = { x: -20, y: -40 };

    // Act
    const position = fileTopLeftAtDrop(drop, { width: 240, height: 200 });

    // Assert
    expect(position).toEqual({ x: -140, y: -58 });
  });

  it('returns the drop point when the dimensions are zero', () => {
    // Arrange
    const drop = { x: 10, y: 20 };

    // Act
    const position = fileTopLeftAtDrop(drop, { width: 0, height: 0 });

    // Assert
    expect(position).toEqual(drop);
  });
});
