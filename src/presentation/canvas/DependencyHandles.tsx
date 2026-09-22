import { Fragment } from "react";
import { Handle, Position } from "@xyflow/react";

const HANDLE_SIDES = [
  { side: "left", position: Position.Left },
  { side: "right", position: Position.Right },
  { side: "top", position: Position.Top },
  { side: "bottom", position: Position.Bottom },
  { side: "skip", position: Position.Top },
];

/**
 * 依存・継承の矢印の接続点。
 * - 左右(left/right): 同じ層(row)の隣どうしをつなぐ。
 * - 上下(top/bottom): 層をまたぐ辺をつなぐ(呼ぶ側の下端→呼ばれる側の上端)。
 * - skip: 同じ層でファイルを1つ以上飛び越える辺。ファイルの箱より上まで引き上げ、間のファイルの上に重ならないようにする
 *   (`layoutCodebase.ts` の `handleSides`/`assignTopLanes` が対で選ぶ)。
 * どの向きも、CSS(`class-node__handle--{source|target}-{side}`)で出る点・入る点をずらし、双方向の辺が重ならないようにする。
 */
export function DependencyHandles() {
  return HANDLE_SIDES.map(({ side, position }) => (
    <Fragment key={side}>
      <Handle
        id={`target-${side}`}
        type="target"
        position={position}
        className={`class-node__handle class-node__handle--target-${side}`}
        isConnectable={false}
      />
      <Handle
        id={`source-${side}`}
        type="source"
        position={position}
        className={`class-node__handle class-node__handle--source-${side}`}
        isConnectable={false}
      />
    </Fragment>
  ));
}
