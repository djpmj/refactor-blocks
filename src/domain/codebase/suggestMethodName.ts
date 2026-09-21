import type { Fragment } from './Codebase';

const FALLBACK_NAME = 'extractedMethod';

/** camelCase の名前を、先頭の動詞(validate)と残り(Items)に分ける。 */
function splitVerb(name: string): { verb: string; rest: string } {
  const index = name.search(/[A-Z]/);
  return index === -1 ? { verb: name, rest: '' } : { verb: name.slice(0, index), rest: name.slice(index) };
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function combine(names: readonly string[]): string {
  const parts = names.map(splitVerb);
  const verb = parts[0].verb;
  if (parts.every((part) => part.verb === verb && part.rest !== '')) {
    return verb + parts.map((part) => part.rest).join('And');
  }
  return names.map((name, index) => (index === 0 ? name : capitalize(name))).join('And');
}

/**
 * 抽出しようとしている処理から、新しいメソッドの名前を考える。
 * 処理ごとの suggestedName を組み合わせ(動詞が同じなら validateItemsAndStock のようにまとめる)、
 * 同じクラスの既存メソッド名と重なるときは末尾に番号を付ける。
 */
export function suggestMethodName(fragments: readonly Fragment[], existingNames: readonly string[]): string {
  if (fragments.length === 0) return '';
  const candidates = fragments.flatMap((fragment) => (fragment.suggestedName === undefined ? [] : [fragment.suggestedName]));
  const base = candidates.length === 0 ? FALLBACK_NAME : combine(candidates);
  const taken = new Set(existingNames);
  let name = base;
  let suffix = 2;
  while (taken.has(name)) {
    name = `${base}${suffix}`;
    suffix++;
  }
  return name;
}
