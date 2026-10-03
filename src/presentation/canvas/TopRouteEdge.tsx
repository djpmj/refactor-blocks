import { BaseEdge, type EdgeProps } from "@xyflow/react";

const LANE_GAP = 16;
const BASE_CLEARANCE = 8;

/**
 * ファイルを1つ以上飛び越える辺。上端の接続点から、レーン(`data.lane`)ごとに高さを変えて水平に渡ってから
 * 下りることで、他の飛び越える辺や間にあるファイルのクラスの上に重ならないようにする(`layoutCodebase.ts` の
 * `assignTopLanes` がレーンを割り当てる)。
 */
export function TopRouteEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style, data }: Readonly<EdgeProps>) {
  const lane = typeof data?.lane === "number" ? data.lane : 0;
  const busY = Math.min(sourceY, targetY) - BASE_CLEARANCE - lane * LANE_GAP;
  const path = `M${sourceX},${sourceY} L${sourceX},${busY} L${targetX},${busY} L${targetX},${targetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
