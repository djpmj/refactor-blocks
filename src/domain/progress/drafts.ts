import { isCodebase } from '../codebase/isCodebase';
import type { Codebase } from '../codebase/Codebase';
import type { Stage } from '../stage/Stage';
import { stageFingerprint } from './stageFingerprint';

export type Draft = { readonly fingerprint: string; readonly codebase: Codebase };
/** ステージID → 下書き。 */
export type Drafts = Readonly<Partial<Record<string, Draft>>>;

/** 下書きを入れた新しい Drafts を返す。codebase が初期コードそのもの(参照が同じ)なら、そのステージの下書きを消す。 */
export function putDraft(drafts: Drafts, stage: Stage, codebase: Codebase): Drafts {
  const others = Object.fromEntries(Object.entries(drafts).filter(([stageId]) => stageId !== stage.id));
  return codebase === stage.codebase ? others : { ...others, [stage.id]: { fingerprint: stageFingerprint(stage), codebase } };
}

/** そのステージで使える下書きのコードを返す。無い・指紋が違う・形が壊れているなら undefined。 */
export function takeDraft(drafts: Drafts, stage: Stage): Codebase | undefined {
  const draft = drafts[stage.id];
  if (draft === undefined || draft.fingerprint !== stageFingerprint(stage)) return undefined;
  return isCodebase(draft.codebase) ? draft.codebase : undefined;
}
