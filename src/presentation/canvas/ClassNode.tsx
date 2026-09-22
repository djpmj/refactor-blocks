import { Fragment } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { findClass, findSuperclass } from "../../domain/codebase/Codebase";
import { classLines } from "../../domain/codebase/lineCount";
import { useGameStore } from "../store/useGameStore";
import { classDragId, classDropId } from "./dndIds";
import type { ClassFlowNode } from "./layoutCodebase";
import { MethodChip } from "./MethodChip";
import { useShowDetails } from "./semanticZoom";

const HANDLE_SIDES = [
  { side: "left", position: Position.Left },
  { side: "right", position: Position.Right },
];

/** 依存の矢印の向きに合わせて左右どちらにもつなげるよう、両側に source/target を置く。見た目には出さない。 */
function DependencyHandles() {
  return HANDLE_SIDES.map(({ side, position }) => (
    <Fragment key={side}>
      <Handle
        id={`target-${side}`}
        type="target"
        position={position}
        className="class-node__handle class-node__handle--target"
        isConnectable={false}
      />
      <Handle
        id={`source-${side}`}
        type="source"
        position={position}
        className="class-node__handle class-node__handle--source"
        isConnectable={false}
      />
    </Fragment>
  ));
}

/** クラス名と、親クラスがあれば "extends 親クラス名" を添える。 */
function ClassNameLabel({ classId, name }: Readonly<{ classId: string; name: string }>) {
  const superclass = useGameStore((state) => findSuperclass(state.codebase, classId));
  return (
    <span className="class-node__name">
      {name}
      {superclass === undefined ? null : <span className="class-node__superclass"> extends {superclass.name}</span>}
    </span>
  );
}

export function ClassNode({ data }: Readonly<NodeProps<ClassFlowNode>>) {
  const codeClass = useGameStore((state) =>
    findClass(state.codebase, data.classId),
  );
  const limit = useGameStore((state) => state.stage.limits.class);
  const showDetails = useShowDetails();
  const { setNodeRef, isOver } = useDroppable({
    id: classDropId(data.classId),
  });
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
      className={isOver ? "class-node class-node--drop-target" : "class-node"}
      data-testid={`class-${codeClass.name}`}
    >
      {/* 依存の矢印の接続点。つなぐ操作はさせないので見た目には出さない。 */}
      <DependencyHandles />
      <div
        ref={setDragRef}
        className="class-node__header nodrag nopan"
        style={{ opacity: isDragging ? 0.3 : 1 }}
        data-testid={`class-header-${codeClass.name}`}
        aria-label={`${codeClass.name} を別ファイルへ移動`}
        {...attributes}
        {...listeners}
      >
        <ClassNameLabel classId={data.classId} name={codeClass.name} />
        {showDetails ? (
          <span
            className={
              lines > limit ? "line-badge line-badge--over" : "line-badge"
            }
          >
            {lines}行
          </span>
        ) : null}
      </div>
      {showDetails ? (
        <div className="class-node__methods">
          {codeClass.methods.length === 0 ? (
            <div className="class-node__empty">ここにメソッドをドロップ</div>
          ) : (
            codeClass.methods.map((method) => (
              <MethodChip key={method.id} method={method} />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
