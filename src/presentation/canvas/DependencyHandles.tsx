import { Fragment } from "react";
import { Handle, Position } from "@xyflow/react";

const HANDLE_SIDES = [
  { side: "left", position: Position.Left },
  { side: "right", position: Position.Right },
];

/**
 * 依存・継承の矢印の接続点。左右どちらにもつなげるよう両側に source/target を置く(見た目には出さない)。
 * ファイルを1つ以上飛び越える辺は、間のクラスの上に線が重ならないよう上端の source-top/target-top を使う
 * (`layoutCodebase.ts` の `handleSides` が選ぶ)。ハンドルidはそちらと対にする。
 */
export function DependencyHandles() {
  return (
    <>
      {HANDLE_SIDES.map(({ side, position }) => (
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
      ))}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="class-node__handle class-node__handle--target-top"
        isConnectable={false}
      />
      <Handle
        id="source-top"
        type="source"
        position={Position.Top}
        className="class-node__handle class-node__handle--source-top"
        isConnectable={false}
      />
    </>
  );
}
