/** 模範解答の手順のまとまり。from は、このまとまりが始まる手順の番号(0始まり)。 */
export type SolutionPhase = { readonly title: string; readonly why: string; readonly from: number };

/** 手順の番号が属する方針。from が昇順に並んでいる前提で、from が番号以下の最後のものを返す。 */
export function phaseOfStep(phases: readonly SolutionPhase[], stepIndex: number): SolutionPhase | undefined {
  return phases.findLast((phase) => phase.from <= stepIndex);
}
