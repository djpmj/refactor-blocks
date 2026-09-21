import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { classDependencies } from '../../domain/codebase/dependencies';

export type FileNodeData = { fileId: string };
export type ClassNodeData = { classId: string };
export type FileFlowNode = Node<FileNodeData, 'fileNode'>;
export type ClassFlowNode = Node<ClassNodeData, 'classNode'>;
export type CodebaseFlowNode = FileFlowNode | ClassFlowNode;

const FILE_GAP = 60;
const FILE_PADDING = 24;
const FILE_HEADER = 36;
const CLASS_WIDTH = 280;
const CLASS_GAP = 24;
const METHOD_ROW = 34;
const CLASS_HEADER = 44;
const MIN_CLASS_HEIGHT = 110;

function classHeight(methodCount: number): number {
  return Math.max(MIN_CLASS_HEIGHT, CLASS_HEADER + methodCount * METHOD_ROW + 16);
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
        type: 'classNode',
        parentId: file.id,
        extent: 'parent',
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
      type: 'fileNode',
      position: { x: fileX, y: 0 },
      style: { width: fileWidth, height: classY - CLASS_GAP + FILE_PADDING },
      data: { fileId: file.id },
    });
    nodes.push(...classNodes);
    fileX += fileWidth + FILE_GAP;
  }
  return nodes;
}

/** クラス間の依存を矢印にする。循環している依存は赤で描く。 */
export function dependencyEdges(codebase: Codebase): Edge[] {
  return classDependencies(codebase).map(({ from, to, cyclic }) => ({
    id: `dep-${from}-${to}`,
    source: from,
    target: to,
    className: cyclic ? 'edge--cyclic' : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: cyclic ? 'var(--danger)' : undefined },
  }));
}
