import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampSidebarWidth, widthAfterDrag } from './clampSidebarWidth';

const KEYBOARD_STEP = 16;

type DragStart = { readonly pointerId: number; readonly x: number; readonly width: number };
type WidthBounds = Readonly<{ min: number; max: number }>;
type SidebarWidthOptions = Readonly<{
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  ariaLabel?: string;
}>;

function effectiveBounds(side: 'left' | 'right', minWidth: number, maxWidth: number): WidthBounds {
  if (side === 'right' || window.innerWidth > 700) return { min: minWidth, max: maxWidth };

  const max = Math.min(maxWidth, window.innerWidth * 0.4);
  return { min: Math.min(120, max), max };
}

export function useResizableSidebarWidth({ side, defaultWidth, minWidth, maxWidth, ariaLabel = 'サイドバーの幅を変更' }: SidebarWidthOptions) {
  const [width, setWidth] = useState(() => {
    const bounds = effectiveBounds(side, minWidth, maxWidth);
    return clampSidebarWidth(defaultWidth, bounds.min, bounds.max);
  });
  const dragStart = useRef<DragStart | null>(null);
  const bounds = effectiveBounds(side, minWidth, maxWidth);

  useEffect(() => {
    function updateWidthForViewport() {
      const nextBounds = effectiveBounds(side, minWidth, maxWidth);
      setWidth((currentWidth) => clampSidebarWidth(currentWidth, nextBounds.min, nextBounds.max));
    }

    window.addEventListener('resize', updateWidthForViewport);
    return () => window.removeEventListener('resize', updateWidthForViewport);
  }, [side, minWidth, maxWidth]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerId: event.pointerId, x: event.clientX, width };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (start === null || event.pointerId !== start.pointerId) return;

    setWidth(widthAfterDrag(side, start.width, start.x, event.clientX, bounds.min, bounds.max));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current?.pointerId !== event.pointerId) return;

    dragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const expands = (side === 'left' && event.key === 'ArrowRight') || (side === 'right' && event.key === 'ArrowLeft');
    const delta = expands ? KEYBOARD_STEP : -KEYBOARD_STEP;
    setWidth((currentWidth) => clampSidebarWidth(currentWidth + delta, bounds.min, bounds.max));
    event.preventDefault();
  }

  return {
    width,
    handleProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-valuenow': width,
      'aria-valuemin': bounds.min,
      'aria-valuemax': bounds.max,
      'aria-label': ariaLabel,
      tabIndex: 0,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onKeyDown: handleKeyDown,
    },
  };
}
