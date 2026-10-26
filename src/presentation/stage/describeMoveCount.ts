/** 100点にしたときにサイドバーへ出す、手数の1行。減点ではなく、比べる材料を見せるだけ。 */
export function describeMoveCount(input: { readonly moves: number | undefined; readonly sample: number | undefined; readonly best: number | undefined }): string {
  const { moves, sample, best } = input;
  if (moves === undefined) {
    return best === undefined ? '前回の続きから再開したため、手数は数えていません' : `前回の続きから再開したため、手数は数えていません(自己ベスト: ${String(best)}手)`;
  }
  const notes = [
    ...(sample === undefined ? [] : [`模範解答: ${String(sample)}手`]),
    ...(best !== undefined && best < moves ? [`自己ベスト: ${String(best)}手`] : []),
  ];
  return notes.length === 0 ? `あなたの手数: ${String(moves)}手` : `あなたの手数: ${String(moves)}手(${notes.join('・')})`;
}
