import type { XYPosition } from '@xyflow/react';

export type FileSize = { width: number; height: number };

const FILE_HEADER_HEIGHT = 36;

export function fileTopLeftAtDrop(drop: XYPosition, size: FileSize): XYPosition {
  if (size.width === 0 && size.height === 0) return drop;
  return { x: drop.x - size.width / 2, y: drop.y - FILE_HEADER_HEIGHT / 2 };
}
