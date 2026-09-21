export type InvestigationResult = {
  /** 変更が必要だったのに選ばなかったメソッド(実務でいう修正漏れ)。 */
  readonly missed: readonly string[];
  /** 変更は不要なのに選んだメソッド(調査の無駄)。 */
  readonly extra: readonly string[];
};

/** プレイヤーが選んだメソッドと、実際の変更箇所を突き合わせる。 */
export function checkInvestigation(selected: readonly string[], sites: readonly string[]): InvestigationResult {
  return {
    missed: sites.filter((id) => !selected.includes(id)),
    extra: selected.filter((id) => !sites.includes(id)),
  };
}
