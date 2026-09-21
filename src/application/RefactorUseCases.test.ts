import { describe, expect, it } from 'vitest';
import { findMethod } from '../domain/codebase/Codebase';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import { describeExtractError, describeMoveError, extractMethodUseCase, moveMethodUseCase } from './RefactorUseCases';

describe('extractMethodUseCase', () => {
  it('注入されたIDで新しいメソッドを作る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethodUseCase(
      codebase,
      { sourceMethodId: 'method-place', fragmentIds: ['f-tax'], newMethodName: 'calculateTax' },
      () => 'generated-id',
    );

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'generated-id')?.name).toBe('calculateTax');
  });
});

describe('moveMethodUseCase', () => {
  it('同じクラスへのドロップは何も変えずに成功扱いにする', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveMethodUseCase(codebase, 'method-place', 'class-order');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('別クラスへのドロップでメソッドを移動する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveMethodUseCase(codebase, 'method-place', 'class-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes[0].methods.map((method) => method.id)).toEqual(['method-place']);
  });

  it('同じクラス以外のエラーはそのまま返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveMethodUseCase(codebase, 'method-place', 'missing');

    // Assert
    expect(result).toEqual({ ok: false, error: 'class-not-found' });
  });
});

describe('エラーメッセージ', () => {
  it('エラーコードをプレイヤー向けの日本語に変換する', () => {
    // Arrange
    const extractError = 'no-fragments-selected';
    const moveError = 'duplicate-method-name';

    // Act
    const messages = [describeExtractError(extractError), describeMoveError(moveError)];

    // Assert
    expect(messages).toEqual(['抽出する処理を1つ以上選んでください', '移動先のクラスに同じ名前のメソッドがあります']);
  });
});
