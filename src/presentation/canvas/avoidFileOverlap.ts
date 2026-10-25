import type { XYPosition } from '@xyflow/react';
import type { FileRect } from './layoutCodebase';

/**
 * 新しいファイル(position に size で置く)が既存のファイル(existing)と重なるとき、重ならない位置までずらして返す。
 * ずらす向きは右。重なる箱の右端 + gap まで動かし、まだ重なる箱があれば繰り返す。重ならないなら position をそのまま返す。
 */
// ponytail: 右へずらすだけなので、右に長く並んでいると遠くへ飛ぶ。ファイルが十数個になって気になったら、下へ折り返すかグリッドで探す
export function avoidFileOverlap(
  position: XYPosition,
  size: { readonly width: number; readonly height: number },
  existing: readonly FileRect[],
  gap: number,
): XYPosition {
  let x = position.x;
  for (;;) {
    const left = x;
    const hit = existing.find((rect) => left < rect.x + rect.width && rect.x < left + size.width
      && position.y < rect.y + rect.height && rect.y < position.y + size.height);
    if (hit === undefined) return { x, y: position.y };
    x = hit.x + hit.width + gap;
  }
}
