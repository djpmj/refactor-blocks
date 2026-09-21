import type { NodeProps } from '@xyflow/react';
import { fileLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import type { FileFlowNode } from './layoutCodebase';

export function FileNode({ data }: Readonly<NodeProps<FileFlowNode>>) {
  const file = useGameStore((state) => state.codebase.files.find((candidate) => candidate.id === data.fileId));
  const limit = useGameStore((state) => state.stage.limits.file);
  if (file === undefined) return null;
  const lines = fileLines(file);
  return (
    <div className="file-node" data-testid={`file-${file.id}`}>
      <div className="file-node__header">
        <span className="file-node__icon" aria-hidden>
          📄
        </span>
        <span className="file-node__path">{file.path}</span>
        <span className={lines > limit ? 'line-badge line-badge--over' : 'line-badge'}>{lines}行</span>
      </div>
    </div>
  );
}
