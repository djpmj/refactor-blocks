import { useCallback, useState, type MouseEvent } from 'react';
import type { CodebaseFlowNode } from './layoutCodebase';

export type ContextMenuTarget = {
  readonly x: number;
  readonly y: number;
  /** 右クリックしたファイル(クラス・メソッドならそれを含むファイル)。キャンバスの余白ならnull。 */
  readonly fileId: string | null;
  /** 右クリックしたクラス(メソッドならそれを持つクラス)。ファイル・余白ならnull。 */
  readonly classId: string | null;
};

/** 右クリックメニューの開閉。React Flowの onNodeContextMenu / onPaneContextMenu に渡すハンドラーを返す。 */
export function useCanvasContextMenu() {
  const [target, setTarget] = useState<ContextMenuTarget | null>(null);
  const close = useCallback(() => {
    setTarget(null);
  }, []);
  const open = (event: MouseEvent | globalThis.MouseEvent, fileId: string | null, classId: string | null) => {
    event.preventDefault();
    setTarget({ x: event.clientX, y: event.clientY, fileId, classId });
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
  return { target, close, onNodeContextMenu, onPaneContextMenu };
}
