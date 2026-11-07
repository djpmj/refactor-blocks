import { describe, expect, it, vi } from 'vitest';
import { disabledButtonProps } from './disabledButtonProps';

describe('disabledButtonProps', () => {
  it('押せるときは説明を付けず処理を呼ぶ', () => {
    // Arrange
    const onClick = vi.fn();
    const props = disabledButtonProps({ reason: null, reasonId: 'reason', onClick });
    // Act
    props.onClick();
    // Assert
    expect(props['aria-disabled']).toBeUndefined();
    expect(props['aria-describedby']).toBeUndefined();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('押せないときは理由を結び、処理を止める', () => {
    // Arrange
    const onClick = vi.fn();
    const onBlockedClick = vi.fn();
    const props = disabledButtonProps({ reason: '理由', reasonId: 'reason', onClick, onBlockedClick });
    // Act
    props.onClick();
    // Assert
    expect(props['aria-disabled']).toBe(true);
    expect(props['aria-describedby']).toBe('reason');
    expect(onClick).not.toHaveBeenCalled();
    expect(onBlockedClick).toHaveBeenCalledOnce();
  });

  it('押せないときの補助処理は省略できる', () => {
    // Arrange
    const onClick = vi.fn();
    const props = disabledButtonProps({ reason: '理由', reasonId: 'reason', onClick });
    // Act / Assert
    expect(() => props.onClick()).not.toThrow();
    expect(onClick).not.toHaveBeenCalled();
  });
});
