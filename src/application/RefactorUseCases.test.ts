import { describe, expect, it } from 'vitest';
import { findClassOfMethod, findFileOfClass, findMethod, type Codebase } from '../domain/codebase/Codebase';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import {
  addClassUseCase,
  addNewFileUseCase,
  addInterfaceUseCase,
  changeVisibilityUseCase,
  deleteMethodUseCase,
  describeAddClassError,
  describeAddInterfaceError,
  describeChangeVisibilityError,
  describeDeleteClassError,
  describeDeleteFileError,
  describeDeleteMethodError,
  describeMergeError,
  describeMoveClassError,
  describeMoveFieldError,
  describeRemoveInterfaceError,
  describeRenameClassError,
  describeRenameMethodError,
  describeExtractError,
  describeInlineError,
  describeMoveError,
  describeSetSuperclassError,
  extractMethodUseCase,
  inlineMethodUseCase,
  mergeMethodsUseCase,
  moveClassUseCase,
  moveClassToNewFileUseCase,
  moveFieldUseCase,
  moveMethodToNewClassUseCase,
  moveMethodToNewClassInFileUseCase,
  moveMethodUseCase,
  removeInterfaceUseCase,
  renameClassUseCase,
  renameMethodUseCase,
  setSuperclassUseCase,
} from './RefactorUseCases';

/** mergeMethodsUseCase用: A・Bとも別クラスのprivateメソッドで、duplicateGroupが一致した処理を1つ持つ。 */
function codebaseWithMergeableMethods(): Codebase {
  return {
    files: [
      {
        id: 'file',
        path: 'src/all.ts',
        classes: [
          {
            id: 'class-a',
            name: 'ClassA',
            methods: [
              { id: 'method-a', name: 'logA', visibility: 'private', fragments: [{ id: 'fa', label: 'ログを記録する', lines: 10, responsibility: 'logging', duplicateGroup: 'log' }] },
            ],
          },
          {
            id: 'class-b',
            name: 'ClassB',
            methods: [
              { id: 'method-b', name: 'logB', visibility: 'private', fragments: [{ id: 'fb', label: 'ログを記録する', lines: 8, responsibility: 'logging', duplicateGroup: 'log' }] },
            ],
          },
        ],
      },
    ],
  };
}

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

describe('mergeMethodsUseCase', () => {
  it('注入されたIDで統合後のメソッドを作る', () => {
    // Arrange
    const codebase = codebaseWithMergeableMethods();

    // Act
    const result = mergeMethodsUseCase(
      codebase,
      { methodAId: 'method-a', methodBId: 'method-b', newMethodName: 'logNotification' },
      () => 'generated-id',
    );

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.newMethodId).toBe('generated-id');
    expect(findMethod(result.value.codebase, 'generated-id')?.name).toBe('logNotification');
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

/** moveFieldUseCase用: class-order に field-total、class-tax にフィールドなし。 */
function codebaseWithField(): Codebase {
  const base = sampleCodebase();
  return {
    files: base.files.map((file, index) =>
      index === 0 ? { ...file, classes: [{ ...file.classes[0], fields: [{ id: 'field-total', name: 'total', visibility: 'public' as const }] }] } : file,
    ),
  };
}

describe('moveFieldUseCase', () => {
  it('同じクラスへのドロップは何も変えずに成功扱いにする', () => {
    // Arrange
    const codebase = codebaseWithField();

    // Act
    const result = moveFieldUseCase(codebase, 'field-total', 'class-order');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('別クラスへのドロップでフィールドを移動する', () => {
    // Arrange
    const codebase = codebaseWithField();

    // Act
    const result = moveFieldUseCase(codebase, 'field-total', 'class-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes[0].fields?.map((field) => field.id)).toEqual(['field-total']);
  });

  it('同じクラス以外のエラーはそのまま返す', () => {
    // Arrange
    const codebase = codebaseWithField();

    // Act
    const result = moveFieldUseCase(codebase, 'field-total', 'missing');

    // Assert
    expect(result).toEqual({ ok: false, error: 'class-not-found' });
  });
});

describe('deleteMethodUseCase', () => {
  it('空実装のメソッドを削除する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              methods: [{ id: 'method-stub', name: 'stub', visibility: 'public', fragments: [{ id: 'f1', label: '未対応', lines: 2, responsibility: 'x', stub: true }] }],
            },
          ],
        },
      ],
    };

    // Act
    const result = deleteMethodUseCase(codebase, 'method-stub');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].methods).toHaveLength(0);
  });

  it('中身のあるメソッドを指定するとnot-stubを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = deleteMethodUseCase(codebase, 'method-place');

    // Assert
    expect(result).toEqual({ ok: false, error: 'not-stub' });
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

describe('addClassUseCase / addNewFileUseCase', () => {
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
    const result = addNewFileUseCase(codebase, () => 'generated-file');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result).toEqual({ ok: true, value: { files: [...codebase.files, { id: 'generated-file', path: 'src/NewFile.ts', classes: [] }] } });
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

describe('renameClassUseCase / renameMethodUseCase', () => {
  it('クラス名を付け替える', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameClassUseCase(codebase, 'class-tax', 'TaxPolicy');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes[0].name).toBe('TaxPolicy');
  });

  it('メソッド名を付け替える', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = renameMethodUseCase(codebase, 'method-place', 'placeNewOrder');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].methods[0].name).toBe('placeNewOrder');
  });
});

describe('setSuperclassUseCase', () => {
  it('親クラス名からIDを解決してsuperclassIdに設定する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = setSuperclassUseCase(codebase, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].superclassId).toBe('class-tax');
  });

  it('空文字を指定すると継承を解除する', () => {
    // Arrange
    const withSuperclass = setSuperclassUseCase(sampleCodebase(), 'class-order', 'TaxCalculator');
    if (!withSuperclass.ok) throw new Error(withSuperclass.error);

    // Act
    const result = setSuperclassUseCase(withSuperclass.value, 'class-order', '');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].superclassId).toBeUndefined();
  });

});

describe('addInterfaceUseCase / removeInterfaceUseCase', () => {
  it('クラス名からIDを解決してinterfaceIdsに追加する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = addInterfaceUseCase(codebase, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].interfaceIds).toEqual(['class-tax']);
  });

  it('追加したインターフェースを外す', () => {
    // Arrange
    const withInterface = addInterfaceUseCase(sampleCodebase(), 'class-order', 'TaxCalculator');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = removeInterfaceUseCase(withInterface.value, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].interfaceIds).toBeUndefined();
  });

  it('存在しない名前を指定するとエラー文言を返す', () => {
    // Arrange / Act / Assert
    expect(describeAddInterfaceError('interface-not-found')).toBe('その名前のクラスが見つかりません');
    expect(describeRemoveInterfaceError('interface-not-found')).toBe('その名前のクラスが見つかりません');
  });
});

describe('エラーメッセージ', () => {
  it('エラーコードをプレイヤー向けの日本語に変換する', () => {
    // Arrange
    const extractError = 'no-fragments-selected';
    const moveError = 'duplicate-method-name';
    const inlineError = 'not-private';
    const mergeError = 'shape-mismatch';

    // Act
    const messages = [
      describeExtractError(extractError),
      describeMoveError(moveError),
      describeInlineError(inlineError),
      describeMergeError(mergeError),
      describeAddClassError('duplicate-class-name'),
      describeMoveClassError('file-not-found'),
      describeRenameClassError('class-not-found'),
      describeRenameMethodError('duplicate-method-name'),
      describeSetSuperclassError('inheritance-cycle'),
      describeDeleteMethodError('not-stub'),
      describeMoveFieldError('duplicate-field-name'),
      describeDeleteClassError('has-fields'),
      describeDeleteFileError('has-fields'),
      describeDeleteClassError('has-code'),
      describeDeleteFileError('has-code'),
      describeChangeVisibilityError('contract-method'),
      describeChangeVisibilityError('widening-not-needed'),
    ];

    // Assert
    expect(messages).toEqual([
      '抽出する処理を1つ以上選んでください',
      '移動先のクラスに同じ名前のメソッドがあります',
      'publicメソッドは呼び出し元へ戻せません',
      '処理の形が一致しないため統合できません',
      '同じ名前のクラスがすでにあります',
      '移動先のファイルが見つかりません',
      '名前を変えるクラスが見つかりません',
      '同じクラスに同じ名前のメソッドがあります',
      '継承の輪ができてしまいます',
      '中身のあるメソッドは削除できません。削除できるのは空実装のメソッドだけです',
      '移動先に同じ名前のフィールドがあります',
      'フィールドを持つクラスは削除できません。先にフィールドを別のクラスへ移してください',
      'フィールドを持つクラスがあるファイルは削除できません。先にフィールドを別のクラスへ移してください',
      '処理が残っているクラスは削除できません。先にメソッドを別のクラスへ移してください',
      '処理が残っているクラスがあるファイルは削除できません。先にメソッドを別のクラスへ移してください',
      '中身のないメソッド(インターフェースの約束)の可視性は変えられません',
      'public は他のクラスから、protected は子クラスから呼ばれているメソッドにだけ選べます',
    ]);
  });
});

/** changeVisibilityUseCase用: class-a の method-target(private)を class-b の method-b が呼ぶ。 */
function codebaseWithVisibilityTarget(targetVisibility: 'public' | 'private' = 'private', callsTarget = true): Codebase {
  return {
    files: [
      {
        id: 'file',
        path: 'src/all.ts',
        classes: [
          {
            id: 'class-a',
            name: 'A',
            methods: [{ id: 'method-target', name: 'target', visibility: targetVisibility, fragments: [{ id: 'f-target', label: 'do', lines: 1, responsibility: 'x' }] }],
          },
          {
            id: 'class-b',
            name: 'B',
            methods: [{ id: 'method-b', name: 'run', visibility: 'public', fragments: callsTarget ? [{ id: 'f-b', label: 'call', lines: 1, responsibility: 'x', uses: ['method-target'] }] : [] }],
          },
        ],
      },
    ],
  };
}

describe('changeVisibilityUseCase', () => {
  it('同じ可視性を選ぶと何も変えずに成功扱いにする', () => {
    // Arrange
    const codebase = codebaseWithVisibilityTarget();

    // Act
    const result = changeVisibilityUseCase(codebase, 'method-target', 'private', codebase);

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('他クラスから呼ばれているメソッドを public にできる', () => {
    // Arrange
    const codebase = codebaseWithVisibilityTarget();

    // Act
    const result = changeVisibilityUseCase(codebase, 'method-target', 'public', codebase);

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('public');
  });

  it('同じ可視性以外のエラーはそのまま返す', () => {
    // Arrange
    const codebase = codebaseWithVisibilityTarget();

    // Act
    const result = changeVisibilityUseCase(codebase, 'method-missing', 'public', codebase);

    // Assert
    expect(result).toEqual({ ok: false, error: 'method-not-found' });
  });

  it('originalCodebase の可視性には呼び出し元がなくても戻せる', () => {
    // Arrange
    const codebase = codebaseWithVisibilityTarget('private', false);
    const originalCodebase = codebaseWithVisibilityTarget('public', false);

    // Act
    const result = changeVisibilityUseCase(codebase, 'method-target', 'public', originalCodebase);

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('public');
  });

  it('originalCodebase にないメソッドは呼び出し元がないと広げられない', () => {
    // Arrange
    const codebase = codebaseWithVisibilityTarget();
    const originalCodebase: Codebase = { files: [] };

    // Act
    const result = changeVisibilityUseCase(codebase, 'method-target', 'protected', originalCodebase);

    // Assert
    expect(result).toEqual({ ok: false, error: 'widening-not-needed' });
  });
});

describe('moveClassToNewFileUseCase / moveMethodToNewClassUseCase', () => {
  it('クラスを注入されたIDの新しいファイルへ移す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClassToNewFileUseCase(codebase, 'class-tax', () => 'generated-file');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.fileId).toBe('generated-file');
    expect(findFileOfClass(result.value.codebase, 'class-tax')?.id).toBe(result.value.fileId);
  });

  it('メソッドを注入されたIDの新しいクラスとファイルへ移す', () => {
    // Arrange
    const codebase = sampleCodebase();
    const ids = ['generated-class', 'generated-file'];

    // Act
    const result = moveMethodToNewClassUseCase(codebase, 'method-place', () => ids.shift() ?? '');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findClassOfMethod(result.value.codebase, 'method-place')?.id).toBe('generated-class');
    expect(findFileOfClass(result.value.codebase, 'generated-class')?.id).toBe(result.value.fileId);
    expect(result.value.fileId).toBe('generated-file');
  });

  it('メソッドを指定されたファイルに注入されたIDのクラスを作って移す', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase = { files: [...base.files, { id: 'target-file', path: 'src/NewFile.ts', classes: [] }] };

    // Act
    const result = moveMethodToNewClassInFileUseCase(codebase, 'method-place', 'target-file', () => 'generated-class');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findClassOfMethod(result.value, 'method-place')?.id).toBe('generated-class');
    expect(findFileOfClass(result.value, 'generated-class')?.id).toBe('target-file');
  });
});
