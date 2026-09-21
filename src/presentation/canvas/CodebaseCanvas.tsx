import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { Background, Controls, ReactFlow, useReactFlow, type NodeTypes } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findClass, findFileOfClass, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { CanvasToolbar } from './CanvasToolbar';
import { ClassNode } from './ClassNode';
import { parseClassDragId, parseClassDropId, parseFileDropId, parseMethodDragId } from './dndIds';
import { FileNode } from './FileNode';
import { dependencyEdges, layoutCodebase } from './layoutCodebase';
import { MethodChipView } from './MethodChip';

const nodeTypes: NodeTypes = { fileNode: FileNode, classNode: ClassNode };

/** クリックでの選択とドラッグを区別するため、5px以上動かしたときだけドラッグを開始する。 */
const POINTER_ACTIVATION = { activationConstraint: { distance: 5 } };

function DraggingOverlay({ activeId }: Readonly<{ activeId: UniqueIdentifier | null }>) {
  const methodId = activeId === null ? null : parseMethodDragId(activeId);
  const classId = activeId === null ? null : parseClassDragId(activeId);
  const method = useGameStore((state) => (methodId === null ? undefined : findMethod(state.codebase, methodId)));
  const codeClass = useGameStore((state) => (classId === null ? undefined : findClass(state.codebase, classId)));
  const limit = useGameStore((state) => state.stage.limits.method);
  // React Flowのビューポートには transform: scale() がかかっているため、
  // オーバーレイはbody直下へポータルしてズーム倍率の影響を受けないようにする。
  return createPortal(
    <DragOverlay>
      {method === undefined ? null : <MethodChipView method={method} overLimit={methodLines(method) > limit} />}
      {codeClass === undefined ? null : <div className="class-drag-preview">{codeClass.name}</div>}
    </DragOverlay>,
    document.body,
  );
}

/** クラスのドロップ先のファイル。クラスの上に落としたときは、そのクラスがあるファイルに移す。 */
function dropTargetFileId(codebase: Codebase, overId: UniqueIdentifier): string | undefined {
  const classId = parseClassDropId(overId);
  return classId === null ? (parseFileDropId(overId) ?? undefined) : findFileOfClass(codebase, classId)?.id;
}

/** ステージを切り替えたときやファイルが増えたとき、画面外に出ないよう全体が収まるように表示し直す。 */
function FitViewOnLayoutChange({ stageId, fileCount }: Readonly<{ stageId: string; fileCount: number }>) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    void fitView();
  }, [stageId, fileCount, fitView]);
  return null;
}

export function CodebaseCanvas() {
  const codebase = useGameStore((state) => state.codebase);
  const stageId = useGameStore((state) => state.stage.id);
  const moveMethod = useGameStore((state) => state.moveMethod);
  const moveClass = useGameStore((state) => state.moveClass);
  const nodes = useMemo(() => layoutCodebase(codebase), [codebase]);
  const edges = useMemo(() => dependencyEdges(codebase), [codebase]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION), useSensor(KeyboardSensor));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (event.over === null) return;
    const methodId = parseMethodDragId(event.active.id);
    const targetClassId = parseClassDropId(event.over.id);
    if (methodId !== null && targetClassId !== null) moveMethod(methodId, targetClassId);
    const classId = parseClassDragId(event.active.id);
    const targetFileId = dropTargetFileId(codebase, event.over.id);
    if (classId !== null && targetFileId !== undefined) moveClass(classId, targetFileId);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        minZoom={0.3}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <CanvasToolbar />
        <FitViewOnLayoutChange stageId={stageId} fileCount={codebase.files.length} />
      </ReactFlow>
      <DraggingOverlay activeId={activeId} />
    </DndContext>
  );
}
