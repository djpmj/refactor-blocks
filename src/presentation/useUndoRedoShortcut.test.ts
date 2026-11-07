import { describe, expect, it } from 'vitest';
import { isShortcutBlocked } from './useUndoRedoShortcut';

function makeRoot(...dialogs: { open: boolean; allows?: boolean }[]): HTMLElement {
  const root = document.createElement('div');
  for (const spec of dialogs) {
    const dialog = document.createElement('dialog');
    if (spec.open) dialog.setAttribute('open', '');
    if (spec.allows) dialog.setAttribute('data-allows-shortcuts', '');
    root.appendChild(dialog);
  }
  return root;
}

describe('isShortcutBlocked', () => {
  it('ダイアログが無く、targetがbuttonならブロックしない', () => {
    // Arrange
    const root = makeRoot();
    const target = document.createElement('button');
    // Act
    const result = isShortcutBlocked(target, root);
    // Assert
    expect(result).toBe(false);
  });

  it('閉じたダイアログだけならブロックしない', () => {
    // Arrange
    const root = makeRoot({ open: false });
    // Act
    const result = isShortcutBlocked(null, root);
    // Assert
    expect(result).toBe(false);
  });

  it('開いたダイアログがあるとブロックする', () => {
    // Arrange
    const root = makeRoot({ open: true });
    // Act
    const result = isShortcutBlocked(null, root);
    // Assert
    expect(result).toBe(true);
  });

  it('data-allows-shortcuts 付きの開いたダイアログだけならブロックしない', () => {
    // Arrange
    const root = makeRoot({ open: true, allows: true });
    // Act
    const result = isShortcutBlocked(null, root);
    // Assert
    expect(result).toBe(false);
  });

  it('例外のダイアログと例外でない開いたダイアログが両方あるとブロックする', () => {
    // Arrange
    const root = makeRoot({ open: true, allows: true }, { open: true });
    // Act
    const result = isShortcutBlocked(null, root);
    // Assert
    expect(result).toBe(true);
  });

  it.each(['input', 'textarea', 'select'])('targetが %s ならブロックする', (tag) => {
    // Arrange
    const root = makeRoot();
    const target = document.createElement(tag);
    // Act
    const result = isShortcutBlocked(target, root);
    // Assert
    expect(result).toBe(true);
  });

  it('contentEditable な要素ならブロックする', () => {
    // Arrange
    const root = makeRoot();
    const target = document.createElement('div');
    Object.defineProperty(target, 'isContentEditable', { value: true });
    // Act
    const result = isShortcutBlocked(target, root);
    // Assert
    expect(result).toBe(true);
  });

  it('targetがnullでダイアログも無ければブロックしない', () => {
    // Arrange
    const root = makeRoot();
    // Act
    const result = isShortcutBlocked(null, root);
    // Assert
    expect(result).toBe(false);
  });
});
