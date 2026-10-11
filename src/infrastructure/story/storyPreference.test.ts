import { beforeEach, describe, expect, it } from 'vitest';
import { loadStoryEnabled } from './storyPreference';

describe('loadStoryEnabled', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('保存値が無いときはオンにする', () => {
    // Arrange

    // Act
    const enabled = loadStoryEnabled();

    // Assert
    expect(enabled).toBe(true);
  });

  it('false が保存されているときはオフにする', () => {
    // Arrange
    localStorage.setItem('refactor-blocks:story', 'false');

    // Act
    const enabled = loadStoryEnabled();

    // Assert
    expect(enabled).toBe(false);
  });

  it('true が保存されているときはオンにする', () => {
    // Arrange
    localStorage.setItem('refactor-blocks:story', 'true');

    // Act
    const enabled = loadStoryEnabled();

    // Assert
    expect(enabled).toBe(true);
  });
});
