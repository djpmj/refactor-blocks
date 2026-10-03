import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampSidebarWidth } from './clampSidebarWidth';

const SIDEBAR_DEFAULT_WIDTH = 360;
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 640;
const KEYBOARD_STEP = 16;

type DragStart = { readonly pointerId: number; readonly x: number; readonly width: number };

export function useResizableSidebarWidth() {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const dragStart = useRef<DragStart | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerId: event.pointerId, x: event.clientX, width };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (start === null || event.pointerId !== start.pointerId) return;

    const delta = start.x - event.clientX;
    setWidth(clampSidebarWidth(start.width + delta, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current?.pointerId !== event.pointerId) return;

    dragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const delta = event.key === 'ArrowLeft' ? KEYBOARD_STEP : -KEYBOARD_STEP;
    setWidth((currentWidth) => clampSidebarWidth(currentWidth + delta, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH));
    event.preventDefault();
  }

  return {
    width,
    handleProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-valuenow': width,
      'aria-valuemin': SIDEBAR_MIN_WIDTH,
      'aria-valuemax': SIDEBAR_MAX_WIDTH,
      'aria-label': 'サイドバーの幅を変更',
      tabIndex: 0,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onKeyDown: handleKeyDown,
    },
  };
}
