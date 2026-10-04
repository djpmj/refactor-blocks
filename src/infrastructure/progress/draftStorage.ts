import { isCodebase } from '../../domain/codebase/isCodebase';
import type { Draft, Drafts } from '../../domain/progress/drafts';

const STORAGE_KEY = 'refactor-blocks:drafts';

function isDraft(value: unknown): value is Draft {
  return typeof value === 'object' && value !== null && 'fingerprint' in value && typeof value.fingerprint === 'string' && 'codebase' in value && isCodebase(value.codebase);
}

/** 下書きを読み込む。壊れている・存在しないときは空を返し(例外は投げない)、不正なエントリだけ捨てる。 */
export function loadDrafts(): Drafts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, draft]) => isDraft(draft)));
  } catch {
    return {};
  }
}

/** 下書きを保存する。localStorageが使えない環境でも画面を壊さない。 */
// ponytail: 全ステージの下書きを1つのキーにJSONで丸ごと書く。1回の書き込みで数十KB程度。ステージが数百になって重くなったら、ステージごとのキーに分ける
export function saveDrafts(drafts: Drafts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // 書き込めなくても、下書きが残らないだけで遊べるようにする
  }
}
