import { describe, expect, it } from 'vitest';
import { classLines, fileLines, methodLines } from './lineCount';
import { sampleCodebase } from './testFixtures';

describe('lineCount', () => {
  it('メソッドの行数は処理の行数の合計にシグネチャと閉じ括弧の2行を足したもの', () => {
    // Arrange
    const method = sampleCodebase().files[0].classes[0].methods[0];

    // Act
    const lines = methodLines(method);

    // Assert
    expect(lines).toBe(10 + 8 + 6 + 2);
  });

  it('クラスの行数はメソッドの行数の合計にクラス宣言の2行を足したもの', () => {
    // Arrange
    const codeClass = sampleCodebase().files[0].classes[0];

    // Act
    const lines = classLines(codeClass);

    // Assert
    expect(lines).toBe(26 + 2);
  });

  it('メソッドのない空クラスは宣言の2行だけ', () => {
    // Arrange
    const file = sampleCodebase().files[1];

    // Act
    const lines = fileLines(file);

    // Assert
    expect(lines).toBe(2);
  });
});
