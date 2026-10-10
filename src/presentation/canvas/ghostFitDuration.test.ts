import { describe, expect, it } from 'vitest';
import { ghostFitDuration } from './ghostFitDuration';

describe('ghostFitDuration', () => {
  it('fits immediately when reduced motion is requested', () => {
    // Arrange
    const reducedMotion = true;
    // Act
    const duration = ghostFitDuration(reducedMotion);
    // Assert
    expect(duration).toBe(0);
  });

  it('uses the normal short fit animation otherwise', () => {
    // Arrange
    const reducedMotion = false;
    // Act
    const duration = ghostFitDuration(reducedMotion);
    // Assert
    expect(duration).toBe(350);
  });
});
