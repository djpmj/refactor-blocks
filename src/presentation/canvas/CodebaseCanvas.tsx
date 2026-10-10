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
import { Background, Controls, ReactFlow, useReactFlow, type EdgeTypes, type NodeChange, type NodeTypes, type ReactFlowInstance, type XYPosition } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findClass, findClassOfMethod, findField, findFileOfClass, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { violationTargets } from '../../domain/scoring/violationTargets';
import { useGameStore } from '../store/useGameStore';
import { CanvasContextMenu } from './CanvasContextMenu';
import { ClassNode } from './ClassNode';
import { parseClassDragId, parseClassDropId, parseFieldDragId, parseFileDropId, parseMethodDragId } from './dndIds';
import { FieldChipView } from './FieldChip';
import { FileNode } from './FileNode';
import { InheritanceMarker } from './InheritanceMarker';
import { dependencyEdges, fileRectsFromNodes, inheritanceEdges, layoutCodebase, NEW_CLASS_FILE_SIZE, type CodebaseFlowNode } from './layoutCodebase';
import { MethodChipView } from './MethodChip';
import { OffsetEdge } from './OffsetEdge';
import { TopRouteEdge } from './TopRouteEdge';
import { useCanvasContextMenu } from './useCanvasContextMenu';
import { fileTopLeftAtDrop } from './dropPosition';

const nodeTypes: NodeTypes = { fileNode: FileNode, classNode: ClassNode };
const edgeTypes: EdgeTypes = { topRoute: TopRouteEdge, offset: OffsetEdge };

/** クリックでの選択とドラッグを区別するため、5px以上動かしたときだけドラッグを開始する。 */
const POINTER_ACTIVATION = { activationConstraint: { distance: 5 } };

function DraggingOverlay({ activeId }: Readonly<{ activeId: UniqueIdentifier | null }>) {
  const methodId = activeId === null ? null : parseMethodDragId(activeId);
  const classId = activeId === null ? null : parseClassDragId(activeId);
  const fieldId = activeId === null ? null : parseFieldDragId(activeId);
  const method = useGameStore((state) => (methodId === null ? undefined : findMethod(state.codebase, methodId)));
  const codeClass = useGameStore((state) => (classId === null ? undefined : findClass(state.codebase, classId)));
  const field = useGameStore((state) => (fieldId === null ? undefined : findField(state.codebase, fieldId)));
  const limit = useGameStore((state) => state.stage.limits.method);
  // React Flowのビューポートには transform: scale() がかかっているため、
  // オーバーレイはbody直下へポータルしてズーム倍率の影響を受けないようにする。
  return createPortal(
    <DragOverlay>
      {method === undefined ? null : <MethodChipView method={method} overLimit={methodLines(method) > limit} />}
      {codeClass === undefined ? null : <div className="class-drag-preview">{codeClass.name}</div>}
      {field === undefined ? null : <FieldChipView field={field} />}
    </DragOverlay>,
    document.body,
  );
}

/** クラスのドロップ先のファイル。クラスの上に落としたときは、そのクラスがあるファイルに移す。 */
function dropTargetFileId(codebase: Codebase, overId: UniqueIdentifier): string | undefined {
  const classId = parseClassDropId(overId);
  return classId === null ? (parseFileDropId(overId) ?? undefined) : findFileOfClass(codebase, classId)?.id;
}

function moveMethodToDropTarget(
  methodId: string,
  targetId: UniqueIdentifier,
  moveMethod: (methodId: string, classId: string) => void,
  moveIntoFile: (methodId: string, fileId: string) => void,
) {
  const targetClassId = parseClassDropId(targetId);
  if (targetClassId !== null) {
    moveMethod(methodId, targetClassId);
    return;
  }
  const targetFileId = parseFileDropId(targetId);
  if (targetFileId !== null) moveIntoFile(methodId, targetFileId);
}

/** ステージを切り替えたときやファイルが増えたとき、画面外に出ないよう全体が収まるように表示し直す。 */
function FitViewOnLayoutChange({ stageId, fileCount }: Readonly<{ stageId: string; fileCount: number }>) {
  const { fitView } = useReactFlow<CodebaseFlowNode>();
  useEffect(() => {
    void fitView();
  }, [stageId, fileCount, fitView]);
  return null;
}

function FitViewForRule({ codebase, nodes }: Readonly<{ codebase: Codebase; nodes: CodebaseFlowNode[] }>) {
  const { fitView } = useReactFlow<CodebaseFlowNode>();
  const stage = useGameStore((state) => state.stage);
  const focusedRule = useGameStore((state) => state.focusedRule);
  const focusRule = useGameStore((state) => state.focusRule);
  useEffect(() => {
    if (focusedRule === null) return;
    const target = violationTargets(codebase, stage)[focusedRule];
    const classIds = new Set(target.classIds);
    for (const methodId of target.methodIds) {
      const owner = findClassOfMethod(codebase, methodId);
      if (owner !== undefined) classIds.add(owner.id);
    }
    const nodeIds = new Set([...target.fileIds, ...classIds]);
    const targetNodes = nodes.filter((node) => nodeIds.has(node.id));
    if (targetNodes.length === 0) {
      focusRule(null);
      return;
    }
    void fitView({ nodes: targetNodes, padding: 0.25, duration: 350, maxZoom: 0.9 });
  }, [codebase, fitView, focusRule, focusedRule, nodes, stage]);
  return null;
}

type Measured = { width: number; height: number };
type FlowOverrides = { stageId: string; positions: Record<string, XYPosition>; measured: Record<string, Measured>; dropPositionFileIds: readonly string[] };

function isMousePosition(event: Event): event is MouseEvent {
  return 'clientX' in event && typeof event.clientX === 'number'
    && 'clientY' in event && typeof event.clientY === 'number';
}

/** ファイルだけドラッグ可能にし(クラスはdnd-kitで動かす)、動かした位置と計測済みの大きさを反映する。 */
function arrangeNodes(nodes: CodebaseFlowNode[], overrides: FlowOverrides): CodebaseFlowNode[] {
  return nodes.map((node) => {
    const measured = overrides.measured[node.id];
    if (node.type === 'classNode') return { ...node, draggable: false, measured };
    return { ...node, position: overrides.positions[node.id] ?? node.position, measured };
  });
}

function useCanvasEdges(codebase: Codebase, nodes: CodebaseFlowNode[]) {
  return useMemo(() => {
    const fileRects = fileRectsFromNodes(nodes);
    return [...dependencyEdges(codebase, fileRects), ...inheritanceEdges(codebase, fileRects)];
  }, [codebase, nodes]);
}

function fitFileCount(codebase: Codebase, overrides: FlowOverrides): number {
  const fileIds = new Set(codebase.files.map((file) => file.id));
  const manuallyPlacedFileCount = overrides.dropPositionFileIds.filter((fileId) => fileIds.has(fileId)).length;
  return codebase.files.length - manuallyPlacedFileCount;
}

/**
 * ファイルの箱はドラッグで動かせる(依存の矢印と重なるとき用)。動かした位置はステージごとに覚える。
 * ノードはstoreから毎回作り直すので、React Flowが計測した大きさもここで持つ(反映しないとノードが非表示のままになる)。
 */
function useFlowOverrides(stageId: string) {
  const [state, setState] = useState<FlowOverrides>({ stageId, positions: {}, measured: {}, dropPositionFileIds: [] });
  const overrides = state.stageId === stageId ? state : { stageId, positions: {}, measured: state.measured, dropPositionFileIds: [] };
  const handleNodesChange = (changes: NodeChange[]) => {
    const next = { stageId, positions: { ...overrides.positions }, measured: { ...overrides.measured }, dropPositionFileIds: overrides.dropPositionFileIds };
    for (const change of changes) {
      if (change.type === 'position' && change.position !== undefined) next.positions[change.id] = change.position;
      if (change.type === 'dimensions' && change.dimensions !== undefined) next.measured[change.id] = change.dimensions;
    }
    setState(next);
  };
  const setPosition = (fileId: string, position: XYPosition) => {
    setState((current) => ({
      ...current,
      stageId,
      positions: { ...overrides.positions, [fileId]: position },
      dropPositionFileIds: [...new Set([...overrides.dropPositionFileIds, fileId])],
    }));
  };
  return { overrides, handleNodesChange, setPosition };
}

/** ドロップ先に応じた移動を行う。ファイルの枠外に落としたら、新しいファイル(メソッドなら新しいクラスも)を自動で作って置く。 */
function useDropHandler(codebase: Codebase, onEnd: () => void, flow: ReactFlowInstance<CodebaseFlowNode> | null, setPosition: (fileId: string, position: XYPosition) => void) {
  const moveMethod = useGameStore((state) => state.moveMethod);
  const moveClass = useGameStore((state) => state.moveClass);
  const moveClassToNewFile = useGameStore((state) => state.moveClassToNewFile);
  const moveMethodToNewClass = useGameStore((state) => state.moveMethodToNewClass);
  const moveMethodToNewClassInFile = useGameStore((state) => state.moveMethodToNewClassInFile);
  const moveField = useGameStore((state) => state.moveField);
  const handleEmptyDrop = (event: DragEndEvent, methodId: string | null, classId: string | null) => {
    const pointer = event.activatorEvent;
    let fileId: string | null = null;
    if (methodId !== null) fileId = moveMethodToNewClass(methodId);
    else if (classId !== null) fileId = moveClassToNewFile(classId);
    if (fileId === null || flow === null || !isMousePosition(pointer)) return;
    const drop = flow.screenToFlowPosition({ x: pointer.clientX + event.delta.x, y: pointer.clientY + event.delta.y });
    setPosition(fileId, fileTopLeftAtDrop(drop, NEW_CLASS_FILE_SIZE));
  };
  return (event: DragEndEvent) => {
    onEnd();
    const methodId = parseMethodDragId(event.active.id);
    const classId = parseClassDragId(event.active.id);
    const fieldId = parseFieldDragId(event.active.id);
    if (event.over === null) {
      handleEmptyDrop(event, methodId, classId);
      // ponytail: フィールドを余白へ落として新しいクラスを作る操作(moveFieldToNewClass)はスコープ外。何もしない
      return;
    }
    const targetClassId = parseClassDropId(event.over.id);
    if (methodId !== null) moveMethodToDropTarget(methodId, event.over.id, moveMethod, moveMethodToNewClassInFile);
    if (fieldId !== null && targetClassId !== null) moveField(fieldId, targetClassId);
    const targetFileId = dropTargetFileId(codebase, event.over.id);
    if (classId !== null && targetFileId !== undefined) moveClass(classId, targetFileId);
  };
}

/** active が false の間(設計くらべで隠れている間)は、開いていた右クリックメニューを閉じる。 */
export function CodebaseCanvas({ active }: Readonly<{ active: boolean }>) {
  const codebase = useGameStore((state) => state.codebase);
  const selectMethod = useGameStore((state) => state.selectMethod);
  const stageId = useGameStore((state) => state.stage.id);
  const { overrides, handleNodesChange, setPosition } = useFlowOverrides(stageId);
  const nodes = useMemo(() => arrangeNodes(layoutCodebase(codebase), overrides), [codebase, overrides]);
  const visibleFileCount = fitFileCount(codebase, overrides);
  const edges = useCanvasEdges(codebase, nodes);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<CodebaseFlowNode> | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION), useSensor(KeyboardSensor));
  const contextMenu = useCanvasContextMenu();
  const closeContextMenu = contextMenu.close;
  // メニューは document.body へのポータルなので、画面を隠しただけでは消えない(隠れたコードベースを操作できてしまう)
  useEffect(() => {
    if (!active) closeContextMenu();
  }, [active, closeContextMenu]);


  const handleDragEnd = useDropHandler(codebase, () => {
    setActiveId(null);
  }, flow, setPosition);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event: DragStartEvent) => setActiveId(event.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange} onInit={setFlow}
        nodesConnectable={false}
        fitView
        minZoom={0.3}
        onNodeContextMenu={contextMenu.onNodeContextMenu}
        onPaneContextMenu={contextMenu.onPaneContextMenu}
        onPaneClick={() => selectMethod(null)}
      >
        <InheritanceMarker />
        <Background gap={24} />
        <Controls showInteractive={false} />
        <FitViewOnLayoutChange stageId={stageId} fileCount={visibleFileCount} />
        <FitViewForRule codebase={codebase} nodes={nodes} />
      </ReactFlow>
      <DraggingOverlay activeId={activeId} />
      {contextMenu.target === null ? null : (
        // 開き直すたびに入力途中の状態を捨てるため、位置でkeyを変える
        <CanvasContextMenu
          key={`${String(contextMenu.target.x)},${String(contextMenu.target.y)}`}
          target={contextMenu.target}
          onClose={contextMenu.close}
          onDismiss={contextMenu.dismiss}
        />
      )}
    </DndContext>
  );
}
