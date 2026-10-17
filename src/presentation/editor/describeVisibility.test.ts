import { describe, expect, it } from 'vitest';
import { describeVisibility } from './describeVisibility';

describe('describeVisibility', () => {
  it('選べない可視性がなく、抽象メソッドを実装しないときは意味と復元だけを説明する', () => {
    // Arrange
    const input = { current: 'private' as const, disabled: [], implementsAbstract: false };

    // Act
    const lines = describeVisibility(input);

    // Assert
    expect(lines).toEqual([
      'public: どのクラスからも呼べる / protected: このクラスと子クラスから呼べる / private: このクラスの中だけで呼べる',
      'ステージを始めたときの可視性には、いつでも戻せます',
    ]);
  });

  it('protected が選べない理由を説明する', () => {
    // Arrange
    const input = { current: 'private' as const, disabled: ['protected'] as const, implementsAbstract: false };

    // Act
    const lines = describeVisibility(input);

    // Assert
    expect(lines[1]).toBe('protected が選べないのは、そこまで広げて呼んでいるクラスが無いからです(必要のない公開を避けるため)');
  });

  it('抽象メソッドを実装するときだけ抽象の説明を追加する', () => {
    // Arrange
    const input = { current: 'public' as const, disabled: ['protected'] as const, implementsAbstract: true };

    // Act
    const lines = describeVisibility(input);

    // Assert
    expect(lines[3]).toBe('親クラスの抽象メソッドを実装しているので、public / protected も選べます');
  });
});
