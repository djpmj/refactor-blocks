import { useStore } from '@xyflow/react';

/** この倍率以上でメソッドと行数まで表示する。未満ではファイル名とクラス名だけにして全体を見渡しやすくする。 */
export const DETAIL_ZOOM = 0.6;

/** 今のズーム倍率でメソッド・行数まで表示するか。倍率そのものではなく真偽値を購読し、ズーム中の再描画を抑える。 */
export function useShowDetails(): boolean {
  return useStore((state) => state.transform[2] >= DETAIL_ZOOM);
}
