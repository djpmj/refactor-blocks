import { Background, Controls, ReactFlow, type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { useMemo } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { dependencyEdges, fileRectsFromNodes, inheritanceEdges, layoutCodebase } from '../canvas/layoutCodebase';
import { InheritanceMarker } from '../canvas/InheritanceMarker';
import { OffsetEdge } from '../canvas/OffsetEdge';
import { TopRouteEdge } from '../canvas/TopRouteEdge';
import { WarningEdge } from '../canvas/WarningEdge';
import { WarningEdgeStateProvider } from '../canvas/WarningEdgeState';
import { CodebasePreviewProvider } from './CodebasePreviewContext';
import { PreviewClassNode } from './PreviewClassNode';
import { PreviewFileNode } from './PreviewFileNode';

const nodeTypes: NodeTypes = { fileNode: PreviewFileNode, classNode: PreviewClassNode };
const edgeTypes: EdgeTypes = { topRoute: TopRouteEdge, offset: OffsetEdge, warning: WarningEdge };

type CodebasePreviewCanvasProps = {
  readonly codebase: Codebase;
  readonly methodLimit: number;
  /** false にすると、ホイールでズームせずページのスクロールに任せる(スクロールするページの中に置くとき用)。 */
  readonly wheelZoom?: boolean;
  readonly selectedMethodId?: string | null;
  readonly onSelectMethod?: (methodId: string) => void;
};

/** コードベースを読み取り専用で描くキャンバス。「解答例の図」と設計くらべで使う。 */
export function CodebasePreviewCanvas({ codebase, methodLimit, wheelZoom = true, selectedMethodId, onSelectMethod }: CodebasePreviewCanvasProps) {
  const nodes = useMemo(() => layoutCodebase(codebase), [codebase]);
  const edges = useMemo(() => {
    const fileRects = fileRectsFromNodes(nodes);
    return [...dependencyEdges(codebase, fileRects), ...inheritanceEdges(codebase, fileRects)];
  }, [codebase, nodes]);
  return (
    <CodebasePreviewProvider value={{ codebase, methodLimit, selectedMethodId, onSelectMethod }}>
      <WarningEdgeStateProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          minZoom={0.3}
          zoomOnScroll={wheelZoom}
          preventScrolling={wheelZoom}
        >
          <InheritanceMarker />
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </WarningEdgeStateProvider>
    </CodebasePreviewProvider>
  );
}
