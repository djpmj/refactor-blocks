import { useDroppable } from '@dnd-kit/core';
import type { NodeProps } from '@xyflow/react';
import { findClass } from '../../domain/codebase/Codebase';
import { classLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { classDropId } from './dndIds';
import type { ClassFlowNode } from './layoutCodebase';
import { MethodChip } from './MethodChip';

export function ClassNode({ data }: Readonly<NodeProps<ClassFlowNode>>) {
  const codeClass = useGameStore((state) => findClass(state.codebase, data.classId));
  const limit = useGameStore((state) => state.stage.limits.class);
  const { setNodeRef, isOver } = useDroppable({ id: classDropId(data.classId) });
  if (codeClass === undefined) return null;
  const lines = classLines(codeClass);
  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'class-node class-node--drop-target' : 'class-node'}
      data-testid={`class-${codeClass.name}`}
    >
      <div className="class-node__header">
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
