import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { isEditingText } from '../useUndoRedoShortcut';

export function useGuideShortcut(enabled: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isQuestionMark = event.key === '?' || (event.code === 'Slash' && event.shiftKey);
      if (!isQuestionMark || event.repeat || isEditingText(event.target)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, setOpen]);
}
