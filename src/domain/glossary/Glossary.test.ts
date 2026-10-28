import { describe, expect, it } from 'vitest';
import { splitByTerms, type GlossaryTerm } from './Glossary';

function term(id: string, name: string, aliases: readonly string[] = []): GlossaryTerm {
  return { id, name, aliases, definition: '定義', example: '例' };
}

const coupling = term('coupling', '結合度');
const dependency = term('dependency', '依存', ['依存先']);

describe('splitByTerms', () => {
  it('空文字列なら空配列を返す', () => {
    // Act
    const segments = splitByTerms('', [coupling]);

    // Assert
    expect(segments).toEqual([]);
  });

  it('用語を含まない文字列は text 1つで返す', () => {
    // Act
    const segments = splitByTerms('行数: 30行まで', [coupling]);

    // Assert
    expect(segments).toEqual([{ kind: 'text', text: '行数: 30行まで' }]);
  });

  it('用語の配列が空なら元の文字列1つの text を返す', () => {
    // Act
    const segments = splitByTerms('結合度', []);

    // Assert
    expect(segments).toEqual([{ kind: 'text', text: '結合度' }]);
  });

  it('文字列の途中の用語を、別表記も含めて見つける', () => {
    // Act
    const segments = splitByTerms('結合度: 依存先は3クラスまで', [coupling, dependency]);

    // Assert
    expect(segments).toEqual([
      { kind: 'term', text: '結合度', termId: 'coupling' },
      { kind: 'text', text: ': ' },
      { kind: 'term', text: '依存先', termId: 'dependency' },
      { kind: 'text', text: 'は3クラスまで' },
    ]);
  });

  it('文字列全体が用語なら前後に空の text を付けない', () => {
    // Act
    const segments = splitByTerms('結合度', [coupling]);

    // Assert
    expect(segments).toEqual([{ kind: 'term', text: '結合度', termId: 'coupling' }]);
  });

  it('最も長く一致する表記を優先する', () => {
    // Arrange
    const cycle = term('cycle', '循環依存');

    // Act
    const segments = splitByTerms('循環依存: 輪を0組にする', [dependency, cycle]);

    // Assert
    expect(segments[0]).toEqual({ kind: 'term', text: '循環依存', termId: 'cycle' });
  });

  it('name と別表記のうち最長のもの(name)を選ぶ', () => {
    // Arrange
    const inline = term('inline', 'Inline Method / Inline Class', ['Inline Method', 'Inline Class']);

    // Act
    const segments = splitByTerms('Inline Method / Inline Class', [inline]);

    // Assert
    expect(segments).toEqual([{ kind: 'term', text: 'Inline Method / Inline Class', termId: 'inline' }]);
  });

  it('同じ用語が2回出たら両方を term にする', () => {
    // Act
    const segments = splitByTerms('結合度と結合度', [coupling]);

    // Assert
    expect(segments.map((segment) => segment.kind)).toEqual(['term', 'text', 'term']);
  });

  it('隣り合う用語は term が2つ続く', () => {
    // Act
    const segments = splitByTerms('結合度依存', [coupling, dependency]);

    // Assert
    expect(segments).toEqual([
      { kind: 'term', text: '結合度', termId: 'coupling' },
      { kind: 'term', text: '依存', termId: 'dependency' },
    ]);
  });

  it('英字で始まる表記は、外側が英数字なら一致させない', () => {
    // Arrange
    const isp = term('isp', 'ISP');

    // Act
    const inside = splitByTerms('DISPLAY', [isp]);
    const standalone = splitByTerms('ISPを守る', [isp]);

    // Assert
    expect(inside).toEqual([{ kind: 'text', text: 'DISPLAY' }]);
    expect(standalone[0]).toEqual({ kind: 'term', text: 'ISP', termId: 'isp' });
  });

  it('日本語の文字との境目は区切りとみなす', () => {
    // Arrange
    const visibility = term('visibility', 'private');

    // Act
    const segments = splitByTerms('未使用のprivateメソッド', [visibility]);

    // Assert
    expect(segments).toEqual([
      { kind: 'text', text: '未使用の' },
      { kind: 'term', text: 'private', termId: 'visibility' },
      { kind: 'text', text: 'メソッド' },
    ]);
  });

  it('大文字小文字は区別する', () => {
    // Arrange
    const strategy = term('strategy', 'Strategy');

    // Act
    const segments = splitByTerms('strategy', [strategy]);

    // Assert
    expect(segments).toEqual([{ kind: 'text', text: 'strategy' }]);
  });

  it('空文字の別表記は無視する', () => {
    // Arrange
    const withEmpty = term('coupling', '結合度', ['']);

    // Act
    const segments = splitByTerms('結合度です', [withEmpty]);

    // Assert
    expect(segments).toEqual([
      { kind: 'term', text: '結合度', termId: 'coupling' },
      { kind: 'text', text: 'です' },
    ]);
  });
});
