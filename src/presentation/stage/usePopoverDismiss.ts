import { useEffect, type RefObject } from 'react';

/** ツールバーで同時に開けるのは1つだけ。開いているパネルを1つ持ち、どの開き方でも「それを開く」にする。 */
export type ToolbarPanel = 'reference' | 'hint' | 'rumor' | 'history' | null;

/** 自分が開いているときだけ閉じる(別のパネルが開いていたら触らない)。 */
export function togglePanel(current: ToolbarPanel, name: Exclude<ToolbarPanel, null>, open: boolean): ToolbarPanel {
  if (open) return name;
  return current === name ? null : current;
}

/** 外側クリックで閉じる。Esc は、フォーカスがどこにあっても(ほかが処理していなければ)閉じてボタンにフォーカスを戻す。 */
export function usePopoverDismiss(open: boolean, containerRef: RefObject<HTMLElement | null>, buttonRef: RefObject<HTMLButtonElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // Tab で外へ出たあとでも閉じる。ダイアログなど、すでに Esc を処理した(preventDefault した)ものは横取りしない
      if (event.key !== 'Escape' || event.defaultPrevented) return;
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
