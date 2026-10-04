import { useEffect } from 'react';
import { isEditingText } from '../useUndoRedoShortcut';

export function useGuideShortcut(enabled: boolean, open: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isQuestionMark = event.key === '?' || (event.code === 'Slash' && event.shiftKey);
      if (!isQuestionMark || event.repeat || isEditingText(event.target)) return;
      event.preventDefault();
      setOpen(!open);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, open, setOpen]);
}
