import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { isShortcutBlocked } from '../useUndoRedoShortcut';

export function useGuideShortcut(enabled: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isQuestionMark = event.key === '?' || (event.code === 'Slash' && event.shiftKey);
      if (!isQuestionMark || event.repeat || isShortcutBlocked(event.target, document)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, setOpen]);
}
