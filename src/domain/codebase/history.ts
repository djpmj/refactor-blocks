import type { Codebase } from './Codebase';

/**
 * 取り消し・やり直しのための履歴。操作は Codebase を変更せず新しく作り直しているので、
 * 差分や逆操作は持たず、Codebase のスナップショットをそのまま積む。
 */
export type History = {
  readonly past: readonly Codebase[];
  readonly future: readonly Codebase[];
};

export type Travel = { readonly history: History; readonly codebase: Codebase };

export function emptyHistory(): History {
  return { past: [], future: [] };
}

/** 操作の直前のコードベースを過去に積む。新しい操作をしたら、進める側の履歴は捨てる。 */
// ponytail: 履歴の長さに上限は設けていない。ステージを切り替えれば空になる。長時間のプレイでメモリが気になったら古いものから捨てる。
export function recordChange(history: History, before: Codebase): History {
  return { past: [...history.past, before], future: [] };
}

/** 1手戻す。戻せる手がなければ undefined。 */
export function undoHistory(history: History, current: Codebase): Travel | undefined {
  const previous = history.past.at(-1);
  if (previous === undefined) return undefined;
  return { history: { past: history.past.slice(0, -1), future: [current, ...history.future] }, codebase: previous };
}

/** 1手進める。進める手がなければ undefined。 */
export function redoHistory(history: History, current: Codebase): Travel | undefined {
  const next = history.future.at(0);
  if (next === undefined) return undefined;
  return { history: { past: [...history.past, current], future: history.future.slice(1) }, codebase: next };
}

/**
 * 初期コード start から今のコード current までの手数。道のり [...past, current] の中で start(同じ参照)が
 * 最後に現れた位置から数える。道のりに start が無ければ(下書きから再開したとき)undefined。
 */
export function movesSince(history: History, current: Codebase, start: Codebase): number | undefined {
  const path = [...history.past, current];
  const startIndex = path.lastIndexOf(start);
  return startIndex === -1 ? undefined : path.length - 1 - startIndex;
}
