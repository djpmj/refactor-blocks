export function clampSidebarWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(width, max));
}
