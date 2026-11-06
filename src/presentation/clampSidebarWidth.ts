export function clampSidebarWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(width, max));
}

// eslint-disable-next-line max-params -- Issue #98 specifies this pure function's six explicit inputs.
export function widthAfterDrag(side: 'left' | 'right', startWidth: number, startX: number, currentX: number, min: number, max: number): number {
  const direction = side === 'left' ? 1 : -1;
  return clampSidebarWidth(startWidth + direction * (currentX - startX), min, max);
}

export type WidthBounds = Readonly<{ min: number; max: number }>;

const DRAWER_MAX_VIEWPORT = 700;
const WIDE_MIN_VIEWPORT = 1024;
const NARROW_DESKTOP_RATIO = 0.3;

/** 画面幅に応じたサイドバーの幅の範囲。701〜1023pxでは左右とも画面幅の30%まで(キャンバスの幅を残すため)。 */
export function sidebarWidthBounds(side: 'left' | 'right', viewportWidth: number, minWidth: number, maxWidth: number): WidthBounds {
  if (viewportWidth >= WIDE_MIN_VIEWPORT) return { min: minWidth, max: maxWidth };
  if (viewportWidth > DRAWER_MAX_VIEWPORT) {
    const max = Math.min(maxWidth, Math.floor(viewportWidth * NARROW_DESKTOP_RATIO));
    return { min: Math.min(minWidth, max), max };
  }
  if (side === 'right') return { min: minWidth, max: maxWidth };

  const max = Math.min(maxWidth, viewportWidth * 0.4);
  return { min: Math.min(120, max), max };
}
