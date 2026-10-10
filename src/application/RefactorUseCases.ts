import { addClass, type AddClassError } from '../domain/codebase/addClass';
import { addNewFile } from '../domain/codebase/addNewFile';
import { findMethod, type Codebase, type Visibility } from '../domain/codebase/Codebase';
import { changeVisibility, type ChangeVisibilityError } from '../domain/codebase/changeVisibility';
import { deleteClass, type DeleteClassError } from '../domain/codebase/deleteClass';
import { deleteFile, type DeleteFileError } from '../domain/codebase/deleteFile';
import { deleteMethod, type DeleteMethodError } from '../domain/codebase/deleteMethod';
import { extractMethod, type ExtractMethodError } from '../domain/codebase/extractMethod';
import { findCallerOf, inlineMethod, type InlineMethodError } from '../domain/codebase/inlineMethod';
import { mergeMethods, type MergeMethodsError } from '../domain/codebase/mergeMethods';
import { moveClass, type MoveClassError } from '../domain/codebase/moveClass';
import { moveField, type MoveFieldError } from '../domain/codebase/moveField';
import { moveClassToNewFile, moveMethodToNewClass, moveMethodToNewClassInFile, type MoveClassToNewFileError, type MoveMethodToNewClassError, type MoveMethodToNewClassInFileError } from '../domain/codebase/moveToNewHome';
import { moveMethod, type MoveMethodError } from '../domain/codebase/moveMethod';
import { renameClass, type RenameClassError } from '../domain/codebase/renameClass';
import { renameMethod, type RenameMethodError } from '../domain/codebase/renameMethod';
import { addInterface, removeInterface, setSuperclass, type AddInterfaceError, type RemoveInterfaceError, type SetSuperclassError } from '../domain/codebase/setSuperclass';
import { err, ok, type Result } from '../domain/shared/Result';

export type IdGenerator = () => string;

export type ExtractMethodInput = {
  readonly sourceMethodId: string;
  readonly fragmentIds: readonly string[];
  readonly newMethodName: string;
};

/** プレイヤーの「メソッドとして抽出」操作。新しいメソッドのIDは注入されたジェネレーターで採番する。 */
export function extractMethodUseCase(
  codebase: Codebase,
  input: ExtractMethodInput,
  generateId: IdGenerator,
): Result<Codebase, ExtractMethodError> {
  return extractMethod(codebase, { ...input, newMethodId: generateId() });
}

export type MergeMethodsInput = {
  readonly methodAId: string;
  readonly methodBId: string;
  readonly newMethodName: string;
};

/** プレイヤーの「似た処理を持つメソッドを統合」操作。新しいメソッドのIDは注入されたジェネレーターで採番する。 */
export function mergeMethodsUseCase(
  codebase: Codebase,
  input: MergeMethodsInput,
  generateId: IdGenerator,
): Result<{ codebase: Codebase; newMethodId: string }, MergeMethodsError> {
  const newMethodId = generateId();
  const result = mergeMethods(codebase, { ...input, newMethodId });
  return result.ok ? ok({ codebase: result.value, newMethodId }) : result;
}

/** プレイヤーの「メソッドを別クラスへドロップ」操作。同じクラスへのドロップは何もしない操作として成功扱いにする。 */
export function moveMethodUseCase(
  codebase: Codebase,
  methodId: string,
  targetClassId: string,
): Result<Codebase, Exclude<MoveMethodError, 'same-class'>> {
  const result = moveMethod(codebase, methodId, targetClassId);
  if (result.ok) return ok(result.value);
  const { error } = result;
  return error === 'same-class' ? ok(codebase) : err(error);
}

/** プレイヤーの「フィールドを別クラスへドロップ」操作。同じクラスへのドロップは何もしない操作として成功扱いにする。 */
export function moveFieldUseCase(
  codebase: Codebase,
  fieldId: string,
  targetClassId: string,
): Result<Codebase, Exclude<MoveFieldError, 'same-class'>> {
  const result = moveField(codebase, fieldId, targetClassId);
  if (result.ok) return ok(result.value);
  const { error } = result;
  return error === 'same-class' ? ok(codebase) : err(error);
}

/** プレイヤーの「可視性を変える」操作。同じ可視性を選んだときは何もしない操作として成功扱いにする。 */
export function changeVisibilityUseCase(
  codebase: Codebase,
  methodId: string,
  visibility: Visibility,
  originalCodebase: Codebase,
): Result<Codebase, Exclude<ChangeVisibilityError, 'same-visibility'>> {
  const originalVisibility = findMethod(originalCodebase, methodId)?.visibility;
  const result = changeVisibility(codebase, methodId, visibility, originalVisibility);
  if (result.ok) return ok(result.value);
  const { error } = result;
  return error === 'same-visibility' ? ok(codebase) : err(error);
}

/** プレイヤーの「呼び出し元へ戻す」操作。戻した先を選び直せるよう、呼び出し元のメソッドIDも返す。 */
export function inlineMethodUseCase(
  codebase: Codebase,
  methodId: string,
): Result<{ codebase: Codebase; callerId: string }, InlineMethodError> {
  const callerId = findCallerOf(codebase, methodId)?.id;
  const result = inlineMethod(codebase, methodId);
  if (!result.ok) return result;
  // inlineMethod が成功した時点で呼び出し元は必ず見つかっている
  return callerId === undefined ? err('call-not-found') : ok({ codebase: result.value, callerId });
}

/** プレイヤーの「クラスを追加」操作。新しいクラスのIDは注入されたジェネレーターで採番する。 */
export function addClassUseCase(
  codebase: Codebase,
  fileId: string,
  className: string,
  generateId: IdGenerator,
): Result<Codebase, AddClassError> {
  return addClass(codebase, fileId, className, generateId());
}

/** プレイヤーの「ファイルを追加」操作。 */
export function addNewFileUseCase(codebase: Codebase, generateId: IdGenerator): Result<Codebase, never> {
  return ok(addNewFile(codebase, generateId()));
}

/** プレイヤーの「クラスを別ファイルへドロップ」操作。同じファイルへのドロップは何もしない操作として成功扱いにする。 */
export function moveClassUseCase(
  codebase: Codebase,
  classId: string,
  targetFileId: string,
): Result<Codebase, Exclude<MoveClassError, 'same-file'>> {
  const result = moveClass(codebase, classId, targetFileId);
  if (result.ok) return ok(result.value);
  const { error } = result;
  return error === 'same-file' ? ok(codebase) : err(error);
}

/** プレイヤーの「クラスをファイルの枠外へドロップ」操作。新しいファイルを自動で作ってクラスを置く。 */
export function moveClassToNewFileUseCase(
  codebase: Codebase,
  classId: string,
  generateId: IdGenerator,
): Result<{ codebase: Codebase; fileId: string }, MoveClassToNewFileError> {
  const fileId = generateId();
  const result = moveClassToNewFile(codebase, classId, fileId);
  return result.ok ? ok({ codebase: result.value, fileId }) : result;
}

/** プレイヤーの「メソッドをファイルの枠外へドロップ」操作。新しいファイルとクラスを自動で作ってメソッドを置く。 */
export function moveMethodToNewClassUseCase(
  codebase: Codebase,
  methodId: string,
  generateId: IdGenerator,
): Result<{ codebase: Codebase; fileId: string }, MoveMethodToNewClassError> {
  const classId = generateId();
  const fileId = generateId();
  const result = moveMethodToNewClass(codebase, methodId, { classId, fileId });
  return result.ok ? ok({ codebase: result.value, fileId }) : result;
}

/** プレイヤーの「メソッドを空のファイルへドロップ」操作。新しいクラスをそのファイル内に作る。 */
export function moveMethodToNewClassInFileUseCase(
  codebase: Codebase,
  methodId: string,
  fileId: string,
  generateId: IdGenerator,
): Result<Codebase, MoveMethodToNewClassInFileError> {
  return moveMethodToNewClassInFile(codebase, methodId, fileId, generateId());
}

/** プレイヤーの「クラス名を変更」操作。 */
export function renameClassUseCase(codebase: Codebase, classId: string, newName: string): Result<Codebase, RenameClassError> {
  return renameClass(codebase, classId, newName);
}

/** プレイヤーの「メソッド名を変更」操作。 */
export function renameMethodUseCase(codebase: Codebase, methodId: string, newName: string): Result<Codebase, RenameMethodError> {
  return renameMethod(codebase, methodId, newName);
}

/** プレイヤーの「継承元を設定」操作。空文字/nullは継承の解除。 */
export function setSuperclassUseCase(codebase: Codebase, classId: string, superclassName: string | null): Result<Codebase, SetSuperclassError> {
  return setSuperclass(codebase, classId, superclassName);
}

/** プレイヤーの「実装するインターフェースを追加」操作。 */
export function addInterfaceUseCase(codebase: Codebase, classId: string, interfaceName: string): Result<Codebase, AddInterfaceError> {
  return addInterface(codebase, classId, interfaceName);
}

/** プレイヤーの「実装するインターフェースを外す」操作。 */
export function removeInterfaceUseCase(codebase: Codebase, classId: string, interfaceName: string): Result<Codebase, RemoveInterfaceError> {
  return removeInterface(codebase, classId, interfaceName);
}

/** プレイヤーの「クラスを削除」操作。 */
export function deleteClassUseCase(codebase: Codebase, classId: string): Result<Codebase, DeleteClassError> {
  return deleteClass(codebase, classId);
}

/** プレイヤーの「ファイルを削除」操作。 */
export function deleteFileUseCase(codebase: Codebase, fileId: string): Result<Codebase, DeleteFileError> {
  return deleteFile(codebase, fileId);
}

/** プレイヤーの「空実装のメソッドを削除」操作。 */
export function deleteMethodUseCase(codebase: Codebase, methodId: string): Result<Codebase, DeleteMethodError> {
  return deleteMethod(codebase, methodId);
}

const RENAME_CLASS_ERROR_MESSAGES: Record<RenameClassError, string> = {
  'class-not-found': '名前を変えるクラスが見つかりません',
  'empty-class-name': 'クラス名を入力してください',
  'duplicate-class-name': '同じ名前のクラスがすでにあります',
};

const RENAME_METHOD_ERROR_MESSAGES: Record<RenameMethodError, string> = {
  'method-not-found': '名前を変えるメソッドが見つかりません',
  'empty-method-name': 'メソッド名を入力してください',
  'duplicate-method-name': '同じクラスに同じ名前のメソッドがあります',
};

const EXTRACT_ERROR_MESSAGES: Record<ExtractMethodError, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'no-fragments-selected': '抽出する処理を1つ以上選んでください',
  'fragment-not-in-method': '選んだ処理がこのメソッドに含まれていません',
  'cannot-extract-all-fragments': 'すべての処理を抽出すると元のメソッドが空になります',
  'empty-method-name': '新しいメソッド名を入力してください',
  'duplicate-method-name': '同じクラスに同じ名前のメソッドがあります',
};

const MERGE_ERROR_MESSAGES: Record<MergeMethodsError, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'same-method': '同じメソッド同士は統合できません',
  'same-class': '同じクラスの中のメソッド同士は統合できません',
  'not-private': 'privateメソッド同士でないと統合できません',
  'shape-mismatch': '処理の形が一致しないため統合できません',
  'empty-method-name': '統合後のメソッド名を入力してください',
  'duplicate-method-name': '統合先のクラスに同じ名前のメソッドがあります',
};

const MOVE_ERROR_MESSAGES: Record<Exclude<MoveMethodError, 'same-class'>, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'class-not-found': '移動先のクラスが見つかりません',
  'duplicate-method-name': '移動先のクラスに同じ名前のメソッドがあります',
};

const INLINE_ERROR_MESSAGES: Record<InlineMethodError, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'call-not-found': 'このメソッドの呼び出し元が見つかりません',
  'multiple-callers': '呼び出し元または呼び出し箇所が複数あるメソッドは戻せません',
};

const ADD_CLASS_ERROR_MESSAGES: Record<AddClassError, string> = {
  'file-not-found': '追加先のファイルが見つかりません',
  'empty-class-name': 'クラス名を入力してください',
  'duplicate-class-name': '同じ名前のクラスがすでにあります',
};

const MOVE_CLASS_ERROR_MESSAGES: Record<Exclude<MoveClassError, 'same-file'>, string> = {
  'class-not-found': 'クラスが見つかりません',
  'file-not-found': '移動先のファイルが見つかりません',
};

const MOVE_FIELD_ERROR_MESSAGES: Record<Exclude<MoveFieldError, 'same-class'>, string> = {
  'field-not-found': '移動するフィールドが見つかりません',
  'class-not-found': '移動先のクラスが見つかりません',
  'duplicate-field-name': '移動先に同じ名前のフィールドがあります',
};

const SET_SUPERCLASS_ERROR_MESSAGES: Record<SetSuperclassError, string> = {
  'class-not-found': '継承元を設定するクラスが見つかりません',
  'superclass-not-found': 'その名前のクラスが見つかりません',
  'self-inheritance': '自分自身を継承元にはできません',
  'inheritance-cycle': '継承の輪ができてしまいます',
  'already-related': 'すでに継承元または実装先になっています',
};

const ADD_INTERFACE_ERROR_MESSAGES: Record<AddInterfaceError, string> = {
  'class-not-found': '実装先を設定するクラスが見つかりません',
  'interface-not-found': 'その名前のクラスが見つかりません',
  'self-inheritance': '自分自身を実装先にはできません',
  'inheritance-cycle': '継承の輪ができてしまいます',
  'already-related': 'すでに継承元または実装先になっています',
};

const REMOVE_INTERFACE_ERROR_MESSAGES: Record<RemoveInterfaceError, string> = {
  'class-not-found': '実装先を外すクラスが見つかりません',
  'interface-not-found': 'その名前のクラスが見つかりません',
};

const DELETE_CLASS_ERROR_MESSAGES: Record<DeleteClassError, string> = {
  'class-not-found': '削除するクラスが見つかりません',
  'has-fields': 'フィールドを持つクラスは削除できません。先にフィールドを別のクラスへ移してください',
  'has-code': '処理が残っているクラスは削除できません。先にメソッドを別のクラスへ移してください',
};

const DELETE_FILE_ERROR_MESSAGES: Record<DeleteFileError, string> = {
  'file-not-found': '削除するファイルが見つかりません',
  'last-file': '最後の1ファイルは削除できません',
  'has-fields': 'フィールドを持つクラスがあるファイルは削除できません。先にフィールドを別のクラスへ移してください',
  'has-code': '処理が残っているクラスがあるファイルは削除できません。先にメソッドを別のクラスへ移してください',
};

const DELETE_METHOD_ERROR_MESSAGES: Record<DeleteMethodError, string> = {
  'method-not-found': '削除するメソッドが見つかりません',
  'not-stub': '中身のあるメソッドは削除できません。削除できるのは空実装のメソッドだけです',
};

const CHANGE_VISIBILITY_ERROR_MESSAGES: Record<Exclude<ChangeVisibilityError, 'same-visibility'>, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'contract-method': '中身のないメソッド(インターフェースの約束)の可視性は変えられません',
  'widening-not-needed': 'public は他のクラスから、protected は子クラスから呼ばれているメソッドにだけ選べます',
  'narrowing-breaks-callers': '外から呼ばれているメソッドは、その可視性にはできません',
};

export function describeMoveOutError(error: MoveClassToNewFileError | MoveMethodToNewClassError | MoveMethodToNewClassInFileError): string {
  if (error === 'class-not-found') return 'クラスが見つかりません';
  if (error === 'file-not-found') return 'ファイルが見つかりません';
  return 'メソッドが見つかりません';
}

export function describeExtractError(error: ExtractMethodError): string {
  return EXTRACT_ERROR_MESSAGES[error];
}

export function describeMoveError(error: Exclude<MoveMethodError, 'same-class'>): string {
  return MOVE_ERROR_MESSAGES[error];
}

export function describeMergeError(error: MergeMethodsError): string {
  return MERGE_ERROR_MESSAGES[error];
}

export function describeInlineError(error: InlineMethodError): string {
  return INLINE_ERROR_MESSAGES[error];
}

export function describeAddClassError(error: AddClassError): string {
  return ADD_CLASS_ERROR_MESSAGES[error];
}

export function describeMoveClassError(error: Exclude<MoveClassError, 'same-file'>): string {
  return MOVE_CLASS_ERROR_MESSAGES[error];
}

export function describeMoveFieldError(error: Exclude<MoveFieldError, 'same-class'>): string {
  return MOVE_FIELD_ERROR_MESSAGES[error];
}

export function describeRenameClassError(error: RenameClassError): string {
  return RENAME_CLASS_ERROR_MESSAGES[error];
}

export function describeRenameMethodError(error: RenameMethodError): string {
  return RENAME_METHOD_ERROR_MESSAGES[error];
}

export function describeSetSuperclassError(error: SetSuperclassError): string {
  return SET_SUPERCLASS_ERROR_MESSAGES[error];
}

export function describeAddInterfaceError(error: AddInterfaceError): string {
  return ADD_INTERFACE_ERROR_MESSAGES[error];
}

export function describeRemoveInterfaceError(error: RemoveInterfaceError): string {
  return REMOVE_INTERFACE_ERROR_MESSAGES[error];
}

export function describeDeleteClassError(error: DeleteClassError): string {
  return DELETE_CLASS_ERROR_MESSAGES[error];
}

export function describeDeleteFileError(error: DeleteFileError): string {
  return DELETE_FILE_ERROR_MESSAGES[error];
}

export function describeDeleteMethodError(error: DeleteMethodError): string {
  return DELETE_METHOD_ERROR_MESSAGES[error];
}

export function describeChangeVisibilityError(error: Exclude<ChangeVisibilityError, 'same-visibility'>): string {
  return CHANGE_VISIBILITY_ERROR_MESSAGES[error];
}
