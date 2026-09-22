import { Background, Controls, ReactFlow, type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { useEffect, useMemo, useRef } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { dependencyEdges, inheritanceEdges, layoutCodebase } from '../canvas/layoutCodebase';
import { TopRouteEdge } from '../canvas/TopRouteEdge';
import { CodebasePreviewProvider } from './CodebasePreviewContext';
import { PreviewClassNode } from './PreviewClassNode';
import { PreviewFileNode } from './PreviewFileNode';

const nodeTypes: NodeTypes = { fileNode: PreviewFileNode, classNode: PreviewClassNode };
const edgeTypes: EdgeTypes = { topRoute: TopRouteEdge };
const TITLE_ID = 'codebase-preview-title';

type CodebasePreviewDialogProps = {
  readonly title: string;
  /** null なら表示しない。ネイティブの dialog に Esc・背景の上乗せ・フォーカストラップを任せる。 */
  readonly codebase: Codebase | null;
  readonly methodLimit: number;
  readonly onClose: () => void;
};

export function CodebasePreviewDialog({ title, codebase, methodLimit, onClose }: CodebasePreviewDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, [codebase]);
  const edges = useMemo(() => (codebase === null ? [] : [...dependencyEdges(codebase), ...inheritanceEdges(codebase)]), [codebase]);
  if (codebase === null) return null;
  return (
    <dialog ref={ref} className="codebase-preview" aria-labelledby={TITLE_ID} onClose={onClose} data-testid="codebase-preview">
      <div className="codebase-preview__header">
        <h2 className="codebase-preview__title" id={TITLE_ID}>
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>
      <div className="codebase-preview__canvas">
        <CodebasePreviewProvider value={{ codebase, methodLimit }}>
          <ReactFlow nodes={layoutCodebase(codebase)} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable={false} fitView minZoom={0.3}>
            <Background gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </CodebasePreviewProvider>
      </div>
    </dialog>
  );
}
