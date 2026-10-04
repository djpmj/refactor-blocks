import { BaseEdge, Position, type EdgeProps } from "@xyflow/react";

const LANE_GAP = 16;
const BASE_CLEARANCE = 8;

/**
 * ファイルを1つ以上飛び越える辺。上端の接続点から、レーン(`data.lane`)ごとに高さを変えて水平に渡ってから
 * 下りることで、他の飛び越える辺や間にあるファイルのクラスの上に重ならないようにする(`layoutCodebase.ts` の
 * `assignTopLanes` がレーンを割り当てる)。
 */
export function TopRouteEdge({ sourceX, sourceY, targetX, targetY, targetPosition, markerEnd, style, data }: Readonly<EdgeProps>) {
  const lane = typeof data?.lane === "number" ? data.lane : 0;
  const offset = typeof data?.targetOffset === "number" ? data.targetOffset : 0;
  const isVerticalSide = targetPosition === Position.Left || targetPosition === Position.Right;
  const adjustedTargetX = isVerticalSide ? targetX : targetX + offset;
  const adjustedTargetY = isVerticalSide ? targetY + offset : targetY;
  const busY = Math.min(sourceY, targetY) - BASE_CLEARANCE - lane * LANE_GAP;
  const path = `M${sourceX},${sourceY} L${sourceX},${busY} L${adjustedTargetX},${busY} L${adjustedTargetX},${adjustedTargetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
