import { useEffect, type RefObject } from 'react';

/** 外側クリックで閉じる。Esc は、フォーカスが中にあるときだけ閉じてボタンにフォーカスを戻す。 */
export function usePopoverDismiss(open: boolean, containerRef: RefObject<HTMLElement | null>, buttonRef: RefObject<HTMLButtonElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !containerRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, containerRef, buttonRef, close]);
}

/** 開いたら、パネルの中で最初の有効なボタンへ(無ければパネル自体へ)フォーカスする。 */
export function useFocusOnOpen(open: boolean, panelRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? panel)?.focus();
  }, [open, panelRef]);
}
