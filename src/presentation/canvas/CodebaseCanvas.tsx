import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Background, Controls, ReactFlow, type NodeTypes } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findMethod } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { ClassNode } from './ClassNode';
import { parseClassDropId, parseMethodDragId } from './dndIds';
import { FileNode } from './FileNode';
import { layoutCodebase } from './layoutCodebase';
import { MethodChipView } from './MethodChip';

const nodeTypes: NodeTypes = { fileNode: FileNode, classNode: ClassNode };

/** クリックでの選択とドラッグを区別するため、5px以上動かしたときだけドラッグを開始する。 */
const POINTER_ACTIVATION = { activationConstraint: { distance: 5 } };

function DraggingMethodOverlay({ methodId }: Readonly<{ methodId: string | null }>) {
  const method = useGameStore((state) => (methodId === null ? undefined : findMethod(state.codebase, methodId)));
  const limit = useGameStore((state) => state.stage.limits.method);
  // React Flowのビューポートには transform: scale() がかかっているため、
  // オーバーレイはbody直下へポータルしてズーム倍率の影響を受けないようにする。
  return createPortal(
    <DragOverlay>
      {method === undefined ? null : <MethodChipView method={method} overLimit={methodLines(method) > limit} />}
    </DragOverlay>,
    document.body,
  );
}

export function CodebaseCanvas() {
  const codebase = useGameStore((state) => state.codebase);
  const moveMethod = useGameStore((state) => state.moveMethod);
  const nodes = useMemo(() => layoutCodebase(codebase), [codebase]);
  const [draggingMethodId, setDraggingMethodId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION), useSensor(KeyboardSensor));

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingMethodId(parseMethodDragId(event.active.id));
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingMethodId(null);
    const methodId = parseMethodDragId(event.active.id);
    const classId = event.over === null ? null : parseClassDropId(event.over.id);
    if (methodId !== null && classId !== null) moveMethod(methodId, classId);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingMethodId(null);
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        minZoom={0.3}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <DraggingMethodOverlay methodId={draggingMethodId} />
    </DndContext>
  );
}
