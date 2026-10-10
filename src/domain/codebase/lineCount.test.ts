import { describe, expect, it } from 'vitest';
import { classLines, fileLines, fragmentLines, methodLines } from './lineCount';
import { tutorialStages } from '../../infrastructure/stages/tutorialStages';
import { generateClassSource } from './generateClassSource';
import { sampleCodebase } from './testFixtures';

describe('lineCount', () => {
  it('コードがないメソッドの行数は処理の行数の合計にシグネチャと波括弧の3行を足したもの', () => {
    // Arrange
    const method = sampleCodebase().files[0].classes[0].methods[0];

    // Act
    const lines = methodLines(method);

    // Assert
    expect(lines).toBe(10 + 8 + 6 + 3);
  });

  it('コードがあるFragmentは登録値ではなくコードの行数を数える', () => {
    // Arrange
    const codeFragment = { ...sampleCodebase().files[0].classes[0].methods[0].fragments[0], lines: 99, code: { csharp: 'first\n\nthird' } };

    // Act
    const lines = fragmentLines(codeFragment);

    // Assert
    expect(lines).toBe(3);
  });

  it('コードがないFragmentは登録された行数を使う', () => {
    // Arrange
    const codeFragment = sampleCodebase().files[0].classes[0].methods[0].fragments[0];

    // Act
    const lines = fragmentLines(codeFragment);

    // Assert
    expect(lines).toBe(codeFragment.lines);
  });

  it('コードの途中と末尾の空行も行数に含める', () => {
    // Arrange
    const codeFragment = { ...sampleCodebase().files[0].classes[0].methods[0].fragments[0], code: { csharp: 'first\n\nthird\n' } };

    // Act
    const lines = fragmentLines(codeFragment);

    // Assert
    expect(lines).toBe(4);
  });

  it('コードを持つメソッドは実コード行数に3行のオーバーヘッドを足す', () => {
    // Arrange
    const method = { ...sampleCodebase().files[0].classes[0].methods[0], fragments: [{ ...sampleCodebase().files[0].classes[0].methods[0].fragments[0], code: { csharp: 'one' } }] };

    // Act
    const lines = methodLines(method);

    // Assert
    expect(lines).toBe(4);
  });

  it('メソッド間に空行を1行含めてクラスの行数を数える', () => {
    // Arrange
    const codeClass = {
      ...sampleCodebase().files[0].classes[0],
      methods: [
        { ...sampleCodebase().files[0].classes[0].methods[0], fragments: [{ ...sampleCodebase().files[0].classes[0].methods[0].fragments[0], code: { csharp: 'one' } }] },
        { ...sampleCodebase().files[0].classes[0].methods[0], id: 'second', fragments: [{ ...sampleCodebase().files[0].classes[0].methods[0].fragments[0], code: { csharp: 'two\ntwo' } }] },
      ],
    };

    // Act
    const lines = classLines(codeClass);

    // Assert
    expect(lines).toBe(3 + 4 + 5 + 1);
  });

  it('メソッドが0個または1個のクラスにメソッド間の空行を加えない', () => {
    // Arrange
    const emptyClass = sampleCodebase().files[1].classes[0];
    const oneMethodClass = sampleCodebase().files[0].classes[0];

    // Act
    const emptyLines = classLines(emptyClass);
    const oneMethodLines = classLines(oneMethodClass);

    // Assert
    expect(emptyLines).toBe(3);
    expect(oneMethodLines).toBe(30);
  });

  it('チュートリアル1のクラス行数を生成コードの行数に合わせる', () => {
    // Arrange
    const codebase = tutorialStages[0].codebase;
    const codeClass = codebase.files[0].classes[0];
    const method = codeClass.methods[0];
    const source = generateClassSource(codebase, codeClass.id, 'csharp');

    // Act
    const lines = classLines(codeClass);

    // Assert
    expect(lines).toBe(source.split('\n').length);
    expect(lines).toBe(33);
    expect(methodLines(method)).toBe(30);
  });

  it('クラスの行数はメソッドの行数の合計にクラス宣言と波括弧の3行を足したもの', () => {
    // Arrange
    const codeClass = sampleCodebase().files[0].classes[0];

    // Act
    const lines = classLines(codeClass);

    // Assert
    expect(lines).toBe(27 + 3);
  });

  it('メソッドのない空クラスは宣言と波括弧の3行だけ', () => {
    // Arrange
    const file = sampleCodebase().files[1];

    // Act
    const lines = fileLines(file);

    // Assert
    expect(lines).toBe(3);
  });
});
