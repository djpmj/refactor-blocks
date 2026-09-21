import { addClass, type AddClassError } from '../domain/codebase/addClass';
import { addFile, type AddFileError } from '../domain/codebase/addFile';
import type { Codebase } from '../domain/codebase/Codebase';
import { extractMethod, type ExtractMethodError } from '../domain/codebase/extractMethod';
import { findCallerOf, inlineMethod, type InlineMethodError } from '../domain/codebase/inlineMethod';
import { moveClass, type MoveClassError } from '../domain/codebase/moveClass';
import { moveClassToNewFile, moveMethodToNewClass, type MoveClassToNewFileError, type MoveMethodToNewClassError } from '../domain/codebase/moveToNewHome';
import { moveMethod, type MoveMethodError } from '../domain/codebase/moveMethod';
import { renameClass, type RenameClassError } from '../domain/codebase/renameClass';
import { renameFile, type RenameFileError } from '../domain/codebase/renameFile';
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
export function addFileUseCase(codebase: Codebase, path: string, generateId: IdGenerator): Result<Codebase, AddFileError> {
  return addFile(codebase, path, generateId());
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
): Result<Codebase, MoveClassToNewFileError> {
  return moveClassToNewFile(codebase, classId, generateId());
}

/** プレイヤーの「メソッドをファイルの枠外へドロップ」操作。新しいファイルとクラスを自動で作ってメソッドを置く。 */
export function moveMethodToNewClassUseCase(
  codebase: Codebase,
  methodId: string,
  generateId: IdGenerator,
): Result<Codebase, MoveMethodToNewClassError> {
  return moveMethodToNewClass(codebase, methodId, { classId: generateId(), fileId: generateId() });
}

/** プレイヤーの「クラス名を変更」操作。 */
export function renameClassUseCase(codebase: Codebase, classId: string, newName: string): Result<Codebase, RenameClassError> {
  return renameClass(codebase, classId, newName);
}

/** プレイヤーの「ファイルのパスを変更」操作。 */
export function renameFileUseCase(codebase: Codebase, fileId: string, newPath: string): Result<Codebase, RenameFileError> {
  return renameFile(codebase, fileId, newPath);
}

const RENAME_CLASS_ERROR_MESSAGES: Record<RenameClassError, string> = {
  'class-not-found': '名前を変えるクラスが見つかりません',
  'empty-class-name': 'クラス名を入力してください',
  'duplicate-class-name': '同じ名前のクラスがすでにあります',
};

const RENAME_FILE_ERROR_MESSAGES: Record<RenameFileError, string> = {
  'file-not-found': '名前を変えるファイルが見つかりません',
  'empty-path': 'ファイルのパスを入力してください',
  'duplicate-path': '同じパスのファイルがすでにあります',
};

const EXTRACT_ERROR_MESSAGES: Record<ExtractMethodError, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'no-fragments-selected': '抽出する処理を1つ以上選んでください',
  'fragment-not-in-method': '選んだ処理がこのメソッドに含まれていません',
  'cannot-extract-all-fragments': 'すべての処理を抽出すると元のメソッドが空になります',
  'empty-method-name': '新しいメソッド名を入力してください',
  'duplicate-method-name': '同じクラスに同じ名前のメソッドがあります',
};

const MOVE_ERROR_MESSAGES: Record<Exclude<MoveMethodError, 'same-class'>, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'class-not-found': '移動先のクラスが見つかりません',
  'duplicate-method-name': '移動先のクラスに同じ名前のメソッドがあります',
};

const INLINE_ERROR_MESSAGES: Record<InlineMethodError, string> = {
  'method-not-found': 'メソッドが見つかりません',
  'not-private': 'publicメソッドは呼び出し元へ戻せません',
  'call-not-found': 'このメソッドの呼び出し元が見つかりません',
};

const ADD_CLASS_ERROR_MESSAGES: Record<AddClassError, string> = {
  'file-not-found': '追加先のファイルが見つかりません',
  'empty-class-name': 'クラス名を入力してください',
  'duplicate-class-name': '同じ名前のクラスがすでにあります',
};

const ADD_FILE_ERROR_MESSAGES: Record<AddFileError, string> = {
  'empty-path': 'ファイルのパスを入力してください',
  'duplicate-path': '同じパスのファイルがすでにあります',
};

const MOVE_CLASS_ERROR_MESSAGES: Record<Exclude<MoveClassError, 'same-file'>, string> = {
  'class-not-found': 'クラスが見つかりません',
  'file-not-found': '移動先のファイルが見つかりません',
};

export function describeMoveOutError(error: MoveClassToNewFileError | MoveMethodToNewClassError): string {
  return error === 'class-not-found' ? 'クラスが見つかりません' : 'メソッドが見つかりません';
}

export function describeExtractError(error: ExtractMethodError): string {
  return EXTRACT_ERROR_MESSAGES[error];
}

export function describeMoveError(error: Exclude<MoveMethodError, 'same-class'>): string {
  return MOVE_ERROR_MESSAGES[error];
}

export function describeInlineError(error: InlineMethodError): string {
  return INLINE_ERROR_MESSAGES[error];
}

export function describeAddClassError(error: AddClassError): string {
  return ADD_CLASS_ERROR_MESSAGES[error];
}

export function describeAddFileError(error: AddFileError): string {
  return ADD_FILE_ERROR_MESSAGES[error];
}

export function describeMoveClassError(error: Exclude<MoveClassError, 'same-file'>): string {
  return MOVE_CLASS_ERROR_MESSAGES[error];
}

export function describeRenameClassError(error: RenameClassError): string {
  return RENAME_CLASS_ERROR_MESSAGES[error];
}

export function describeRenameFileError(error: RenameFileError): string {
  return RENAME_FILE_ERROR_MESSAGES[error];
}
