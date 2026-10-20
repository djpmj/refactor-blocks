export type Rect = { x: number; y: number; width: number; height: number };
export type PanMovement = { dx: number; dy: number };

function axisMovement(box: { start: number; length: number }, viewport: { start: number; length: number }, margin: number): number {
  if (box.start >= viewport.start && box.start + box.length <= viewport.start + viewport.length) return 0;
  if (box.length > viewport.length - margin * 2) return viewport.start + margin - box.start;
  if (box.start < viewport.start) return viewport.start + margin - box.start;
  return -(box.start + box.length - viewport.start - viewport.length + margin);
}

export function panToReveal(box: Rect, viewport: Rect, margin: number): PanMovement {
  return {
    dx: axisMovement({ start: box.x, length: box.width }, { start: viewport.x, length: viewport.width }, margin),
    dy: axisMovement({ start: box.y, length: box.height }, { start: viewport.y, length: viewport.height }, margin),
  };
}
