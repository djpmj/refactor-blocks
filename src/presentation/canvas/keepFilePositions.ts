import type { XYPosition } from '@xyflow/react';
import { FILE_GAP, type CodebaseFlowNode, type FileRect } from './layoutCodebase';

/** 既知のファイル位置と新規ファイルの配置規則を反映する。配置済みの箱が育って重なる場合も動かさない。 */
export function placeFiles(
  layoutNodes: readonly CodebaseFlowNode[],
  known: ReadonlyMap<string, XYPosition>,
  existingRects: ReadonlyMap<string, FileRect>,
  dropPositions: ReadonlyMap<string, XYPosition> = new Map(),
): CodebaseFlowNode[] {
  if (existingRects.size === 0 && known.size === 0 && dropPositions.size === 0) return [...layoutNodes];
  let right = existingRects.size === 0 ? 0 : Math.max(...[...existingRects.values()].map((rect) => rect.x + rect.width));
  const top = existingRects.size === 0 ? 0 : Math.min(...[...existingRects.values()].map((rect) => rect.y));
  return layoutNodes.map((node) => {
    if (node.type !== 'fileNode') return node;
    const position = known.get(node.id) ?? dropPositions.get(node.id);
    if (position !== undefined) return { ...node, position };
    if (existingRects.size === 0 && dropPositions.size === 0) return node;
    const next = { x: right + FILE_GAP, y: top };
    const width = typeof node.style?.width === 'number' ? node.style.width : Number.parseFloat(String(node.style?.width ?? '0'));
    right = next.x + (Number.isFinite(width) ? width : 0);
    return { ...node, position: next };
  });
}
