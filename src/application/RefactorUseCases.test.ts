import { describe, expect, it } from 'vitest';
import { findMethod } from '../domain/codebase/Codebase';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import {
  addClassUseCase,
  addFileUseCase,
  describeAddClassError,
  describeAddFileError,
  describeMoveClassError,
  describeExtractError,
  describeInlineError,
  describeMoveError,
  extractMethodUseCase,
  inlineMethodUseCase,
  moveClassUseCase,
  moveMethodUseCase,
} from './RefactorUseCases';

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

describe('inlineMethodUseCase', () => {
  it('処理を呼び出し元へ戻し、呼び出し元のメソッドIDを返す', () => {
    // Arrange
    const extracted = extractMethodUseCase(
      sampleCodebase(),
      { sourceMethodId: 'method-place', fragmentIds: ['f-tax'], newMethodName: 'calculateTax' },
      () => 'method-tax',
    );
    if (!extracted.ok) throw new Error(extracted.error);

    // Act
    const result = inlineMethodUseCase(extracted.value, 'method-tax');

    // Assert
    expect(result).toEqual({ ok: true, value: { codebase: sampleCodebase(), callerId: 'method-place' } });
  });

  it('戻せないときはエラーを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = inlineMethodUseCase(codebase, 'method-place');

    // Assert
    expect(result).toEqual({ ok: false, error: 'not-private' });
  });
});

describe('addClassUseCase / addFileUseCase', () => {
  it('注入されたIDで新しいクラスを作る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = addClassUseCase(codebase, 'file-tax', 'TaxRateTable', () => 'generated-class');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes[1]).toEqual({ id: 'generated-class', name: 'TaxRateTable', methods: [] });
  });

  it('注入されたIDで新しいファイルを作る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = addFileUseCase(codebase, 'src/mail/Mailer.ts', () => 'generated-file');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[2]).toEqual({ id: 'generated-file', path: 'src/mail/Mailer.ts', classes: [] });
  });
});

describe('moveClassUseCase', () => {
  it('同じファイルへのドロップは何も変えずに成功扱いにする', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClassUseCase(codebase, 'class-tax', 'file-tax');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('別ファイルへのドロップでクラスを移動する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClassUseCase(codebase, 'class-tax', 'file-order');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes).toEqual([]);
  });

  it('同じファイル以外のエラーはそのまま返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClassUseCase(codebase, 'class-tax', 'missing');

    // Assert
    expect(result).toEqual({ ok: false, error: 'file-not-found' });
  });
});

describe('エラーメッセージ', () => {
  it('エラーコードをプレイヤー向けの日本語に変換する', () => {
    // Arrange
    const extractError = 'no-fragments-selected';
    const moveError = 'duplicate-method-name';
    const inlineError = 'not-private';

    // Act
    const messages = [
      describeExtractError(extractError),
      describeMoveError(moveError),
      describeInlineError(inlineError),
      describeAddClassError('duplicate-class-name'),
      describeAddFileError('duplicate-path'),
      describeMoveClassError('file-not-found'),
    ];

    // Assert
    expect(messages).toEqual([
      '抽出する処理を1つ以上選んでください',
      '移動先のクラスに同じ名前のメソッドがあります',
      'publicメソッドは呼び出し元へ戻せません',
      '同じ名前のクラスがすでにあります',
      '同じパスのファイルがすでにあります',
      '移動先のファイルが見つかりません',
    ]);
  });
});
