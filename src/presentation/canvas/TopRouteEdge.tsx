import { BaseEdge, type EdgeProps } from "@xyflow/react";
import { topRoutePath } from './edgePaths';

/**
 * ファイルを1つ以上飛び越える辺。上端の接続点から、レーン(`data.lane`)ごとに高さを変えて水平に渡ってから
 * 下りることで、他の飛び越える辺や間にあるファイルのクラスの上に重ならないようにする(`layoutCodebase.ts` の
 * `assignTopLanes` がレーンを割り当てる)。
 */
export function TopRouteEdge({ sourceX, sourceY, targetX, targetY, targetPosition, markerEnd, style, data }: Readonly<EdgeProps>) {
  const { path } = topRoutePath({
    sourceX, sourceY, targetX, targetY, targetPosition,
    lane: typeof data?.lane === "number" ? data.lane : 0,
    targetOffset: typeof data?.targetOffset === "number" ? data.targetOffset : 0,
  });
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
