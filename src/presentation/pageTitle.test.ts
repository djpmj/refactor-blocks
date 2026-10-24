import { describe, expect, it } from 'vitest';
import { pageTitle } from './pageTitle';

describe('pageTitle', () => {
  it('リファクタリングはステージ名をタイトルにする', () => {
    // Arrange
    const stageTitle = 'チュートリアル1: 長いメソッドを分ける';

    // Act
    const title = pageTitle('リファクタリング', stageTitle);

    // Assert
    expect(title).toBe('チュートリアル1: 長いメソッドを分ける - Refactor Blocks');
  });

  it.each(['設計くらべ', '白紙設計'])('%sはモード名をタイトルにする', (modeLabel) => {
    // Arrange / Act
    const title = pageTitle(modeLabel, null);

    // Assert
    expect(title).toBe(`${modeLabel} - Refactor Blocks`);
  });

  it('ステージ名が空文字のときはモード名をタイトルにする', () => {
    // Arrange / Act
    const title = pageTitle('リファクタリング', '');

    // Assert
    expect(title).toBe('リファクタリング - Refactor Blocks');
  });
});
