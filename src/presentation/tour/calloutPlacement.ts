export type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
export type Size = { readonly width: number; readonly height: number };
export type CalloutPosition = { readonly left: number; readonly top: number };

const GAP = 12;
const EDGE = 16;

/** 2つの矩形が重なる面積。接しているだけ・離れているときは0 */
export function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

function clamp(value: number, max: number): number {
  return Math.max(EDGE, Math.min(value, max));
}

function candidatesAround(r: Rect, size: Size): CalloutPosition[] {
  return [
    { left: r.left, top: r.bottom + GAP },
    { left: r.left, top: r.top - GAP - size.height },
    { left: r.right + GAP, top: r.top },
    { left: r.left - GAP - size.width, top: r.top },
  ];
}

/** 吹き出しを置く位置。anchor(照らしている矩形)と avoid(読ませたい要素)の重なりの合計が最小の候補を返す */
export function placeCallout(input: {
  readonly anchor: Rect;
  readonly avoid: readonly Rect[];
  readonly size: Size;
  readonly viewport: Size;
}): CalloutPosition {
  const { anchor, avoid, size, viewport } = input;
  const rects = [anchor, ...avoid];
  // ponytail: 候補は矩形の上下左右だけ。どこに置いても重なる画面では最小の重なりで妥協する、狭い画面で問題が出たら候補を増やす
  const candidates = rects.flatMap((r) => candidatesAround(r, size)).map((c) => ({
    left: clamp(c.left, viewport.width - size.width - EDGE),
    top: clamp(c.top, viewport.height - size.height - EDGE),
  }));
  const cost = (c: CalloutPosition): number => {
    const box = { left: c.left, top: c.top, right: c.left + size.width, bottom: c.top + size.height };
    return rects.reduce((sum, r) => sum + overlapArea(box, r), 0);
  };
  let best = candidates[0];
  let bestCost = cost(best);
  for (const c of candidates) {
    const value = cost(c);
    if (value < bestCost) {
      best = c;
      bestCost = value;
    }
  }
  return best;
}
