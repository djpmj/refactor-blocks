import { findClassOfMethod, findMethod, mapClasses, type Codebase, type Fragment, type Method } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type ExtractMethodRequest = {
  readonly sourceMethodId: string;
  readonly fragmentIds: readonly string[];
  readonly newMethodId: string;
  readonly newMethodName: string;
};

export type ExtractMethodError =
  | 'method-not-found'
  | 'no-fragments-selected'
  | 'fragment-not-in-method'
  | 'cannot-extract-all-fragments'
  | 'empty-method-name'
  | 'duplicate-method-name';

/** 抽出した処理の代わりに元のメソッドに残る「呼び出し」1行。 */
const CALL_LINES = 1;

function validate(codebase: Codebase, request: ExtractMethodRequest): Result<Method, ExtractMethodError> {
  const source = findMethod(codebase, request.sourceMethodId);
  const owner = findClassOfMethod(codebase, request.sourceMethodId);
  if (source === undefined || owner === undefined) return err('method-not-found');
  if (request.fragmentIds.length === 0) return err('no-fragments-selected');
  const fragmentIdsInSource = new Set(source.fragments.map((fragment) => fragment.id));
  if (request.fragmentIds.some((id) => !fragmentIdsInSource.has(id))) return err('fragment-not-in-method');
  if (request.fragmentIds.length >= source.fragments.length) return err('cannot-extract-all-fragments');
  const name = request.newMethodName.trim();
  if (name === '') return err('empty-method-name');
  if (owner.methods.some((method) => method.name === name)) return err('duplicate-method-name');
  return ok(source);
}

/** 抽出対象の処理を取り除き、最初の抽出位置に新メソッドの呼び出しを差し込む。 */
function replaceWithCall(source: Method, selected: ReadonlySet<string>, callFragment: Fragment): Fragment[] {
  const remaining: Fragment[] = [];
  let callInserted = false;
  for (const fragment of source.fragments) {
    if (!selected.has(fragment.id)) {
      remaining.push(fragment);
    } else if (!callInserted) {
      remaining.push(callFragment);
      callInserted = true;
    }
  }
  return remaining;
}

/**
 * Extract Method: メソッドの中の処理のまとまりを、同じクラスの新しいprivateメソッドとして切り出す。
 * 元のメソッドには新メソッドの呼び出し(1行)が残る。
 */
export function extractMethod(codebase: Codebase, request: ExtractMethodRequest): Result<Codebase, ExtractMethodError> {
  const validated = validate(codebase, request);
  if (!validated.ok) return validated;
  const source = validated.value;
  const selected = new Set(request.fragmentIds);
  const name = request.newMethodName.trim();
  const extracted: Method = {
    id: request.newMethodId,
    name,
    visibility: 'private',
    fragments: source.fragments.filter((fragment) => selected.has(fragment.id)),
  };
  const callFragment: Fragment = {
    id: `${request.newMethodId}:call`,
    label: `${name}() を呼び出す`,
    lines: CALL_LINES,
    responsibility: 'call',
    uses: [request.newMethodId],
  };
  const updatedSource: Method = { ...source, fragments: replaceWithCall(source, selected, callFragment) };
  return ok(
    mapClasses(codebase, (codeClass) => {
      const index = codeClass.methods.findIndex((method) => method.id === source.id);
      if (index === -1) return codeClass;
      const methods = [...codeClass.methods];
      methods.splice(index, 1, updatedSource, extracted);
      return { ...codeClass, methods };
    }),
  );
}
