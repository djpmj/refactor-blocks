/** 自動の合わせの状態。 */
export type AutoFitState = {
  /** 最後に自動で合わせたあと、プレイヤーが自分でズーム・移動したか。 */
  readonly userMoved: boolean;
  /** 最後に合わせたときのキャンバスの大きさ。 */
  readonly lastSize: { readonly width: number; readonly height: number } | null;
};

/** キャンバスの大きさが size になったとき、合わせ直すべきか。プレイヤーが動かしていない、かつ幅か高さが 1px 以上変わったとき true。 */
export function shouldRefit(
  state: AutoFitState,
  size: { readonly width: number; readonly height: number },
): boolean {
  if (state.userMoved) return false;
  if (state.lastSize === null) return true;
  return Math.abs(size.width - state.lastSize.width) >= 1
    || Math.abs(size.height - state.lastSize.height) >= 1;
}
