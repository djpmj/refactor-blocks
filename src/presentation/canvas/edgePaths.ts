import { getBezierPath, Position } from '@xyflow/react';

const LANE_GAP = 16;
const BASE_CLEARANCE = 8;

export function offsetBezierPath(input: {
  readonly sourceX: number;
  readonly sourceY: number;
  readonly sourcePosition: Position;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetPosition: Position;
  readonly targetOffset: number;
}) {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, targetOffset } = input;
  const vertical = targetPosition === Position.Left || targetPosition === Position.Right;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX: vertical ? targetX : targetX + targetOffset,
    targetY: vertical ? targetY + targetOffset : targetY,
    targetPosition,
  });
  return { path, labelX, labelY };
}

export function topRoutePath(input: {
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetPosition: Position;
  readonly lane: number;
  readonly targetOffset: number;
}) {
  const { sourceX, sourceY, targetX, targetY, targetPosition, lane, targetOffset } = input;
  const vertical = targetPosition === Position.Left || targetPosition === Position.Right;
  const adjustedTargetX = vertical ? targetX : targetX + targetOffset;
  const adjustedTargetY = vertical ? targetY + targetOffset : targetY;
  const busY = Math.min(sourceY, targetY) - BASE_CLEARANCE - lane * LANE_GAP;
  return {
    path: `M${sourceX},${sourceY} L${sourceX},${busY} L${adjustedTargetX},${busY} L${adjustedTargetX},${adjustedTargetY}`,
    labelX: (sourceX + adjustedTargetX) / 2,
    labelY: busY,
  };
}
