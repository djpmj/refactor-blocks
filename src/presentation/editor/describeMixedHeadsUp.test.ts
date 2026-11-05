import { describe, expect, it } from 'vitest';
import { describeMixedHeadsUp } from './describeMixedHeadsUp';

describe('describeMixedHeadsUp', () => {
  const marks = new Map([['persistence', 3], ['notification', 4]]);

  it('混ざる責務が無ければ undefined', () => {
    // Arrange / Act
    const text = describeMixedHeadsUp([], marks, {});

    // Assert
    expect(text).toBeUndefined();
  });

  it('混ざる責務を印と名前で伝える', () => {
    // Arrange
    const names = { persistence: 'DBへの保存', notification: 'メール通知' };

    // Act
    const text = describeMixedHeadsUp(['persistence', 'notification'], marks, names);

    // Assert
    expect(text).toBe('責務が混ざります(D DBへの保存・E メール通知)。責務ごとに分けて抽出すると「責務の混ざったメソッド」の減点を避けられます');
  });

  it('名前が無い責務は印だけ', () => {
    // Arrange / Act
    const text = describeMixedHeadsUp(['persistence', 'notification'], marks, {});

    // Assert
    expect(text).toContain('(D・E)');
  });
});
