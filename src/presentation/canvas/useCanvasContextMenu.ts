import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { CodebaseFlowNode } from './layoutCodebase';

export type ContextMenuTarget = {
  readonly x: number;
  readonly y: number;
  /** 右クリックしたファイル(クラス・メソッドならそれを含むファイル)。キャンバスの余白ならnull。 */
  readonly fileId: string | null;
  /** 右クリックしたクラス(メソッドならそれを持つクラス)。ファイル・余白ならnull。 */
  readonly classId: string | null;
  readonly member: { readonly kind: 'method' | 'field'; readonly id: string } | null;
  readonly returnFocus: Element | null;
};

function memberAt(element: EventTarget | null): ContextMenuTarget['member'] {
  if (!(element instanceof Element)) return null;
  const chip = element.closest('[data-method-id], [data-field-id]');
  const methodId = chip?.getAttribute('data-method-id');
  if (methodId != null) return { kind: 'method', id: methodId };
  const fieldId = chip?.getAttribute('data-field-id');
  return fieldId == null ? null : { kind: 'field', id: fieldId };
}

/** 右クリックメニューの開閉。React Flowの onNodeContextMenu / onPaneContextMenu に渡すハンドラーを返す。 */
export function useCanvasContextMenu() {
  const [target, setTarget] = useState<ContextMenuTarget | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const cancelPendingFocus = useCallback(() => {
    if (pendingFocus.current !== null) cancelAnimationFrame(pendingFocus.current);
    pendingFocus.current = null;
  }, []);
  useEffect(() => cancelPendingFocus, [cancelPendingFocus]);
  const close = useCallback(() => {
    cancelPendingFocus();
    setTarget(null);
  }, [cancelPendingFocus]);
  const dismiss = () => {
    const returnFocus = target?.returnFocus;
    close();
    // pointerdownの既定フォーカス移動後に戻す。開き直した場合はopenで予約を取り消す。
    pendingFocus.current = requestAnimationFrame(() => {
      pendingFocus.current = null;
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
    });
  };
  const open = (event: MouseEvent | globalThis.MouseEvent, fileId: string | null, classId: string | null) => {
    event.preventDefault();
    cancelPendingFocus();
    setTarget({ x: event.clientX, y: event.clientY, fileId, classId, member: classId === null ? null : memberAt(event.target), returnFocus: document.activeElement });
  };
  // メソッドを右クリックしたときも、イベントはそれを含むクラスノードに届く。
  // クラスノードの親(parentId)はファイルノードで、ファイルノードのIDはファイルのID。
  const onNodeContextMenu = (event: MouseEvent, node: CodebaseFlowNode) => {
    const isClass = node.type === 'classNode';
    open(event, isClass ? (node.parentId ?? null) : node.id, isClass ? node.id : null);
  };
  const onPaneContextMenu = (event: MouseEvent | globalThis.MouseEvent) => {
    open(event, null, null);
  };
  return { target, close, dismiss, onNodeContextMenu, onPaneContextMenu };
}
