/** ステージIDごとの、100点に届いた最少の手数(0以上の整数)。 */
// ponytail: ステージの手順を変えても古い自己ベストが残る。変わったステージで混乱が出たら fingerprint を併せて保存する
export type MoveBests = Readonly<Partial<Record<string, number>>>;

/** 今回の手数が自己ベスト以上なら同じ参照を返す(Zustand の不要な再描画を避ける。updateProgress と同じ)。 */
export function updateMoveBest(bests: MoveBests, stageId: string, moves: number): MoveBests {
  const best = bests[stageId];
  if (best !== undefined && moves >= best) return bests;
  return { ...bests, [stageId]: moves };
}
