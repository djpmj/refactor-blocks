export type Point = { readonly x: number; readonly y: number };
export type Size = { readonly width: number; readonly height: number };

/** 右クリックメニューが右端・下端からはみ出さないよう、表示位置をビューポート内へ収める。 */
export function clampMenuPosition(point: Point, menuSize: Size, viewport: Size): Point {
  const x = Math.max(0, Math.min(point.x, viewport.width - menuSize.width));
  const y = Math.max(0, Math.min(point.y, viewport.height - menuSize.height));
  return { x, y };
}
