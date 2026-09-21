import type { Codebase } from '../domain/codebase/Codebase';
import { extractMethod, type ExtractMethodError } from '../domain/codebase/extractMethod';
import { moveMethod, type MoveMethodError } from '../domain/codebase/moveMethod';
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

export function describeExtractError(error: ExtractMethodError): string {
  return EXTRACT_ERROR_MESSAGES[error];
}

export function describeMoveError(error: Exclude<MoveMethodError, 'same-class'>): string {
  return MOVE_ERROR_MESSAGES[error];
}
