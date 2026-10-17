import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';

/** ボスの結果で、組み替える前のコードに入れていた場合との比較を1文で説明する。 */
export function describeBoss(outcome: ChangeOutcome, openingTitle: string | undefined): string | undefined {
  const { bossCounterfactual } = outcome;
  if (bossCounterfactual === undefined) return undefined;
  const now = outcome.placement.score.total;
  if (now <= bossCounterfactual.score) return 'この設計では、鬼の変更は組み替える前と同じくらい大変だった。変わる場所を切り出せているか、見直してみよう';
  const thanks = openingTitle === undefined ? '組み替えておいたおかげで' : `冒頭の「${openingTitle}」の処理を切り出しておいたおかげで`;
  return `${thanks}、鬼の変更も ${now}点で入れられた(組み替える前なら最善でも ${bossCounterfactual.score}点)`;
}
