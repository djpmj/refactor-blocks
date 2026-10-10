import { moveClassTargets } from '../../domain/codebase/moveClass';
import { moveFieldTargets } from '../../domain/codebase/moveField';
import { moveMethodTargets } from '../../domain/codebase/moveMethod';
import type { Codebase } from '../../domain/codebase/Codebase';

export type Dragging =
  | { readonly kind: 'method'; readonly id: string }
  | { readonly kind: 'field'; readonly id: string }
  | { readonly kind: 'class'; readonly id: string };

export type DropTargetIds = {
  readonly classIds: ReadonlySet<string>;
  readonly fileIds: ReadonlySet<string>;
};

/** ドラッグ中のものを置けるクラスID・ファイルIDの集合。 */
export function dropTargetIds(codebase: Codebase, dragging: Dragging): DropTargetIds {
  if (dragging.kind === 'method') {
    return { classIds: new Set(moveMethodTargets(codebase, dragging.id).map((codeClass) => codeClass.id)), fileIds: new Set() };
  }
  if (dragging.kind === 'field') {
    return { classIds: new Set(moveFieldTargets(codebase, dragging.id).map((codeClass) => codeClass.id)), fileIds: new Set() };
  }
  return { classIds: new Set(), fileIds: new Set(moveClassTargets(codebase, dragging.id).map((file) => file.id)) };
}
