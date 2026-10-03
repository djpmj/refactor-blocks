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
type FilePosition = { row: number; col: number; classIndex: number };

/** 同じ層(row)の中で、間に他ファイルを挟む辺の数。1本以上挟むと、そのファイルのクラスの上に線が重なってしまう。 */
const SKIPPED_FILE_THRESHOLD = 2;

/**
 * 依存元・依存先のファイルの位置(層row・層内の並びcol・ファイル内でのクラスの並びclassIndex)から、
 * 矢印をつなぐ(依存元の側, 依存先の側)を選ぶ。
 * - 層が違えば、浅い方の下端から深い方の上端へ(逆向きの辺は逆に)つなぐ。
 * - 同じファイルのクラス同士は、縦に積まれた並び(classIndex)に沿って上のクラスの下端から下のクラスの上端へつなぐ
 *   (同じ右端どうしでは左右の座標が一致し、React Flowが辺を描けないため)。
 * - 同じ層の別ファイルどうしは、隣なら右端→左端(またはその逆)、1つ以上飛び越えるときは skip(上端をずらしてつなぐ)。
 */
function handleSides(from: FilePosition, to: FilePosition): [Side, Side] {
  if (from.row !== to.row) return from.row < to.row ? ["bottom", "top"] : ["top", "bottom"];
  if (to.col === from.col) return from.classIndex < to.classIndex ? ["bottom", "top"] : ["top", "bottom"];
  if (Math.abs(to.col - from.col) >= SKIPPED_FILE_THRESHOLD) return ["skip", "skip"];
  return to.col > from.col ? ["right", "left"] : ["left", "right"];
}

function filePositionByClassId(codebase: Codebase): Map<string, FilePosition> {
  const rows = fileRows(codebase);
  const position = new Map<string, FilePosition>();
  rows.forEach((files, row) => {
    files.forEach((file, col) => {
      file.classes.forEach((codeClass, classIndex) => position.set(codeClass.id, { row, col, classIndex }));
    });
  });
  return position;
}

type TopLaneSpan = { id: string; row: number; start: number; end: number };

/**
 * 同じ層(row)の中で、1つ以上ファイルを飛び越える辺(skipどうしをつなぐ辺)が同じ高さで重ならないよう、
 * 層ごとに区間スケジューリング(会議室割り当てと同じアルゴリズム)でレーン番号をedge idごとに割り当てる。
 * ファイルの範囲が重なる辺は別レーンに、重ならない辺は同じレーンを使い回す。
 */
function assignTopLanes(spans: readonly TopLaneSpan[]): ReadonlyMap<string, number> {
  const sorted = [...spans].sort((a, b) => a.row - b.row || a.start - b.start || a.end - b.end);
  const laneEndsByRow = new Map<number, number[]>();
  const laneById = new Map<string, number>();
  for (const span of sorted) {
    const laneEnds = laneEndsByRow.get(span.row) ?? [];
    laneEndsByRow.set(span.row, laneEnds);
    const lane = laneEnds.findIndex((end) => end <= span.start);
    const laneIndex = lane === -1 ? laneEnds.length : lane;
    laneEnds[laneIndex] = span.end;
    laneById.set(span.id, laneIndex);
  }
  return laneById;
}

function topLaneSpan(id: string, from: FilePosition, to: FilePosition): TopLaneSpan | undefined {
  if (from.row !== to.row || Math.abs(to.col - from.col) < SKIPPED_FILE_THRESHOLD) return undefined;
  return { id, row: from.row, start: Math.min(from.col, to.col), end: Math.max(from.col, to.col) };
}

/** 依存・継承をまとめて1回でレーン分けする(片方ずつ割り当てると、両方が同じ高さを選んで重なるため)。 */
function topLanesByEdgeId(codebase: Codebase): ReadonlyMap<string, number> {
  const positionByClassId = filePositionByClassId(codebase);
  const at = (classId: string) => positionByClassId.get(classId) ?? { row: 0, col: 0, classIndex: 0 };
  const depSpans = classDependencies(codebase)
    .map(({ from, to }) => topLaneSpan(`dep-${from}-${to}`, at(from), at(to)))
    .filter((span): span is TopLaneSpan => span !== undefined);
  const inheritSpans = allClasses(codebase)
    .flatMap((codeClass) => parentIds(codeClass).map((parentId) => ({ codeClass, parentId })))
    .filter(({ parentId }) => findClass(codebase, parentId) !== undefined)
    .map(({ codeClass, parentId }) => topLaneSpan(`inherit-${codeClass.id}-${parentId}`, at(codeClass.id), at(parentId)))
    .filter((span): span is TopLaneSpan => span !== undefined);
  return assignTopLanes([...depSpans, ...inheritSpans]);
}

/**
 * クラス間の依存を矢印にする。循環している依存は赤で描く。
 * 層が違えば上下(浅い方の下端→深い方の上端)、同じ層なら左右(飛び越えるときはskip)でつなぐ。
 */
export function dependencyEdges(codebase: Codebase): Edge[] {
  const positionByClassId = filePositionByClassId(codebase);
  const laneByEdgeId = topLanesByEdgeId(codebase);
  return classDependencies(codebase).map(({ from, to, cyclic }) => {
    const fromPosition = positionByClassId.get(from) ?? { row: 0, col: 0, classIndex: 0 };
    const toPosition = positionByClassId.get(to) ?? { row: 0, col: 0, classIndex: 0 };
    const [sourceSide, targetSide] = handleSides(fromPosition, toPosition);
    const id = `dep-${from}-${to}`;
    const isSkip = sourceSide === "skip" && targetSide === "skip";
    return {
      id,
      source: from,
      target: to,
      sourceHandle: `source-${sourceSide}`,
      targetHandle: `target-${targetSide}`,
      type: isSkip ? "topRoute" : undefined,
      data: isSkip ? { lane: laneByEdgeId.get(id) ?? 0 } : undefined,
      zIndex: EDGE_Z_INDEX,
      className: cyclic ? "edge--cyclic" : undefined,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: cyclic ? "var(--danger)" : undefined,
      },
    };
  });
}

/**
 * 継承(子→親)を矢印にする。依存の矢印(塗りつぶし矢印、循環時のみ赤)と区別できるよう、
 * 輪郭だけの矢印・アクセント色の専用クラスにする。親が削除されて見つからないクラスは辺を作らない。
 */
export function inheritanceEdges(codebase: Codebase): Edge[] {
  const positionByClassId = filePositionByClassId(codebase);
  const laneByEdgeId = topLanesByEdgeId(codebase);
  const edges: Edge[] = [];
  for (const codeClass of allClasses(codebase)) {
    for (const parentId of parentIds(codeClass)) {
      if (findClass(codebase, parentId) === undefined) continue;
      const fromPosition = positionByClassId.get(codeClass.id) ?? { row: 0, col: 0, classIndex: 0 };
      const toPosition = positionByClassId.get(parentId) ?? { row: 0, col: 0, classIndex: 0 };
      const [sourceSide, targetSide] = handleSides(fromPosition, toPosition);
      const id = `inherit-${codeClass.id}-${parentId}`;
      const isSkip = sourceSide === "skip" && targetSide === "skip";
      edges.push({
        id,
        source: codeClass.id,
        target: parentId,
        sourceHandle: `source-${sourceSide}`,
        targetHandle: `target-${targetSide}`,
        type: isSkip ? "topRoute" : undefined,
        data: isSkip ? { lane: laneByEdgeId.get(id) ?? 0 } : undefined,
        zIndex: EDGE_Z_INDEX,
        className: "edge--inheritance",
        markerEnd: { type: MarkerType.Arrow },
      });
    }
  }
  return edges;
}
