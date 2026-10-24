/** 設計A・Bのプレビューをそろえる縮尺。小さい方に合わせるが、読めなくなる floor 未満にはしない。 */
export function sharedZoom(zoomA: number, zoomB: number, floor: number): number {
  return Math.max(Math.min(zoomA, zoomB), floor);
}
