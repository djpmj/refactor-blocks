import { useDroppable } from '@dnd-kit/core';
import type { NodeProps } from '@xyflow/react';
import { fileLines } from '../../domain/codebase/lineCount';
import { fileDeductions, fileSeverity, type FileSeverity } from '../../domain/scoring/fileScores';
import { violationTargets } from '../../domain/scoring/violationTargets';
import { useGameStore } from '../store/useGameStore';
import { fileDropId } from './dndIds';
import type { FileFlowNode } from './layoutCodebase';
import { useShowDetails } from './semanticZoom';
import { useDropTargetClassNames } from './DropTargetsContext';

/** 修正が必要なファイルの印。色だけに頼らずアイコンとラベルでも伝える。ズームで詳細を隠していても出す。 */
function FileMark({ severity, points }: Readonly<{ severity: FileSeverity; points: number }>) {
  if (severity === 'ok') return null;
  const label = severity === 'danger' ? `危険: -${points}点` : `修正が必要: -${points}点`;
  return (
    <span className="file-mark" role="img" aria-label={label} title={label} data-testid="file-mark" data-severity={severity}>
      {severity === 'danger' ? '⛔' : '⚠️'}
    </span>
  );
}

export function FileNode({ data }: Readonly<NodeProps<FileFlowNode>>) {
  const file = useGameStore((state) => state.codebase.files.find((candidate) => candidate.id === data.fileId));
  const limit = useGameStore((state) => state.stage.limits.file);
  const points = useGameStore((state) => fileDeductions(state.codebase, state.stage).get(data.fileId) ?? 0);
  const flagged = useGameStore((state) => {
    const rule = state.focusedRule;
    return rule !== null
      ? violationTargets(state.codebase, state.stage)[rule].fileIds.includes(data.fileId)
      : state.hintTarget?.fileIds.includes(data.fileId) ?? false;
  });
  const { setNodeRef, isOver } = useDroppable({ id: fileDropId(data.fileId) });
  const dropTargetClasses = useDropTargetClassNames('file', data.fileId);
  const showDetails = useShowDetails();
  if (file === undefined) return null;
  const lines = fileLines(file);
  return (
    <div
      ref={setNodeRef}
      className={['file-node', isOver ? 'file-node--drop-target' : '', dropTargetClasses, flagged ? 'file-node--flagged' : ''].filter(Boolean).join(' ')}
      data-testid={`file-${file.path}`}
    >
      <div className="file-node__header">
        <span className="file-node__icon" aria-hidden>
          📄
        </span>
        <FileMark severity={fileSeverity(points)} points={points} />
        {showDetails ? (
          <span className={lines > limit ? 'line-badge line-badge--over' : 'line-badge'}>{lines}行</span>
        ) : null}
      </div>
      {file.classes.length === 0 ? <div className="file-node__empty">ここにクラスをドロップ</div> : null}
    </div>
  );
}
