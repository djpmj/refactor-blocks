import { allClasses, type Codebase } from '../codebase/Codebase';

export type FragmentPlacementDiff = {
  readonly fragmentLabel: string;
  readonly responsibility: string;
  /** プレイヤーの設計で、その処理を持つクラスの名前。 */
  readonly playerClass: string;
  /** 解答例で、その処理を持つクラスの名前。 */
  readonly answerClass: string;
};

/** 呼び出し行は抽出で増えるだけの行なので、置き場所の比較から外す。 */
const CALL_RESPONSIBILITY = 'call';

type Placement = { readonly label: string; readonly responsibility: string; readonly className: string };

function placements(codebase: Codebase): Map<string, Placement> {
  const result = new Map<string, Placement>();
  for (const codeClass of allClasses(codebase)) {
    for (const fragment of codeClass.methods.flatMap((method) => method.fragments)) {
      if (fragment.responsibility !== CALL_RESPONSIBILITY) result.set(fragment.id, { label: fragment.label, responsibility: fragment.responsibility, className: codeClass.name });
    }
  }
  return result;
}

/**
 * 同じ処理(Fragment.id)を持つクラスが、プレイヤーの設計と解答例で違うものを返す。
 * メソッドが違っても同じクラスにあれば違いにしない。片方にしかない処理(統合で消えたものなど)は比べない。
 */
export function designDiff(player: Codebase, answer: Codebase): FragmentPlacementDiff[] {
  const answerPlacements = placements(answer);
  return [...placements(player)].flatMap(([id, mine]) => {
    const theirs = answerPlacements.get(id);
    if (theirs === undefined || theirs.className === mine.className) return [];
    return [{ fragmentLabel: mine.label, responsibility: mine.responsibility, playerClass: mine.className, answerClass: theirs.className }];
  });
}
