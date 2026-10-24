import { describe, expect, it } from 'vitest';
import type { Codebase, Fragment } from '../codebase/Codebase';
import { designDiff } from './designDiff';

function frag(id: string, label: string, responsibility: string): Fragment {
  return { id, label, lines: 2, responsibility };
}

/** クラスごとに「メソッド名: 処理」を並べた最小のコードベース。 */
function build(classes: Record<string, Record<string, Fragment[]>>): Codebase {
  return {
    files: [
      {
        id: 'file-a',
        path: 'src/a.ts',
        classes: Object.entries(classes).map(([className, methods]) => ({
          id: `class-${className}`,
          name: className,
          methods: Object.entries(methods).map(([methodName, fragments]) => ({ id: `method-${methodName}`, name: methodName, visibility: 'public' as const, fragments })),
        })),
      },
    ],
  };
}

const record = frag('f-record', '送信履歴を記録する', 'storage');
const mail = frag('f-mail', '請求書をメールに添付して送る', 'notification');

describe('designDiff', () => {
  it('同じコードなら空配列を返す', () => {
    // Arrange
    const codebase = build({ Service: { send: [mail, record] } });

    // Act
    const diff = designDiff(codebase, codebase);

    // Assert
    expect(diff).toEqual([]);
  });

  it('1つの処理だけ別のクラスにあれば、その1件を返す', () => {
    // Arrange
    const player = build({ Service: { send: [mail] }, Storage: { store: [record] } });
    const answer = build({ Service: { send: [mail, record] }, Storage: { store: [] } });

    // Act
    const diff = designDiff(player, answer);

    // Assert
    expect(diff).toEqual([{ fragmentLabel: '送信履歴を記録する', responsibility: 'storage', playerClass: 'Storage', answerClass: 'Service' }]);
  });

  it('抽出してメソッドが変わっても、同じクラスにあれば違いにしない', () => {
    // Arrange
    const player = build({ Service: { send: [mail], recordHistory: [record] } });
    const answer = build({ Service: { send: [mail, record] } });

    // Act
    const diff = designDiff(player, answer);

    // Assert
    expect(diff).toEqual([]);
  });

  it('呼び出し行は比べない', () => {
    // Arrange
    const call = frag('call-x', 'x() を呼び出す', 'call');
    const player = build({ Service: { send: [call] } });
    const answer = build({ Other: { send: [call] } });

    // Act
    const diff = designDiff(player, answer);

    // Assert
    expect(diff).toEqual([]);
  });

  it('片方にしかない処理は比べない', () => {
    // Arrange
    const player = build({ Service: { send: [mail] } });
    const answer = build({ Service: { send: [mail, record] } });

    // Act
    const diff = designDiff(player, answer);

    // Assert
    expect(diff).toEqual([]);
  });
});
