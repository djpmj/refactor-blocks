import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { allClasses, findClass, type Codebase } from "../../domain/codebase/Codebase";
import { classDependencies } from "../../domain/codebase/dependencies";

export type FileNodeData = { fileId: string };
export type ClassNodeData = { classId: string };
export type FileFlowNode = Node<FileNodeData, "fileNode">;
export type ClassFlowNode = Node<ClassNodeData, "classNode">;
export type CodebaseFlowNode = FileFlowNode | ClassFlowNode;

const FILE_GAP = 60;
const FILE_PADDING = 24;
const FILE_HEADER = 36;
const CLASS_WIDTH = 280;
const CLASS_GAP = 24;
const METHOD_ROW = 34;
const CLASS_HEADER = 44;
const MIN_CLASS_HEIGHT = 110;
/** クラスが空のファイルにもクラスをドロップできる広さを残す。 */
const MIN_FILE_HEIGHT = 140;

function classHeight(methodCount: number): number {
  return Math.max(
    MIN_CLASS_HEIGHT,
    CLASS_HEADER + methodCount * METHOD_ROW + 16,
  );
}

/**
 * ファイルを横に並べ、その中にクラスを縦に積む。クラスはファイルノードの子(parentId)として配置する。
 * 最初はステージ作者が手で座標を持たなくて済むよう自動配置にしている。
 */
export function layoutCodebase(codebase: Codebase): CodebaseFlowNode[] {
  const nodes: CodebaseFlowNode[] = [];
  let fileX = 0;
  for (const file of codebase.files) {
    let classY = FILE_HEADER + FILE_PADDING;
    const classNodes: ClassFlowNode[] = file.classes.map((codeClass) => {
      const height = classHeight(codeClass.methods.length);
      const node: ClassFlowNode = {
        id: codeClass.id,
        type: "classNode",
        parentId: file.id,
        extent: "parent",
        position: { x: FILE_PADDING, y: classY },
        style: { width: CLASS_WIDTH, height },
        data: { classId: codeClass.id },
      };
      classY += height + CLASS_GAP;
      return node;
    });
    const fileWidth = CLASS_WIDTH + FILE_PADDING * 2;
    nodes.push({
      id: file.id,
      type: "fileNode",
      position: { x: fileX, y: 0 },
      style: {
        width: fileWidth,
        height: Math.max(MIN_FILE_HEIGHT, classY - CLASS_GAP + FILE_PADDING),
      },
      data: { fileId: file.id },
    });
    nodes.push(...classNodes);
    fileX += fileWidth + FILE_GAP;
  }
  return nodes;
}

/** 矢印はファイルの箱(親ノード)より手前に描く。 */
const EDGE_Z_INDEX = 1000;

type Side = "left" | "right" | "top";

/** 間に他ファイルを挟む辺の数。1本以上挟むと、そのファイルのクラスの上に線が重なってしまう。 */
const SKIPPED_FILE_THRESHOLD = 2;

/**
 * 依存元・依存先のファイルの並び順から、矢印をつなぐ(依存元の側, 依存先の側)を選ぶ。
 * ファイルを1つ以上飛び越える辺は左右の辺ではなく上端どうしをつなぎ、間にあるファイルのクラスの上を線が通らないようにする。
 */
function handleSides(fromIndex: number, toIndex: number): [Side, Side] {
  if (toIndex === fromIndex) return ["right", "right"];
  if (Math.abs(toIndex - fromIndex) >= SKIPPED_FILE_THRESHOLD) return ["top", "top"];
  return toIndex > fromIndex ? ["right", "left"] : ["left", "right"];
}

function fileIndexByClassId(codebase: Codebase): Map<string, number> {
  return new Map(
    codebase.files.flatMap((file, index) =>
      file.classes.map((codeClass) => [codeClass.id, index] as const),
    ),
  );
}

/**
 * クラス間の依存を矢印にする。循環している依存は赤で描く。
 * 相手が右のファイルなら右端→左端、左なら左端→右端、同じファイルなら右端どうしでつなぐ。
 * 双方向の依存はハンドルの高さ(CSS)が source と target で違うので、2本が重ならない。
 */
export function dependencyEdges(codebase: Codebase): Edge[] {
  const indexByClassId = fileIndexByClassId(codebase);
  return classDependencies(codebase).map(({ from, to, cyclic }) => {
    const fromIndex = indexByClassId.get(from) ?? 0;
    const toIndex = indexByClassId.get(to) ?? 0;
    const [sourceSide, targetSide] = handleSides(fromIndex, toIndex);
    return {
      id: `dep-${from}-${to}`,
      source: from,
      target: to,
      sourceHandle: `source-${sourceSide}`,
      targetHandle: `target-${targetSide}`,
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
  const indexByClassId = fileIndexByClassId(codebase);
  const edges: Edge[] = [];
  for (const codeClass of allClasses(codebase)) {
    const superclassId = codeClass.superclassId;
    if (superclassId === undefined || findClass(codebase, superclassId) === undefined) continue;
    const fromIndex = indexByClassId.get(codeClass.id) ?? 0;
    const toIndex = indexByClassId.get(superclassId) ?? 0;
    const [sourceSide, targetSide] = handleSides(fromIndex, toIndex);
    edges.push({
      id: `inherit-${codeClass.id}-${superclassId}`,
      source: codeClass.id,
      target: superclassId,
      sourceHandle: `source-${sourceSide}`,
      targetHandle: `target-${targetSide}`,
      zIndex: EDGE_Z_INDEX,
      className: "edge--inheritance",
      markerEnd: { type: MarkerType.Arrow },
    });
  }
  return edges;
}
