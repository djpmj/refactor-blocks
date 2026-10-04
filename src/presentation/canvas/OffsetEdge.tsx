import { BaseEdge, getBezierPath, Position, type EdgeProps } from "@xyflow/react";

/** 終点だけを targetOffset ぶん移動した標準ベジェ曲線。 */
export function OffsetEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  data,
}: Readonly<EdgeProps>) {
  const offset = typeof data?.targetOffset === "number" ? data.targetOffset : 0;
  const isVerticalSide = targetPosition === Position.Left || targetPosition === Position.Right;
  const adjustedTargetX = isVerticalSide ? targetX : targetX + offset;
  const adjustedTargetY = isVerticalSide ? targetY + offset : targetY;
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX: adjustedTargetX, targetY: adjustedTargetY, targetPosition });
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
