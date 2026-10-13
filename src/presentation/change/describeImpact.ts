import type { ChangeImpact, ImpactMove } from '../../domain/change/changeImpact';

function describeMove(move: ImpactMove): string {
  const labels = move.fragmentLabels.map((label) => `「${label}」`).join('・');
  const destination = `${move.to.className}.${move.to.methodName}()`;
  if (move.kind === 'gathered') return `${move.from.length} か所に散らばっていた ${labels} を、あなたが ${destination} にまとめた`;
  if (move.kind === 'extracted') {
    const source = move.from[0];
    return `あなたが${labels}を ${source.className}.${source.methodName}() から ${destination} に切り出した`;
  }
  return `あなたが ${move.to.methodName}() を ${move.to.className} に移した`;
}

function countChange(before: number, after: number, suffix: string): string {
  return before === after ? `${before} ${suffix}のまま` : `${before} ${suffix} → ${after} ${suffix}`;
}

function describeResult(impact: ChangeImpact): string {
  if (impact.verdict === 'same') return 'この変更については、組み替えの前後で直す場所も読む量も変わらなかった。変わりそうな場所で分けられているか、見直してみよう';
  if (impact.verdict === 'worse') return 'この変更については、組み替える前より直す場所か読む量が増えた。変わりそうな処理が散らばっていないか、見直してみよう';
  return `だから、この変更で直す場所は ${countChange(impact.before.sites.length, impact.after.sites.length, 'か所')}、読む量は ${countChange(impact.before.readLines, impact.after.readLines, '行')} になった`;
}

/** 変更箇所と責務移動の結果をプレイヤー向けの短い行にする。 */
export function describeImpact(impact: ChangeImpact, openingMissed: number | null): readonly string[] {
  const moves = impact.moves.map(describeMove).filter((line) => line.length > 0);
  const lines = impact.verdict === 'better' && moves.length === 0 ? [] : moves;
  lines.push(describeResult(impact));
  if (openingMissed !== null && openingMissed > 0) lines.push(`冒頭では ${openingMissed} か所を直し忘れて本番バグになったが、今回は直し忘れなし`);
  return lines;
}
