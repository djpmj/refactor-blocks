import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { emptyHistory, movesSince, recordChange, redoHistory, undoHistory } from './history';

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

describe('movesSince', () => {
  const S = codebaseOf('s');
  const D = codebaseOf('s');

  it('履歴が空で初期コードのままなら0手', () => {
    // Arrange
    const history = emptyHistory();

    // Act & Assert
    expect(movesSince(history, S, S)).toBe(0);
  });

  it('過去に積んだ分がそのまま手数になる', () => {
    // Arrange・Act・Assert
    expect(movesSince({ past: [S], future: [] }, A, S)).toBe(1);
    expect(movesSince({ past: [S, A, B], future: [] }, C, S)).toBe(3);
  });

  it('最初に戻した直後は0手、そこから1手で1手', () => {
    // Arrange・Act・Assert
    expect(movesSince({ past: [S, A, B], future: [] }, S, S)).toBe(0);
    expect(movesSince({ past: [S, A, B, S], future: [] }, C, S)).toBe(1);
  });

  it('最初に戻したのを undo すると、戻す前の手数に戻る', () => {
    // Arrange
    const reset = recordChange({ past: [S, A], future: [] }, B);

    // Act
    const undone = undoHistory(reset, S);

    // Assert
    expect(undone && movesSince(undone.history, undone.codebase, S)).toBe(2);
  });

  it('undo してから別の手を打つと、undo した手は数えない', () => {
    // Arrange
    const undone = undoHistory({ past: [S, A], future: [] }, B);
    if (undone === undefined) throw new Error('undo できるはず');

    // Act
    const history = recordChange(undone.history, undone.codebase);

    // Assert
    expect(movesSince(history, C, S)).toBe(2);
  });

  it('下書きから再開したとき(道のりに初期コードが無い)は undefined', () => {
    // Arrange・Act・Assert
    expect(movesSince({ past: [], future: [] }, D, S)).toBeUndefined();
    expect(movesSince({ past: [D], future: [] }, A, S)).toBeUndefined();
  });
});
