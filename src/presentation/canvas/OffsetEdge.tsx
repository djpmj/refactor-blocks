import { BaseEdge, type EdgeProps } from "@xyflow/react";
import { offsetBezierPath } from './edgePaths';

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
  const { path } = offsetBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    targetOffset: typeof data?.targetOffset === "number" ? data.targetOffset : 0,
  });
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
