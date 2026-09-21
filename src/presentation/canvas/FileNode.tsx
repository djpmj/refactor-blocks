import { useDroppable } from '@dnd-kit/core';
import type { NodeProps } from '@xyflow/react';
import { fileLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { fileDropId } from './dndIds';
import type { FileFlowNode } from './layoutCodebase';
import { useShowDetails } from './semanticZoom';

export function FileNode({ data }: Readonly<NodeProps<FileFlowNode>>) {
  const file = useGameStore((state) => state.codebase.files.find((candidate) => candidate.id === data.fileId));
  const limit = useGameStore((state) => state.stage.limits.file);
  const { setNodeRef, isOver } = useDroppable({ id: fileDropId(data.fileId) });
  const showDetails = useShowDetails();
  if (file === undefined) return null;
  const lines = fileLines(file);
  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'file-node file-node--drop-target' : 'file-node'}
      data-testid={`file-${file.path}`}
    >
      <div className="file-node__header">
        <span className="file-node__icon" aria-hidden>
          📄
        </span>
        <span className="file-node__path">{file.path}</span>
        {showDetails ? (
          <span className={lines > limit ? 'line-badge line-badge--over' : 'line-badge'}>{lines}行</span>
        ) : null}
      </div>
      {file.classes.length === 0 ? <div className="file-node__empty">ここにクラスをドロップ</div> : null}
    </div>
  );
}
