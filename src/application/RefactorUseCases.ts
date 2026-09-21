import type { Codebase } from '../domain/codebase/Codebase';
import { extractMethod, type ExtractMethodError } from '../domain/codebase/extractMethod';
import { findCallerOf, inlineMethod, type InlineMethodError } from '../domain/codebase/inlineMethod';
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

export function describeExtractError(error: ExtractMethodError): string {
  return EXTRACT_ERROR_MESSAGES[error];
}

export function describeMoveError(error: Exclude<MoveMethodError, 'same-class'>): string {
  return MOVE_ERROR_MESSAGES[error];
}

export function describeInlineError(error: InlineMethodError): string {
  return INLINE_ERROR_MESSAGES[error];
}
