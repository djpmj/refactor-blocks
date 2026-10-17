export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type Viewport = { readonly x: number; readonly y: number; readonly zoom: number };

/**
 * 図(bounds)をキャンバス(size)に自動で合わせるときの表示。padding は fitView と同じく図の大きさに対する余白の割合。
 * 全体が収まる倍率が minZoom 以上なら、全体を中央に収める(上限 maxZoom)。
 * 未満なら倍率を minZoom にして、図の左上がキャンバスの短辺の padding 倍の位置に来るようにする。
 */
export function autoViewport(
  bounds: Rect,
  size: { readonly width: number; readonly height: number },
  options: Readonly<{ minZoom: number; maxZoom: number; padding: number }>,
): Viewport {
  const margin = 1 + options.padding * 2;
  const fitZoom = Math.min(size.width / (bounds.width * margin), size.height / (bounds.height * margin));
  if (fitZoom < options.minZoom) {
    const offset = Math.min(size.width, size.height) * options.padding;
    return { zoom: options.minZoom, x: offset - bounds.x * options.minZoom, y: offset - bounds.y * options.minZoom };
  }
  const zoom = Math.min(fitZoom, options.maxZoom);
  return {
    zoom,
    x: (size.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (size.height - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
}
