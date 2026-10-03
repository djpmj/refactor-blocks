import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { emptyHistory, recordChange, redoHistory, undoHistory } from './history';

function codebaseOf(path: string): Codebase {
  return { files: [{ id: 'file', path, classes: [] }] };
}

const A = codebaseOf('a');
const B = codebaseOf('b');
const C = codebaseOf('c');

describe('recordChange', () => {
  it('変更前のコードベースを過去に積み、進める側の履歴は捨てる', () => {
    // Arrange
    const history = { past: [A], future: [C] };

    // Act
    const recorded = recordChange(history, B);

    // Assert
    expect(recorded).toEqual({ past: [A, B], future: [] });
  });
});

describe('undoHistory', () => {
  it('1手戻し、いまのコードベースを未来に積む', () => {
    // Arrange
    const history = { past: [A, B], future: [] };

    // Act
    const undone = undoHistory(history, C);

    // Assert
    expect(undone).toEqual({ history: { past: [A], future: [C] }, codebase: B });
  });

  it('戻せる手がないときは undefined を返す', () => {
    // Arrange
    const history = emptyHistory();

    // Act
    const undone = undoHistory(history, A);

    // Assert
    expect(undone).toBeUndefined();
  });
});

describe('redoHistory', () => {
  it('1手進め、いまのコードベースを過去に積む', () => {
    // Arrange
    const history = { past: [A], future: [C] };

    // Act
    const redone = redoHistory(history, B);

    // Assert
    expect(redone).toEqual({ history: { past: [A, B], future: [] }, codebase: C });
  });

  it('進める手がないときは undefined を返す', () => {
    // Arrange
    const history = emptyHistory();

    // Act
    const redone = redoHistory(history, A);

    // Assert
    expect(redone).toBeUndefined();
  });

  it('戻して進めると元のコードベースに戻る', () => {
    // Arrange
    const recorded = recordChange(emptyHistory(), A);
    const undone = undoHistory(recorded, B);

    // Act
    const redone = undone === undefined ? undefined : redoHistory(undone.history, undone.codebase);

    // Assert
    expect(redone?.codebase).toBe(B);
  });
});
