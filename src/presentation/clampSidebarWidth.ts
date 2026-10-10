export function clampSidebarWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(width, max));
}

// eslint-disable-next-line max-params -- Issue #98 specifies this pure function's six explicit inputs.
export function widthAfterDrag(side: 'left' | 'right', startWidth: number, startX: number, currentX: number, min: number, max: number): number {
  const direction = side === 'left' ? 1 : -1;
  return clampSidebarWidth(startWidth + direction * (currentX - startX), min, max);
}
