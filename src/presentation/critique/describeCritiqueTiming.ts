import type { Codebase } from '../../domain/codebase/Codebase';

/** 講評を取得した時点の記録。codebase は参照で比べる(リファクタリング操作は必ず新しいCodebaseを返すため)。 */
export type CritiqueSnapshot = {
  readonly codebase: Codebase;
  readonly total: number;
  /** 初期コードからの手数。下書きから再開したなど数えられないときは undefined(movesSince と同じ)。 */
  readonly moves: number | undefined;
};

/** 講評がいつの時点のものかの1行と、今のコードと食い違っているか。 */
export function describeCritiqueTiming(snapshot: CritiqueSnapshot, current: Codebase): { readonly stale: boolean; readonly text: string } {
  const at = snapshot.moves === undefined ? `${snapshot.total}点` : `${snapshot.total}点・${snapshot.moves}手`;
  // ponytail: 参照で比べるため、同じ内容に別の操作で戻しても古いと出る。困ったら codebase の内容比較に替える
  if (snapshot.codebase === current) return { stale: false, text: `${at}の時点の講評です` };
  return { stale: true, text: `この講評は古くなりました(${at}の時点)。今のコードとは違います` };
}
