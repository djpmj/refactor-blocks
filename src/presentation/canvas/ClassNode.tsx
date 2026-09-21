import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { findClass } from '../../domain/codebase/Codebase';
import { classLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { classDragId, classDropId } from './dndIds';
import type { ClassFlowNode } from './layoutCodebase';
import { MethodChip } from './MethodChip';

export function ClassNode({ data }: Readonly<NodeProps<ClassFlowNode>>) {
  const codeClass = useGameStore((state) => findClass(state.codebase, data.classId));
  const limit = useGameStore((state) => state.stage.limits.class);
  const { setNodeRef, isOver } = useDroppable({ id: classDropId(data.classId) });
  // ヘッダーを掴むとクラスごと別ファイルへドラッグできる
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: classDragId(data.classId) });
  if (codeClass === undefined) return null;
  const lines = classLines(codeClass);
  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'class-node class-node--drop-target' : 'class-node'}
      data-testid={`class-${codeClass.name}`}
    >
      {/* 依存の矢印の接続点。つなぐ操作はさせないので見た目には出さない。 */}
      <Handle type="target" position={Position.Left} className="class-node__handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="class-node__handle" isConnectable={false} />
      <div
        ref={setDragRef}
        className="class-node__header nodrag nopan"
        style={{ opacity: isDragging ? 0.3 : 1 }}
        data-testid={`class-header-${codeClass.name}`}
        aria-label={`${codeClass.name} を別ファイルへ移動`}
        {...attributes}
        {...listeners}
      >
        <span className="class-node__name">{codeClass.name}</span>
        <span className={lines > limit ? 'line-badge line-badge--over' : 'line-badge'}>{lines}行</span>
      </div>
      <div className="class-node__methods">
        {codeClass.methods.length === 0 ? (
          <div className="class-node__empty">ここにメソッドをドロップ</div>
        ) : (
          codeClass.methods.map((method) => <MethodChip key={method.id} method={method} />)
        )}
      </div>
    </div>
  );
}
