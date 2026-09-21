import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';

/** 入力欄・選択欄では、ブラウザ標準の文字の取り消しを優先する。 */
function isEditingText(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Ctrl(Macは Cmd)+Z で1手戻し、Ctrl+Y または Ctrl+Shift+Z で1手進める。 */
export function useUndoRedoShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isEditingText(event.target)) return;
      const key = event.key.toLowerCase();
      const { undo, redo } = useGameStore.getState();
      if (key === 'z' && !event.shiftKey) undo();
      else if (key === 'y' || (key === 'z' && event.shiftKey)) redo();
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
