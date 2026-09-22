import type { NodeProps } from '@xyflow/react';
import { fileLines } from '../../domain/codebase/lineCount';
import type { FileFlowNode } from '../canvas/layoutCodebase';
import { useCodebasePreview } from './CodebasePreviewContext';

/** FileNode の読み取り専用版。ドロップ・行数超過の印など、編集に関わる見た目は持たない。 */
export function PreviewFileNode({ data }: Readonly<NodeProps<FileFlowNode>>) {
  const { codebase } = useCodebasePreview();
  const file = codebase.files.find((candidate) => candidate.id === data.fileId);
  if (file === undefined) return null;
  return (
    <div className="file-node" data-testid={`preview-file-${file.path}`}>
      <div className="file-node__header">
        <span className="file-node__icon" aria-hidden>
          📄
        </span>
        <span className="file-node__path">{file.path}</span>
        <span className="line-badge">{fileLines(file)}行</span>
      </div>
      {file.classes.length === 0 ? <div className="file-node__empty">クラスなし</div> : null}
    </div>
  );
}
