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
import { Background, Controls, Panel, ReactFlow, useNodesInitialized, useReactFlow, ViewportPortal, type EdgeTypes, type NodeChange, type NodeTypes, type ReactFlowInstance, type XYPosition } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { DropTargetsContext, type DropTargetsState } from './DropTargetsContext';
import { createPortal } from 'react-dom';
import { findClass, findClassOfMethod, findField, findFileOfClass, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { violationTargets } from '../../domain/scoring/violationTargets';
import { visibilityViolationDependencies } from '../../domain/scoring/visibility';
import { useGameStore } from '../store/useGameStore';
import { CanvasContextMenu } from './CanvasContextMenu';
import { ClassNode } from './ClassNode';
import { createAnnouncements, SCREEN_READER_INSTRUCTIONS } from './dndAnnouncements';
import { parseClassDragId, parseClassDropId, parseFieldDragId, parseFileDropId, parseMethodDragId } from './dndIds';
import { FieldChipView } from './FieldChip';
import { FileNode } from './FileNode';
import { InheritanceMarker } from './InheritanceMarker';
import { dependencyEdges, fileRectsFromNodes, inheritanceEdges, laneBands, layoutCodebase, NEW_CLASS_FILE_SIZE, type CodebaseFlowNode } from './layoutCodebase';
import type { Stage, StageLayer } from '../../domain/stage/Stage';
import { MethodChipView } from './MethodChip';
import { OffsetEdge } from './OffsetEdge';
import { TopRouteEdge } from './TopRouteEdge';
import { WarningEdge } from './WarningEdge';
import { WarningEdgeStateProvider } from './WarningEdgeState';
import { useCanvasContextMenu } from './useCanvasContextMenu';
import { fileTopLeftAtDrop } from './dropPosition';
import { GhostAnimation } from './GhostAnimation';
import type { Edge } from '@xyflow/react';
import { dropTargetIds, type Dragging } from './dropTargets';
import { placeFiles } from './keepFilePositions';
import { autoViewport } from './autoViewport';
import { DETAIL_ZOOM, useShowDetails } from './semanticZoom';
import { shouldRefit, type AutoFitState } from './autoFit';
import { OpeningFixBanner } from './OpeningFixBanner';
import { panToReveal } from './panToReveal';

const CANVAS_MIN_ZOOM = 0.3;
const nodeTypes: NodeTypes = { fileNode: FileNode, classNode: ClassNode };
const edgeTypes: EdgeTypes = { topRoute: TopRouteEdge, offset: OffsetEdge, warning: WarningEdge };

/** クリックでの選択とドラッグを区別するため、5px以上動かしたときだけドラッグを開始する。 */
const POINTER_ACTIVATION = { activationConstraint: { distance: 5 } };

function DraggingOverlay({ activeId }: Readonly<{ activeId: UniqueIdentifier | null }>) {
  const methodId = activeId === null ? null : parseMethodDragId(activeId);
  const classId = activeId === null ? null : parseClassDragId(activeId);
  const fieldId = activeId === null ? null : parseFieldDragId(activeId);
  const method = useGameStore((state) => (methodId === null ? undefined : findMethod(state.codebase, methodId)));
  const codebase = useGameStore((state) => state.codebase);
  const codeClass = useGameStore((state) => (classId === null ? undefined : findClass(state.codebase, classId)));
  const field = useGameStore((state) => (fieldId === null ? undefined : findField(state.codebase, fieldId)));
  const limit = useGameStore((state) => state.stage.limits.method);
  // React Flowのビューポートには transform: scale() がかかっているため、
  // オーバーレイはbody直下へポータルしてズーム倍率の影響を受けないようにする。
  return createPortal(
    <DragOverlay className="drag-overlay">
      {method === undefined ? null : <MethodChipView method={method} overLimit={methodLines(method, codebase) > limit} />}
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

/** 切り替えで隠れている画面(リファクタリング・白紙設計)のキャンバスは除き、いま見えているものを返す。 */
function visibleCanvas(): Element | null {
  return document.querySelector('.app__view:not([hidden]) .app__canvas');
}

function canvasSize(): { width: number; height: number } | null {
  const canvas = visibleCanvas();
  if (!(canvas instanceof HTMLElement)) return null;
  const { width, height } = canvas.getBoundingClientRect();
  return width > 0 && height > 0 ? { width, height } : null;
}

/** 図全体を自動で合わせる。メソッドが隠れる倍率(DETAIL_ZOOM)未満にはせず、収まらない分は左上から見せる。 */
function useAutoViewportFit() {
  const { getNodes, getNodesBounds, setViewport } = useReactFlow<CodebaseFlowNode>();
  const measured = () => getNodes().every((node) => node.measured?.width !== undefined && node.measured.height !== undefined);
  // 変更依頼の実装中は倍率に関わらずメソッドを出し、部品置き場まで全体を見渡せる必要があるので、床を設けない
  const implementing = useGameStore((state) => state.changeSession !== null);
  /** 合わせたら true。ノードが増えた直後は useNodesInitialized が古いままのことがあるので、計測が済んでいなければ何もせず false。 */
  return (): boolean => {
    const size = canvasSize();
    const nodes = getNodes();
    if (size === null || nodes.length === 0 || !measured()) return false;
    void setViewport(autoViewport(getNodesBounds(nodes), size, { minZoom: implementing ? CANVAS_MIN_ZOOM : DETAIL_ZOOM, maxZoom: 2, padding: 0.1 }));
    return true;
  };
}

/** ステージを切り替えたときやファイルが増えたとき、画面外に出ないよう全体を自動で合わせ直す。 */
function FitViewOnLayoutChange({ stageId, fileCount, layoutResetCount, arrangeVersion, autoFitStateRef }: Readonly<{ stageId: string; fileCount: number; layoutResetCount: number; arrangeVersion: number; autoFitStateRef: RefObject<AutoFitState> }>) {
  const fit = useAutoViewportFit();
  const nodesInitialized = useNodesInitialized();
  const lastLayoutKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!nodesInitialized) return;
    const layoutKey = `${stageId}:${fileCount}:${layoutResetCount}:${arrangeVersion}`;
    if (lastLayoutKeyRef.current === layoutKey) return;
    if (!fit()) return;
    lastLayoutKeyRef.current = layoutKey;
    autoFitStateRef.current = { userMoved: false, lastSize: canvasSize() };
    // fit は毎回作り直されるが、中身は最新のノードとキャンバスの大きさだけを読むため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangeVersion, autoFitStateRef, fileCount, layoutResetCount, nodesInitialized, stageId]);
  return null;
}

/**
 * キャンバスの大きさが変わったら、プレイヤーが動かしていない図を合わせ直す。
 * 待ち時間を置くと、パネルの出現などの直後に遅れて表示が動いてプレイヤーの操作に割り込むので、変化のたびにすぐ合わせる。
 * 合わせられなかった(ノードの計測前・ドラッグ中)ときは、その状態が解けたときにもう一度確かめる。
 */
function FitViewOnResize({ autoFitStateRef, dragInteractionActive }: Readonly<{ autoFitStateRef: RefObject<AutoFitState>; dragInteractionActive: boolean }>) {
  const fit = useAutoViewportFit();
  const nodesInitialized = useNodesInitialized();
  const ready = nodesInitialized && !dragInteractionActive;
  const latest = useRef({ fit, ready });
  useEffect(() => {
    latest.current = { fit, ready };
  });
  const refitIfNeeded = useCallback((size: { width: number; height: number } | null) => {
    if (size === null || !latest.current.ready || !shouldRefit(autoFitStateRef.current, size)) return;
    autoFitStateRef.current = { userMoved: false, lastSize: size };
    latest.current.fit();
  }, [autoFitStateRef]);
  useEffect(() => {
    const canvas = visibleCanvas();
    if (!(canvas instanceof HTMLElement)) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      refitIfNeeded(width > 0 && height > 0 ? { width, height } : null);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [refitIfNeeded]);
  useEffect(() => {
    if (ready) refitIfNeeded(canvasSize());
  }, [ready, refitIfNeeded]);
  return null;
}

/** 縮小してメソッドを隠している間、そのことと戻し方を知らせる。変更依頼の実装中は常に中身を出すので出さない。 */
function DetailZoomNotice({ onZoom }: Readonly<{ onZoom: () => void }>) {
  const { zoomTo } = useReactFlow<CodebaseFlowNode>();
  const showDetails = useShowDetails();
  if (showDetails) return null;
  return (
    <Panel position="top-left">
      <div className="detail-zoom-notice" data-testid="detail-zoom-notice" role="status">
        <span>縮小中はメソッドを隠しています</span>
        <button type="button" className="nodrag nopan" onClick={() => { onZoom(); void zoomTo(DETAIL_ZOOM); }}>中身が見える大きさにする</button>
      </div>
    </Panel>
  );
}

function hasFileId(codebase: Codebase, id: string): boolean {
  return codebase.files.some((file) => file.id === id);
}

function hasClassId(codebase: Codebase, id: string): boolean {
  return codebase.files.some((file) => file.classes.some((codeClass) => codeClass.id === id));
}

function hasMethodId(codebase: Codebase, id: string): boolean {
  return codebase.files.some((file) => file.classes.some((codeClass) => codeClass.methods.some((method) => method.id === id)));
}

function targetIdsExist(codebase: Codebase, target: { readonly fileIds: readonly string[]; readonly classIds: readonly string[]; readonly methodIds: readonly string[] }): boolean {
  return target.fileIds.every((id) => hasFileId(codebase, id))
    && target.classIds.every((id) => hasClassId(codebase, id))
    && target.methodIds.every((id) => hasMethodId(codebase, id));
}

function FitViewForRule({ codebase, nodes }: Readonly<{ codebase: Codebase; nodes: CodebaseFlowNode[] }>) {
  const { fitView } = useReactFlow<CodebaseFlowNode>();
  const stage = useGameStore((state) => state.stage);
  const focusedRule = useGameStore((state) => state.focusedRule);
  const hintTarget = useGameStore((state) => state.hintTarget);
  const focusRule = useGameStore((state) => state.focusRule);
  const focusHint = useGameStore((state) => state.focusHint);
  useEffect(() => {
    const target = focusedRule === null ? hintTarget : violationTargets(codebase, stage)[focusedRule];
    if (target === null) return;
    if (!targetIdsExist(codebase, target)) {
      if (focusedRule === null) focusHint(null);
      else focusRule(null);
      return;
    }
    const classIds = new Set(target.classIds);
    for (const methodId of target.methodIds) {
      const owner = findClassOfMethod(codebase, methodId);
      if (owner !== undefined) classIds.add(owner.id);
    }
    const nodeIds = new Set([...target.fileIds, ...classIds]);
    const targetNodes = nodes.filter((node) => nodeIds.has(node.id));
    if (targetNodes.length === 0) {
      if (focusedRule === null) focusHint(null);
      else focusRule(null);
      return;
    }
    void fitView({ nodes: targetNodes, padding: 0.25, duration: 350, maxZoom: 0.9 });
  }, [codebase, fitView, focusHint, focusRule, focusedRule, hintTarget, nodes, stage]);
  return null;
}

type Measured = { width: number; height: number };
type FlowOverrides = { stageId: string; layoutResetCount: number; positions: Record<string, XYPosition>; measured: Record<string, Measured>; dropPositionFileIds: readonly string[] };

const REVEAL_MARGIN = 24;

function revealDuration(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
}

/** 新規ファイルだけ、計測後に箱全体が見えるようズームを保ってパンする。 */
function RevealDroppedFile({ fileId }: Readonly<{ fileId: string | null }>) {
  const { getNode, getViewport, setViewport } = useReactFlow<CodebaseFlowNode>();
  const handledFileId = useRef<string | null>(null);
  useEffect(() => {
    if (fileId === null || handledFileId.current === fileId) return;
    let frame = 0;
    let timeout = 0;
    const reveal = () => {
      const node = getNode(fileId);
      const canvas = document.querySelector('.app__canvas:not([hidden])');
      const pane = canvas?.querySelector('.react-flow__pane');
      if (node === undefined || node.measured?.width === undefined || node.measured.height === undefined || !(pane instanceof HTMLElement)) {
        frame = requestAnimationFrame(reveal);
        return;
      }
      timeout = window.setTimeout(() => {
        const currentNode = getNode(fileId);
        if (currentNode === undefined || currentNode.measured?.width === undefined || currentNode.measured.height === undefined) return;
        const bounds = pane.getBoundingClientRect();
        const viewport = getViewport();
        const box = {
          x: bounds.left + currentNode.position.x * viewport.zoom + viewport.x,
          y: bounds.top + currentNode.position.y * viewport.zoom + viewport.y,
          width: currentNode.measured.width * viewport.zoom,
          height: currentNode.measured.height * viewport.zoom,
        };
        const movement = panToReveal(box, bounds, REVEAL_MARGIN);
        handledFileId.current = fileId;
        if (movement.dx !== 0 || movement.dy !== 0) {
          void setViewport({ x: viewport.x + movement.dx, y: viewport.y + movement.dy, zoom: viewport.zoom }, { duration: revealDuration() });
        }
      }, 50);
    };
    frame = requestAnimationFrame(reveal);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
    // React Flow API は安定している。対象IDと計測完了時だけ実行する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);
  return null;
}

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

function useCanvasEdges(codebase: Codebase, nodes: CodebaseFlowNode[], rules: Pick<Stage, 'visibilityEnforced' | 'layers'>) {
  const { visibilityEnforced, layers } = rules;
  return useMemo(() => {
    const fileRects = fileRectsFromNodes(nodes);
    const violations = visibilityViolationDependencies(codebase, visibilityEnforced);
    return [...dependencyEdges(codebase, fileRects, violations, layers), ...inheritanceEdges(codebase, fileRects, layers)];
  }, [codebase, nodes, visibilityEnforced, layers]);
}

/** 層を扱うステージで、層ごとの段の背景に薄い帯と層の名前を描く。帯はクリック・ドラッグの邪魔をしない。 */
function LaneBands({ codebase, layers }: Readonly<{ codebase: Codebase; layers: readonly StageLayer[] | undefined }>) {
  const bands = useMemo(() => laneBands(codebase, layers), [codebase, layers]);
  return (
    <ViewportPortal>
      {bands.map((band) => (
        <div key={band.name} className="lane-band" data-testid="lane-band"
          style={{ transform: `translate(${String(band.x)}px, ${String(band.y)}px)`, width: band.width, height: band.height }}>
          <span className="lane-band__name">{band.name}</span>
        </div>
      ))}
    </ViewportPortal>
  );
}

function fitFileCount(codebase: Codebase, overrides: FlowOverrides): number {
  const fileIds = new Set(codebase.files.map((file) => file.id));
  const manuallyPlacedFileCount = overrides.dropPositionFileIds.filter((fileId) => fileIds.has(fileId)).length;
  return codebase.files.length - manuallyPlacedFileCount;
}

function usePlacedCanvasNodes(codebase: Codebase, layers: readonly StageLayer[] | undefined, overrides: FlowOverrides, rememberPositions: (nodes: readonly CodebaseFlowNode[]) => void): CodebaseFlowNode[] {
  const layoutNodes = useMemo(() => layoutCodebase(codebase, layers), [codebase, layers]);
  const positionedNodes = useMemo(() => {
    const currentNodes = arrangeNodes(layoutNodes, overrides);
    const allRects = fileRectsFromNodes(currentNodes);
    const existingRects = new Map([...allRects].filter(([id]) => Object.hasOwn(overrides.positions, id)));
    const dropPositions = new Map(overrides.dropPositionFileIds.flatMap((id) => (
      Object.hasOwn(overrides.positions, id) ? [[id, overrides.positions[id]] as const] : []
    )));
    return placeFiles(layoutNodes, new Map(Object.entries(overrides.positions)), existingRects, dropPositions);
  }, [layoutNodes, overrides]);
  const nodes = useMemo(() => arrangeNodes(positionedNodes, overrides), [positionedNodes, overrides]);
  useEffect(() => rememberPositions(nodes), [nodes, rememberPositions]);
  return nodes;
}

function useDismissContextMenuWhenInactive(active: boolean, close: () => void): void {
  useEffect(() => {
    if (!active) close();
  }, [active, close]);
}

type CanvasFlowProps = {
  readonly nodes: CodebaseFlowNode[];
  readonly edges: Edge[];
  readonly onNodesChange: (changes: NodeChange[]) => void;
  readonly setFlow: Dispatch<SetStateAction<ReactFlowInstance<CodebaseFlowNode> | null>>;
  readonly contextMenu: ReturnType<typeof useCanvasContextMenu>;
  readonly selectMethod: (methodId: string | null) => void;
  readonly stageId: string;
  readonly visibleFileCount: number;
  readonly codebase: Codebase;
  readonly layers: readonly StageLayer[] | undefined;
  readonly autoFitStateRef: RefObject<AutoFitState>;
  readonly onMoveStart: (event: MouseEvent | TouchEvent | null) => void;
  readonly onManualFit: () => void;
  readonly onControlZoom: () => void;
  readonly dragInteractionActive: boolean;
  readonly revealFileId: string | null;
};

function CanvasFlow({ nodes, edges, onNodesChange, setFlow, contextMenu, selectMethod, stageId, visibleFileCount, codebase, layers, layoutResetCount, arrangeVersion, arrange, autoFitStateRef, onMoveStart, onManualFit, onControlZoom, dragInteractionActive, revealFileId }: CanvasFlowProps & { readonly layoutResetCount: number; readonly arrangeVersion: number; readonly arrange: () => void }) {
  return (
    <WarningEdgeStateProvider>
      <ReactFlow colorMode="system"
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onInit={setFlow} nodesConnectable={false} minZoom={CANVAS_MIN_ZOOM}
        onMoveStart={onMoveStart}
        onNodeContextMenu={contextMenu.onNodeContextMenu} onPaneContextMenu={contextMenu.onPaneContextMenu}
        onPaneClick={() => selectMethod(null)}
      >
        <LaneBands codebase={codebase} layers={layers} />
        <InheritanceMarker /><Background gap={24} /><Controls showInteractive={false} onFitView={onManualFit} onZoomIn={onControlZoom} onZoomOut={onControlZoom} />
        <Panel position="top-right">
          <button type="button" className="nodrag nopan" data-testid="canvas-arrange" aria-label="依存の向きに沿って並べ直す" onClick={arrange}>整列</button>
        </Panel>
        <Panel position="top-center"><OpeningFixBanner /></Panel>
        <DetailZoomNotice onZoom={onControlZoom} />
        <GhostAnimation nodes={nodes} />
        <FitViewOnLayoutChange stageId={stageId} fileCount={visibleFileCount} layoutResetCount={layoutResetCount} arrangeVersion={arrangeVersion} autoFitStateRef={autoFitStateRef} />
        <FitViewOnResize autoFitStateRef={autoFitStateRef} dragInteractionActive={dragInteractionActive} />
        <RevealDroppedFile fileId={revealFileId} />
        <FitViewForRule codebase={codebase} nodes={nodes} />
      </ReactFlow>
    </WarningEdgeStateProvider>
  );
}

/**
 * ファイルの箱はドラッグで動かせる(依存の矢印と重なるとき用)。動かした位置はステージごとに覚える。
 * ノードはstoreから毎回作り直すので、React Flowが計測した大きさもここで持つ(反映しないとノードが非表示のままになる)。
 */
function useFlowOverrides(stageId: string, layoutResetCount: number) {
  const [state, setState] = useState<FlowOverrides>({ stageId, layoutResetCount, positions: {}, measured: {}, dropPositionFileIds: [] });
  const overrides = state.stageId === stageId && state.layoutResetCount === layoutResetCount
    ? state : { stageId, layoutResetCount, positions: {}, measured: state.measured, dropPositionFileIds: [] };
  const handleNodesChange = (changes: NodeChange[]) => {
    const next = { stageId, layoutResetCount, positions: { ...overrides.positions }, measured: { ...overrides.measured }, dropPositionFileIds: overrides.dropPositionFileIds };
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
      layoutResetCount,
      positions: { ...overrides.positions, [fileId]: position },
      dropPositionFileIds: [...new Set([...overrides.dropPositionFileIds, fileId])],
    }));
  };
  const rememberPositions = (nodes: readonly CodebaseFlowNode[]) => {
    const additions = nodes.filter((node) => node.type === 'fileNode' && !Object.hasOwn(overrides.positions, node.id));
    if (additions.length === 0) return;
    setState((current) => ({
      ...current,
      stageId,
      layoutResetCount,
      positions: { ...current.positions, ...Object.fromEntries(additions.map((node) => [node.id, node.position])) },
    }));
  };
  const [arrangeVersion, setArrangeVersion] = useState(0);
  const arrange = () => {
    setState({ stageId, layoutResetCount, positions: {}, measured: overrides.measured, dropPositionFileIds: [] });
    setArrangeVersion((current) => current + 1);
  };
  return { overrides, handleNodesChange, setPosition, rememberPositions, arrange, arrangeVersion };
}

/** ドロップ先に応じた移動を行う。ファイルの枠外に落としたら、新しいファイル(メソッドなら新しいクラスも)を自動で作って置く。 */
function useDropHandler(codebase: Codebase, onEnd: () => void, flow: ReactFlowInstance<CodebaseFlowNode> | null, callbacks: { setPosition: (fileId: string, position: XYPosition) => void; setRevealFileId: (fileId: string) => void }) {
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
    callbacks.setPosition(fileId, fileTopLeftAtDrop(drop, NEW_CLASS_FILE_SIZE));
    callbacks.setRevealFileId(fileId);
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

function useAutoFitActions() {
  const autoFitStateRef = useRef<AutoFitState>({ userMoved: false, lastSize: null });
  const onMoveStart = (event: MouseEvent | TouchEvent | null) => {
    if (event !== null) autoFitStateRef.current = { ...autoFitStateRef.current, userMoved: true };
  };
  const onManualFit = () => {
    autoFitStateRef.current = { userMoved: false, lastSize: canvasSize() };
  };
  const onControlZoom = () => {
    autoFitStateRef.current = { ...autoFitStateRef.current, userMoved: true };
  };
  return { autoFitStateRef, onMoveStart, onManualFit, onControlZoom };
}

function useDragInteraction() {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const start = (event: DragStartEvent) => setActiveId(event.active.id);
  const finish = () => setActiveId(null);
  return { activeId, start, finish };
}

/** active が false の間(設計くらべで隠れている間)は、開いていた右クリックメニューを閉じる。 */
export function CodebaseCanvas({ active }: Readonly<{ active: boolean }>) {
  const codebase = useGameStore((state) => state.codebase);
  const selectMethod = useGameStore((state) => state.selectMethod);
  const stage = useGameStore((state) => state.stage);
  const { id: stageId, layers } = stage;
  const layoutResetCount = useGameStore((state) => state.layoutResetCount);
  const { overrides, handleNodesChange, setPosition, rememberPositions, arrange, arrangeVersion } = useFlowOverrides(stageId, layoutResetCount);
  const nodes = usePlacedCanvasNodes(codebase, layers, overrides, rememberPositions);
  const visibleFileCount = fitFileCount(codebase, overrides);
  const edges = useCanvasEdges(codebase, nodes, stage);
  const { activeId, start: handleDragStart, finish: handleDragFinish } = useDragInteraction();
  const dragInteractionActive = activeId !== null;
  const dragging = useMemo<Dragging | null>(() => {
    if (activeId === null) return null;
    const methodId = parseMethodDragId(activeId);
    if (methodId !== null) return { kind: 'method', id: methodId };
    const fieldId = parseFieldDragId(activeId);
    if (fieldId !== null) return { kind: 'field', id: fieldId };
    const classId = parseClassDragId(activeId);
    return classId === null ? null : { kind: 'class', id: classId };
  }, [activeId]);
  const dropTargets = useMemo<DropTargetsState | null>(() => (
    dragging === null ? null : { dragging, targets: dropTargetIds(codebase, dragging) }
  ), [codebase, dragging]);
  const [flow, setFlow] = useState<ReactFlowInstance<CodebaseFlowNode> | null>(null);
  const [revealFileId, setRevealFileId] = useState<string | null>(null);
  const { autoFitStateRef, onMoveStart, onManualFit, onControlZoom } = useAutoFitActions();
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION), useSensor(KeyboardSensor));
  const announcements = useMemo(() => createAnnouncements(codebase), [codebase]);
  const contextMenu = useCanvasContextMenu();
  // メニューは document.body へのポータルなので、画面を隠しただけでは消えない(隠れたコードベースを操作できてしまう)
  useDismissContextMenuWhenInactive(active, contextMenu.close);


  const handleDragEnd = useDropHandler(codebase, handleDragFinish, flow, { setPosition, setRevealFileId });

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragFinish}
    >
      <DropTargetsContext.Provider value={dropTargets}>
        <CanvasFlow
          nodes={nodes} edges={edges} onNodesChange={handleNodesChange} setFlow={setFlow} contextMenu={contextMenu}
          selectMethod={selectMethod} stageId={stageId} visibleFileCount={visibleFileCount} codebase={codebase} layers={layers}
          layoutResetCount={layoutResetCount} arrangeVersion={arrangeVersion} arrange={arrange}
          autoFitStateRef={autoFitStateRef} onMoveStart={onMoveStart} onManualFit={onManualFit} onControlZoom={onControlZoom} dragInteractionActive={dragInteractionActive} revealFileId={revealFileId}
        />
      </DropTargetsContext.Provider>
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
