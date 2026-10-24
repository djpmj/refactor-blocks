import { describe, expect, it } from 'vitest';
import { describeManualFix } from './describeManualFix';
import type { ManualFixResult } from '../../domain/change/checkManualFix';

const result = (overrides: Partial<ManualFixResult> = {}): ManualFixResult => ({ missed: [], extra: [], sites: 3, siteClassIds: ['a', 'b'], ...overrides });

describe('describeManualFix', () => {
  it('複数クラスに散らばる変更箇所を説明する', () => {
    // Arrange
    const input = { result: result(), classNames: ['Order', 'Customer'], opening: false, readLines: 0 };

    // Act
    const messages = describeManualFix(input);

    // Assert
    expect(messages).toEqual(['今のコードでは、この変更を入れるのに 3 か所(2 クラス)を直す必要があります。1つのクラスにまとめれば、直し忘れが起きにくくなります']);
  });

  it('同じクラス内の複数箇所はまとめるよう促さない', () => {
    // Arrange
    const input = { result: result({ sites: 2, siteClassIds: ['mailer'] }), classNames: ['Mailer'], opening: false, readLines: 0 };

    // Act
    const messages = describeManualFix(input);

    // Assert
    expect(messages).toEqual(['直す 2 か所は、どれも Mailer の中です']);
  });

  it('冒頭以外の1箇所は説明を出さない', () => {
    // Arrange
    const input = { result: result({ sites: 1, siteClassIds: ['a'] }), classNames: ['Order'], opening: false, readLines: 0 };

    // Act
    const messages = describeManualFix(input);

    // Assert
    expect(messages).toEqual([]);
  });

  it('冒頭で正解したときは読んだ行数を伝える', () => {
    // Arrange
    const input = { result: result({ sites: 1, siteClassIds: ['a'] }), classNames: ['Order'], opening: true, readLines: 39 };

    // Act
    const messages = describeManualFix(input);

    // Assert
    expect(messages).toEqual(['この変更のために 39 行を読みました。組み替えたあと、同じ変更で読む量がどう変わるかを確かめます']);
  });

  it('冒頭で直し忘れがあれば散らばりの説明のあとに痛みを伝える', () => {
    // Arrange
    const input = { result: result({ missed: ['m'] }), classNames: ['Order', 'Customer'], opening: true, readLines: 39 };

    // Act
    const messages = describeManualFix(input);

    // Assert
    expect(messages).toHaveLength(2);
    expect(messages[1]).toBe('この痛みを覚えておこう。組み替えたあと、同じ変更がどう変わるかを確かめます');
  });
});
