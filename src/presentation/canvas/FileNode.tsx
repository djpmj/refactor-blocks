import { useDndContext, useDroppable } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { fileLines } from '../../domain/codebase/lineCount';
import { fileDeductionReasons, fileDeductions, fileSeverity, type FileDeductionReason, type FileSeverity } from '../../domain/scoring/fileScores';
import { violationTargets } from '../../domain/scoring/violationTargets';
import { useGameStore } from '../store/useGameStore';
import { fileDropId } from './dndIds';
import type { FileFlowNode } from './layoutCodebase';
import { useShowDetails } from './semanticZoom';
import { useDropTargetClassNames } from './DropTargetsContext';
import { useResolvedCelebration } from './useResolvedCelebration';
import { FileMarkPopover } from './FileMarkPopover';
import { TRAY_FILE_ID } from '../../domain/blank/tray';

/** 修正が必要なファイルの印。色だけに頼らずアイコンとラベルでも伝える。ズームで詳細を隠していても出す。 */
function FileMark({ severity, points, reasons, codebase, fileId }: Readonly<{
  severity: FileSeverity;
  points: number;
  reasons: readonly FileDeductionReason[];
  codebase: Codebase;
  fileId: string;
}>) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const { active } = useDndContext();
  useEffect(() => {
    if (active !== null) window.setTimeout(() => setOpen(false), 0);
  }, [active]);
  if (severity === 'ok') return null;
  const label = severity === 'danger' ? `危険: -${points}点` : `修正が必要: -${points}点`;
  const tooltipId = `file-mark-reasons-${fileId}`;
  return (
    <>
      <span ref={setAnchor} className="file-mark nodrag nopan" role="img" tabIndex={0} aria-label={label} aria-describedby={open && active === null ? tooltipId : undefined} data-testid="file-mark" data-severity={severity}
        onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
        {severity === 'danger' ? '⛔' : '⚠️'}
      </span>
      {open && active === null && anchor !== null ? <FileMarkPopover anchor={anchor} tooltipId={tooltipId} severity={severity} points={points} reasons={reasons} codebase={codebase} /> : null}
    </>
  );
}

export function FileNode({ data }: Readonly<NodeProps<FileFlowNode>>) {
  const resolved = useResolvedCelebration('fileIds', data.fileId);
  const codebase = useGameStore((state) => state.codebase);
  const stage = useGameStore((state) => state.stage);
  const file = codebase.files.find((candidate) => candidate.id === data.fileId);
  const limit = useGameStore((state) => state.stage.limits.file);
  const isTray = data.fileId === TRAY_FILE_ID;
  const points = useGameStore((state) => isTray ? 0 : fileDeductions(state.codebase, state.stage).get(data.fileId) ?? 0);
  const reasons = isTray ? [] : fileDeductionReasons(codebase, stage).get(data.fileId) ?? [];
  const flagged = useGameStore((state) => {
    const rule = state.focusedRule;
    return rule !== null
      ? violationTargets(state.codebase, state.stage)[rule].fileIds.includes(data.fileId)
      : state.hintTarget?.fileIds.includes(data.fileId) ?? (state.previewRule !== null && violationTargets(state.codebase, state.stage)[state.previewRule].fileIds.includes(data.fileId));
  });
  const { setNodeRef, isOver } = useDroppable({ id: fileDropId(data.fileId) });
  const dropTargetClasses = useDropTargetClassNames('file', data.fileId);
  const showDetails = useShowDetails();
  if (file === undefined) return null;
  const lines = fileLines(file, codebase);
  return (
    <div
      ref={setNodeRef}
      className={['file-node', isOver ? 'file-node--drop-target' : '', dropTargetClasses, flagged ? 'file-node--flagged' : '', resolved ? 'file-node--resolved' : ''].filter(Boolean).join(' ')}
      data-testid={`file-${file.path}`}
    >
      <div className="file-node__header">
        <span className="file-node__icon" aria-hidden>
          📄
        </span>
        <FileMark severity={fileSeverity(points)} points={points} reasons={reasons} codebase={codebase} fileId={data.fileId} />
        {showDetails ? (
          <span className={lines > limit ? 'line-badge line-badge--over' : 'line-badge'}>{lines}行</span>
        ) : null}
      </div>
      {file.classes.length === 0 && !isTray ? <div className="file-node__empty">ここにクラスをドロップ</div> : null}
    </div>
  );
}
