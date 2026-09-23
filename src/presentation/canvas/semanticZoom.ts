import { useStore } from '@xyflow/react';
import { useGameStore } from '../store/useGameStore';

/** この倍率以上でメソッドと行数まで表示する。未満ではファイル名とクラス名だけにして全体を見渡しやすくする。 */
export const DETAIL_ZOOM = 0.6;

/**
 * 今のズーム倍率でメソッド・行数まで表示するか。倍率そのものではなく真偽値を購読し、ズーム中の再描画を抑える。
 * 変更依頼の実装中は、部品置き場でファイルが増えて倍率が下がっても、部品をドラッグできるよう常に表示する。
 */
export function useShowDetails(): boolean {
  const implementing = useGameStore((state) => state.changeSession !== null);
  const zoomedIn = useStore((state) => state.transform[2] >= DETAIL_ZOOM);
  return implementing || zoomedIn;
}
