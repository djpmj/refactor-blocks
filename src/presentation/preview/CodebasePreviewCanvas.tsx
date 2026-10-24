import { Background, Controls, ReactFlow, useReactFlow, useStore, type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { useEffect, useMemo } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { autoViewport, type Rect } from '../canvas/autoViewport';
import { dependencyEdges, fileRectsFromNodes, inheritanceEdges, layoutCodebase } from '../canvas/layoutCodebase';
import { InheritanceMarker } from '../canvas/InheritanceMarker';
import { OffsetEdge } from '../canvas/OffsetEdge';
import { TopRouteEdge } from '../canvas/TopRouteEdge';
import { WarningEdge } from '../canvas/WarningEdge';
import { WarningEdgeStateProvider } from '../canvas/WarningEdgeState';
import { CodebasePreviewProvider, type MethodHighlight } from './CodebasePreviewContext';
import { PreviewClassNode } from './PreviewClassNode';
import { PreviewFileNode } from './PreviewFileNode';

const nodeTypes: NodeTypes = { fileNode: PreviewFileNode, classNode: PreviewClassNode };
const edgeTypes: EdgeTypes = { topRoute: TopRouteEdge, offset: OffsetEdge, warning: WarningEdge };
const MIN_ZOOM = 0.3;
const FIT_OPTIONS = { minZoom: MIN_ZOOM, maxZoom: 2, padding: 0.1 };

/**
 * fitView と同じ計算で求まる縮尺を onFitZoom で知らせ、zoom が渡されたらその縮尺に固定して中身を中央に置く(収まらない分は左上から見せる)。
 * 枠の大きさが変わったら求め直す。どちらも渡されなければ何もしない。
 */
function ZoomController({ bounds, zoom, onFitZoom }: Readonly<{ bounds: Rect; zoom?: number; onFitZoom?: (zoom: number) => void }>) {
  const { setViewport } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  useEffect(() => {
    if (width === 0 || height === 0) return;
    const size = { width, height };
    onFitZoom?.(autoViewport(bounds, size, FIT_OPTIONS).zoom);
    if (zoom !== undefined) void setViewport(autoViewport(bounds, size, { minZoom: zoom, maxZoom: zoom, padding: FIT_OPTIONS.padding }));
  }, [bounds, width, height, zoom, onFitZoom, setViewport]);
  return null;
}

/** ファイルの箱をすべて含む範囲。ノードの計測を待たず、レイアウトで決めた大きさから求める。 */
function filesBounds(nodes: Parameters<typeof fileRectsFromNodes>[0]): Rect {
  const rects = [...fileRectsFromNodes(nodes).values()];
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  return { x: left, y: top, width: Math.max(...rects.map((rect) => rect.x + rect.width)) - left, height: Math.max(...rects.map((rect) => rect.y + rect.height)) - top };
}

type CodebasePreviewCanvasProps = {
  readonly codebase: Codebase;
  readonly methodLimit: number;
  /** false にすると、ホイールでズームせずページのスクロールに任せる(スクロールするページの中に置くとき用)。 */
  readonly wheelZoom?: boolean;
  /** 渡すと、fitView の縮尺ではなくこの縮尺で表示する(設計くらべで2つのプレビューをそろえるとき用)。 */
  readonly maxZoom?: number;
  /** fitView で求まる縮尺を知らせる。枠の大きさが変わるたびに呼ばれる。 */
  readonly onFitZoom?: (zoom: number) => void;
  readonly selectedMethodId?: string | null;
  readonly onSelectMethod?: (methodId: string) => void;
  readonly highlights?: ReadonlyMap<string, MethodHighlight>;
};

/** コードベースを読み取り専用で描くキャンバス。「解答例の図」と設計くらべで使う。 */
export function CodebasePreviewCanvas({ codebase, methodLimit, wheelZoom = true, maxZoom, onFitZoom, selectedMethodId, onSelectMethod, highlights }: CodebasePreviewCanvasProps) {
  const nodes = useMemo(() => layoutCodebase(codebase), [codebase]);
  const edges = useMemo(() => {
    const fileRects = fileRectsFromNodes(nodes);
    return [...dependencyEdges(codebase, fileRects), ...inheritanceEdges(codebase, fileRects)];
  }, [codebase, nodes]);
  const bounds = useMemo(() => filesBounds(nodes), [nodes]);
  return (
    <CodebasePreviewProvider value={{ codebase, methodLimit, selectedMethodId, onSelectMethod, highlights }}>
      <WarningEdgeStateProvider>
        <ReactFlow colorMode="system"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView={maxZoom === undefined}
          minZoom={MIN_ZOOM}
          zoomOnScroll={wheelZoom}
          preventScrolling={wheelZoom}
        >
          <ZoomController bounds={bounds} zoom={maxZoom} onFitZoom={onFitZoom} />
          <InheritanceMarker />
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </WarningEdgeStateProvider>
    </CodebasePreviewProvider>
  );
}
