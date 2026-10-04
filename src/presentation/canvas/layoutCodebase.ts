import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { allClasses, fieldsOf, findClass, parentIds, type CodeClass, type Codebase } from "../../domain/codebase/Codebase";
import { classDependencies } from "../../domain/codebase/dependencies";

export type FileNodeData = { fileId: string };
export type ClassNodeData = { classId: string };
export type FileFlowNode = Node<FileNodeData, "fileNode">;
export type ClassFlowNode = Node<ClassNodeData, "classNode">;
export type CodebaseFlowNode = FileFlowNode | ClassFlowNode;

type CodeFile = Codebase["files"][number];

const FILE_GAP = 60;
const FILE_PADDING = 24;
const FILE_HEADER = 36;
const CLASS_WIDTH = 280;
const CLASS_GAP = 24;
const METHOD_ROW = 34;
/** フィールド1つぶんの高さ。メソッドより見た目を控えめにするぶん、行の高さも少し小さい。 */
const FIELD_ROW = 30;
const CLASS_HEADER = 44;
const MIN_CLASS_HEIGHT = 110;
/** クラスが空のファイルにもクラスをドロップできる広さを残す。 */
const MIN_FILE_HEIGHT = 140;
/** 層(row)の間は、依存・継承の矢印が通れるだけの余白を空ける。 */
const ROW_GAP = 96;

function classHeight(codeClass: CodeClass): number {
  return Math.max(
    MIN_CLASS_HEIGHT,
    CLASS_HEADER + codeClass.methods.length * METHOD_ROW + fieldsOf(codeClass).length * FIELD_ROW + 16,
  );
}

type FileMetrics = { width: number; height: number };

function measureFile(file: CodeFile): FileMetrics {
  const classY = file.classes.reduce(
    (y, codeClass) => y + classHeight(codeClass) + CLASS_GAP,
    FILE_HEADER + FILE_PADDING,
  );
  return { width: CLASS_WIDTH + FILE_PADDING * 2, height: Math.max(MIN_FILE_HEIGHT, classY - CLASS_GAP + FILE_PADDING) };
}

/** ファイル同士の依存・継承をまとめた有向グラフ(自己参照・同じファイル内の参照は除く)。層分けに使う。 */
function fileDependencyGraph(codebase: Codebase): Map<string, Set<string>> {
  const fileIdByClassId = new Map(codebase.files.flatMap((file) => file.classes.map((codeClass) => [codeClass.id, file.id] as const)));
  const graph = new Map<string, Set<string>>(codebase.files.map((file) => [file.id, new Set<string>()]));
  const addEdge = (fromClassId: string, toClassId: string) => {
    const fromFile = fileIdByClassId.get(fromClassId);
    const toFile = fileIdByClassId.get(toClassId);
    if (fromFile === undefined || toFile === undefined || fromFile === toFile) return;
    graph.get(fromFile)?.add(toFile);
  };
  for (const { from, to } of classDependencies(codebase)) addEdge(from, to);
  for (const codeClass of allClasses(codebase)) {
    for (const parentId of parentIds(codeClass)) {
      if (findClass(codebase, parentId) !== undefined) addEdge(codeClass.id, parentId);
    }
  }
  return graph;
}

function inDegreesOf(graph: ReadonlyMap<string, ReadonlySet<string>>): Map<string, number> {
  const inDegree = new Map([...graph.keys()].map((id) => [id, 0]));
  for (const targets of graph.values()) {
    for (const target of targets) inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
  }
  return inDegree;
}

function releasedTargets(graph: ReadonlyMap<string, ReadonlySet<string>>, inDegree: Map<string, number>, id: string): string[] {
  const released: string[] = [];
  for (const target of graph.get(id) ?? []) {
    const degree = (inDegree.get(target) ?? 1) - 1;
    inDegree.set(target, degree);
    if (degree <= 0) released.push(target);
  }
  return released;
}

/**
 * ファイルを、依存・継承の向きに沿って「呼ぶ側が浅い層・呼ばれる側(実装先など)が深い層」になるよう
 * 層(row)に割り当てる(トポロジカルソートと同じ考え方)。循環していて次に進めるファイルが無いときは、
 * 残り全部をまとめて次の層に置いて打ち切る
 * (ponytail: 循環依存ステージ(intermediate-cyclic-dependency)は層で分けられないため、そこだけ横並びのまま)。
 */
function assignFileLayers(codebase: Codebase): Map<string, number> {
  const graph = fileDependencyGraph(codebase);
  const inDegree = inDegreesOf(graph);
  const remaining = new Set(graph.keys());
  const layer = new Map<string, number>();
  let queue = [...remaining].filter((id) => inDegree.get(id) === 0);
  let row = 0;
  while (remaining.size > 0) {
    const current = queue.length > 0 ? queue : [...remaining];
    const next: string[] = [];
    for (const id of current) {
      if (!remaining.has(id)) continue;
      layer.set(id, row);
      remaining.delete(id);
      next.push(...releasedTargets(graph, inDegree, id));
    }
    queue = next;
    row += 1;
  }
  return layer;
}

/** 層ごとにファイルをまとめる。層の中の並び順は元の `codebase.files` の順番のまま。 */
function fileRows(codebase: Codebase): CodeFile[][] {
  const layerByFileId = assignFileLayers(codebase);
  const rows: CodeFile[][] = [];
  for (const file of codebase.files) {
    const row = layerByFileId.get(file.id) ?? 0;
    rows[row] ??= [];
    rows[row].push(file);
  }
  return rows;
}

function layoutFile(file: CodeFile, x: number, y: number, { width, height }: FileMetrics): CodebaseFlowNode[] {
  let classY = FILE_HEADER + FILE_PADDING;
  const classNodes: ClassFlowNode[] = file.classes.map((codeClass) => {
    const nodeHeight = classHeight(codeClass);
    const node: ClassFlowNode = {
      id: codeClass.id,
      type: "classNode",
      parentId: file.id,
      extent: "parent",
      position: { x: FILE_PADDING, y: classY },
      style: { width: CLASS_WIDTH, height: nodeHeight },
      data: { classId: codeClass.id },
    };
    classY += nodeHeight + CLASS_GAP;
    return node;
  });
  const fileNode: FileFlowNode = {
    id: file.id,
    type: "fileNode",
    position: { x, y },
    style: { width, height },
    data: { fileId: file.id },
  };
  return [fileNode, ...classNodes];
}

function rowWidth(files: readonly CodeFile[], metrics: ReadonlyMap<string, FileMetrics>): number {
  return files.reduce((sum, file) => sum + (metrics.get(file.id)?.width ?? 0) + FILE_GAP, -FILE_GAP);
}

/**
 * ファイルを、依存・継承の向きに沿って上から下へ層(row)分けして並べ、その中にクラスを縦に積む。
 * 呼ぶ側(例: Service)が上段、呼ばれる側(実装先のインターフェースなど)が下段になるので、
 * 遠く離れたファイルをまたぐ矢印が間のファイルの上を横切ることが少なくなる。
 * クラスはファイルノードの子(parentId)として配置する。最初はステージ作者が手で座標を持たなくて済むよう自動配置にしている。
 */
export function layoutCodebase(codebase: Codebase): CodebaseFlowNode[] {
  const rows = fileRows(codebase);
  const metrics = new Map(codebase.files.map((file) => [file.id, measureFile(file)] as const));
  const widestRow = Math.max(0, ...rows.map((files) => rowWidth(files, metrics)));
  const nodes: CodebaseFlowNode[] = [];
  let rowY = 0;
  for (const files of rows) {
    let fileX = (widestRow - rowWidth(files, metrics)) / 2;
    let rowHeight = MIN_FILE_HEIGHT;
    for (const file of files) {
      const fileMetrics = metrics.get(file.id) ?? measureFile(file);
      nodes.push(...layoutFile(file, fileX, rowY, fileMetrics));
      fileX += fileMetrics.width + FILE_GAP;
      rowHeight = Math.max(rowHeight, fileMetrics.height);
    }
    rowY += rowHeight + ROW_GAP;
  }
  return nodes;
}

/** 矢印はファイルの箱(親ノード)より手前に描く。 */
const EDGE_Z_INDEX = 1000;

type Side = "left" | "right" | "top" | "bottom" | "skip";
export type FileRect = { x: number; y: number; width: number; height: number };
type ClassPosition = { fileId: string; classIndex: number };
type FilePosition = { row: number; col: number; classIndex: number };

/** 同じ層(row)の中で、間に他ファイルを挟む辺の数。1本以上挟むと、そのファイルのクラスの上に線が重なってしまう。 */
function defaultFileRects(codebase: Codebase): ReadonlyMap<string, FileRect> {
  return fileRectsFromNodes(layoutCodebase(codebase));
}

export function fileRectsFromNodes(nodes: readonly CodebaseFlowNode[]): ReadonlyMap<string, FileRect> {
  const rects = new Map<string, FileRect>();
  for (const node of nodes) {
    if (node.type !== "fileNode") continue;
    const width = node.style?.width;
    const height = node.style?.height;
    if (width === undefined || height === undefined) continue;
    rects.set(node.id, {
      x: node.position.x,
      y: node.position.y,
      width: typeof width === "number" ? width : Number.parseFloat(width),
      height: typeof height === "number" ? height : Number.parseFloat(height),
    });
  }
  return rects;
}

function classPositionById(codebase: Codebase): Map<string, ClassPosition> {
  const position = new Map<string, ClassPosition>();
  for (const file of codebase.files) file.classes.forEach((codeClass, classIndex) => position.set(codeClass.id, { fileId: file.id, classIndex }));
  return position;
}

function filePositionByClassId(codebase: Codebase): Map<string, FilePosition> {
  const position = new Map<string, FilePosition>();
  fileRows(codebase).forEach((files, row) => files.forEach((file, col) => {
    file.classes.forEach((codeClass, classIndex) => position.set(codeClass.id, { row, col, classIndex }));
  }));
  return position;
}

function isDefaultLayout(codebase: Codebase, fileRects: ReadonlyMap<string, FileRect>): boolean {
  const defaults = defaultFileRects(codebase);
  if (defaults.size !== fileRects.size) return false;
  return [...defaults].every(([id, rect]) => {
    const current = fileRects.get(id);
    return current !== undefined && current.x === rect.x && current.y === rect.y
      && current.width === rect.width && current.height === rect.height;
  });
}

function handleSidesByFilePosition(from: FilePosition, to: FilePosition): [Side, Side] {
  if (from.row !== to.row) return from.row < to.row ? ["bottom", "top"] : ["top", "bottom"];
  if (from.col === to.col) return from.classIndex < to.classIndex ? ["bottom", "top"] : ["top", "bottom"];
  if (Math.abs(to.col - from.col) >= 2) return ["skip", "skip"];
  return to.col > from.col ? ["right", "left"] : ["left", "right"];
}

function gap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.max(aStart, bStart) - Math.min(aEnd, bEnd));
}

function segmentIntersectsRect(a: { x: number; y: number }, b: { x: number; y: number }, rect: FileRect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let low = 0;
  let high = 1;
  for (const [origin, delta, minimum, maximum] of [
    [a.x, dx, rect.x, rect.x + rect.width],
    [a.y, dy, rect.y, rect.y + rect.height],
  ]) {
    if (delta === 0) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const start = (minimum - origin) / delta;
    const end = (maximum - origin) / delta;
    low = Math.max(low, Math.min(start, end));
    high = Math.min(high, Math.max(start, end));
    if (low > high) return false;
  }
  return true;
}

function blockedHorizontally(from: FileRect, to: FileRect, blockers: readonly FileRect[]): boolean {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  return blockers.some((rect) => segmentIntersectsRect(fromCenter, toCenter, rect));
}

/** 矩形配置に基づいてクラス間の接続辺を選ぶ純粋関数。 */
export function handleSidesForFiles(
  endpoints: { sourceFileId: string; targetFileId: string; sourceClassIndex: number; targetClassIndex: number },
  fileRects: ReadonlyMap<string, FileRect>,
): [Side, Side] {
  const { sourceFileId, targetFileId, sourceClassIndex, targetClassIndex } = endpoints;
  if (sourceFileId === targetFileId) return sourceClassIndex < targetClassIndex ? ["bottom", "top"] : ["top", "bottom"];
  const from = fileRects.get(sourceFileId);
  const to = fileRects.get(targetFileId);
  if (from === undefined || to === undefined) return ["bottom", "top"];
  const horizontalGap = gap(from.x, from.x + from.width, to.x, to.x + to.width);
  const verticalGap = gap(from.y, from.y + from.height, to.y, to.y + to.height);
  if (horizontalGap > verticalGap) {
    const sourceOnLeft = from.x + from.width / 2 < to.x + to.width / 2;
    const blockers = [...fileRects].filter(([id]) => id !== sourceFileId && id !== targetFileId).map(([, rect]) => rect);
    if (blockedHorizontally(from, to, blockers)) return ["skip", "skip"];
    return sourceOnLeft ? ["right", "left"] : ["left", "right"];
  }
  return from.y + from.height / 2 < to.y + to.height / 2 ? ["bottom", "top"] : ["top", "bottom"];
}

type TopLaneSpan = { id: string; band: number; start: number; end: number };

/**
 * 同じ層(row)の中で、1つ以上ファイルを飛び越える辺(skipどうしをつなぐ辺)が同じ高さで重ならないよう、
 * 層ごとに区間スケジューリング(会議室割り当てと同じアルゴリズム)でレーン番号をedge idごとに割り当てる。
 * ファイルの範囲が重なる辺は別レーンに、重ならない辺は同じレーンを使い回す。
 */
function assignTopLanes(spans: readonly TopLaneSpan[]): ReadonlyMap<string, number> {
  const sorted = [...spans].sort((a, b) => a.band - b.band || a.start - b.start || a.end - b.end);
  const laneEndsByBand = new Map<number, number[]>();
  const laneById = new Map<string, number>();
  for (const span of sorted) {
    const laneEnds = laneEndsByBand.get(span.band) ?? [];
    laneEndsByBand.set(span.band, laneEnds);
    const lane = laneEnds.findIndex((end) => end <= span.start);
    const laneIndex = lane === -1 ? laneEnds.length : lane;
    laneEnds[laneIndex] = span.end;
    laneById.set(span.id, laneIndex);
  }
  return laneById;
}

function topLaneSpan(id: string, fromId: string, toId: string, fileRects: ReadonlyMap<string, FileRect>): TopLaneSpan | undefined {
  const from = fileRects.get(fromId);
  const to = fileRects.get(toId);
  if (from === undefined || to === undefined) return undefined;
  const [source, target] = handleSidesForFiles({ sourceFileId: fromId, targetFileId: toId, sourceClassIndex: 0, targetClassIndex: 0 }, fileRects);
  if (source !== "skip" || target !== "skip") return undefined;
  const peers = [...fileRects.entries()]
    .filter(([, rect]) => rect.y < Math.max(from.y + from.height, to.y + to.height) && rect.y + rect.height > Math.min(from.y, to.y))
    .toSorted((a, b) => a[1].x - b[1].x);
  const rank = (id: string) => peers.findIndex(([peerId]) => peerId === id);
  return { id, band: Math.min(from.y, to.y), start: Math.min(rank(fromId), rank(toId)), end: Math.max(rank(fromId), rank(toId)) };
}

function logicalTopLaneSpan(id: string, from: FilePosition, to: FilePosition): TopLaneSpan | undefined {
  if (from.row !== to.row || Math.abs(to.col - from.col) < 2) return undefined;
  return { id, band: from.row, start: Math.min(from.col, to.col), end: Math.max(from.col, to.col) };
}

/** 依存・継承をまとめて1回でレーン分けする(片方ずつ割り当てると、両方が同じ高さを選んで重なるため)。 */
function topLanesByEdgeId(codebase: Codebase, fileRects: ReadonlyMap<string, FileRect>, useLogicalLayout: boolean): ReadonlyMap<string, number> {
  const positionByClassId = classPositionById(codebase);
  const at = (classId: string) => positionByClassId.get(classId);
  const logicalByClassId = filePositionByClassId(codebase);
  const logicalSpan = (id: string, fromId: string, toId: string) => {
    const from = logicalByClassId.get(fromId);
    const to = logicalByClassId.get(toId);
    return from === undefined || to === undefined ? undefined : logicalTopLaneSpan(id, from, to);
  };
  const depSpans = classDependencies(codebase)
    .map(({ from, to }) => useLogicalLayout
      ? logicalSpan(`dep-${from}-${to}`, from, to)
      : topLaneSpan(`dep-${from}-${to}`, at(from)?.fileId ?? "", at(to)?.fileId ?? "", fileRects))
    .filter((span): span is TopLaneSpan => span !== undefined);
  const inheritSpans = allClasses(codebase)
    .flatMap((codeClass) => parentIds(codeClass).map((parentId) => ({ codeClass, parentId })))
    .filter(({ parentId }) => findClass(codebase, parentId) !== undefined)
    .map(({ codeClass, parentId }) => useLogicalLayout
      ? logicalSpan(`inherit-${codeClass.id}-${parentId}`, codeClass.id, parentId)
      : topLaneSpan(`inherit-${codeClass.id}-${parentId}`, at(codeClass.id)?.fileId ?? "", at(parentId)?.fileId ?? "", fileRects))
    .filter((span): span is TopLaneSpan => span !== undefined);
  return assignTopLanes([...depSpans, ...inheritSpans]);
}

type EdgeDescriptor = {
  id: string;
  source: string;
  target: string;
  sourcePosition: ClassPosition | undefined;
  targetPosition: ClassPosition | undefined;
  sourceFilePosition: FilePosition | undefined;
  targetFilePosition: FilePosition | undefined;
  kind: "dependency" | "inheritance";
  cyclic?: boolean;
};

function edgeRouting(
  descriptor: EdgeDescriptor,
  fileRects: ReadonlyMap<string, FileRect>,
  laneByEdgeId: ReadonlyMap<string, number>,
  useLogicalLayout: boolean,
): Pick<Edge, "sourceHandle" | "targetHandle" | "type" | "data"> {
  const { id } = descriptor;
  const logicalSource = descriptor.sourceFilePosition;
  const logicalTarget = descriptor.targetFilePosition;
  const [sourceSide, targetSide] = useLogicalLayout && logicalSource !== undefined && logicalTarget !== undefined
    ? handleSidesByFilePosition(logicalSource, logicalTarget)
    : handleSidesForPositions(descriptor.sourcePosition, descriptor.targetPosition, fileRects);
  const isSkip = sourceSide === "skip" && targetSide === "skip";
  return {
    sourceHandle: `source-${sourceSide}`,
    targetHandle: `target-${targetSide}`,
    type: isSkip ? "topRoute" : undefined,
    data: isSkip ? { lane: laneByEdgeId.get(id) ?? 0 } : undefined,
  };
}

function handleSidesForPositions(
  sourcePosition: ClassPosition | undefined,
  targetPosition: ClassPosition | undefined,
  fileRects: ReadonlyMap<string, FileRect>,
): [Side, Side] {
  const sourceFileId = sourcePosition?.fileId ?? "";
  const targetFileId = targetPosition?.fileId ?? "";
  const sourceClassIndex = sourcePosition?.classIndex ?? 0;
  const targetClassIndex = targetPosition?.classIndex ?? 0;
  return handleSidesForFiles({ sourceFileId, targetFileId, sourceClassIndex, targetClassIndex }, fileRects);
}

function edgeAppearance(kind: EdgeDescriptor["kind"], cyclic: boolean): Pick<Edge, "className" | "markerEnd"> {
  let className: string | undefined;
  if (kind === "inheritance") className = "edge--inheritance";
  if (kind === "dependency" && cyclic) className = "edge--cyclic";
  return {
    className,
    markerEnd: {
      type: kind === "inheritance" ? MarkerType.Arrow : MarkerType.ArrowClosed,
      color: cyclic ? "var(--danger)" : undefined,
    },
  };
}

function edgeFor(
  descriptor: EdgeDescriptor,
  fileRects: ReadonlyMap<string, FileRect>,
  laneByEdgeId: ReadonlyMap<string, number>,
  useLogicalLayout: boolean,
): Edge {
  const { id, source, target, kind, cyclic = false } = descriptor;
  return {
    id,
    source,
    target,
    ...edgeRouting(descriptor, fileRects, laneByEdgeId, useLogicalLayout),
    zIndex: EDGE_Z_INDEX,
    ...edgeAppearance(kind, cyclic),
  };
}

/**
 * クラス間の依存を矢印にする。循環している依存は赤で描く。
 * 層が違えば上下(浅い方の下端→深い方の上端)、同じ層なら左右(飛び越えるときはskip)でつなぐ。
 */
export function dependencyEdges(codebase: Codebase, fileRects: ReadonlyMap<string, FileRect> = defaultFileRects(codebase)): Edge[] {
  const positionByClassId = classPositionById(codebase);
  const filePositionByClassIdMap = filePositionByClassId(codebase);
  const useLogicalLayout = isDefaultLayout(codebase, fileRects);
  const laneByEdgeId = topLanesByEdgeId(codebase, fileRects, useLogicalLayout);
  return classDependencies(codebase).map(({ from, to, cyclic }) => edgeFor({
    id: `dep-${from}-${to}`, source: from, target: to,
    sourcePosition: positionByClassId.get(from), targetPosition: positionByClassId.get(to),
    sourceFilePosition: filePositionByClassIdMap.get(from), targetFilePosition: filePositionByClassIdMap.get(to),
    kind: "dependency", cyclic,
  }, fileRects, laneByEdgeId, useLogicalLayout));
}

/**
 * 継承(子→親)を矢印にする。依存の矢印(塗りつぶし矢印、循環時のみ赤)と区別できるよう、
 * 輪郭だけの矢印・アクセント色の専用クラスにする。親が削除されて見つからないクラスは辺を作らない。
 */
export function inheritanceEdges(codebase: Codebase, fileRects: ReadonlyMap<string, FileRect> = defaultFileRects(codebase)): Edge[] {
  const positionByClassId = classPositionById(codebase);
  const filePositionByClassIdMap = filePositionByClassId(codebase);
  const useLogicalLayout = isDefaultLayout(codebase, fileRects);
  const laneByEdgeId = topLanesByEdgeId(codebase, fileRects, useLogicalLayout);
  return allClasses(codebase).flatMap((codeClass) => parentIds(codeClass)
    .filter((parentId) => findClass(codebase, parentId) !== undefined)
    .map((parentId) => edgeFor({
      id: `inherit-${codeClass.id}-${parentId}`, source: codeClass.id, target: parentId,
      sourcePosition: positionByClassId.get(codeClass.id), targetPosition: positionByClassId.get(parentId),
      sourceFilePosition: filePositionByClassIdMap.get(codeClass.id), targetFilePosition: filePositionByClassIdMap.get(parentId),
      kind: "inheritance",
    }, fileRects, laneByEdgeId, useLogicalLayout)));
}
