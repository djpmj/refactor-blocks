import { createContext, useContext } from 'react';
import type { DropTargetIds, Dragging } from './dropTargets';

export type DropTargetsState = {
  readonly dragging: Dragging;
  readonly targets: DropTargetIds;
};

export const DropTargetsContext = createContext<DropTargetsState | null>(null);

export function useDropTargetClassNames(kind: 'class' | 'file', id: string): string {
  return dropTargetClassNames(useContext(DropTargetsContext), kind, id);
}

export function dropTargetClassNames(state: DropTargetsState | null, kind: 'class' | 'file', id: string): string {
  if (state === null) return '';
  if (state.dragging.kind === 'class') {
    if (kind !== 'file') return '';
    return state.targets.fileIds.has(id) ? 'file-node--can-drop' : 'file-node--cannot-drop';
  }
  if (kind !== 'class') return '';
  return state.targets.classIds.has(id) ? 'class-node--can-drop' : 'class-node--cannot-drop';
}
