import { describe, expect, it } from 'vitest';
import { togglePanel } from './usePopoverDismiss';

describe('togglePanel', () => {
  it('開くと、ほかが開いていてもそのパネルだけになる', () => {
    // Arrange
    const current = 'hint';

    // Act
    const next = togglePanel(current, 'rumor', true);

    // Assert
    expect(next).toBe('rumor');
  });

  it('自分が開いているときに閉じると、何も開いていない状態になる', () => {
    // Arrange
    const current = 'rumor';

    // Act
    const next = togglePanel(current, 'rumor', false);

    // Assert
    expect(next).toBeNull();
  });

  it('別のパネルが開いているときの「閉じる」は、そのパネルを閉じない', () => {
    // Arrange
    const current = 'hint';

    // Act
    const next = togglePanel(current, 'reference', false);

    // Assert
    expect(next).toBe('hint');
  });
});
