# 継承・実装の矢印を見やすくする(矢じりを大きく、同じ親に集まる矢印は着地点をずらす)

## 背景・目的

親クラス・インターフェースへ向かう継承(`extends`)・実装(`implements`)の矢印は、キャンバスでは `inheritanceEdges`
(`src/presentation/canvas/layoutCodebase.ts`)が `className: 'edge--inheritance'`・`markerEnd: { type: MarkerType.Arrow }` で描いている。
実際の画面(上級3: 割引のStrategy。`RegularDiscount` / `PremiumDiscount` / `VipDiscount` が `DiscountStrategy` を実装)では次の2点で読み取りにくい。

1. **矢じりが小さく、色が付かない**。`MarkerType.Arrow` は細い開いた「>」で、`markerEnd` に `color` を指定していないため線のアクセント色
   (`--accent`、`.edge--inheritance` の `stroke`)にならず、薄いグレーのまま。線は青いのに矢じりが見えず、向きが分かりにくい。
2. **同じ親へ向かう矢印が1点に重なる**。着地点が親クラスの上端の1か所(`.class-node__handle--target-top` の `left: 35%`)に固定なので、
   子が3つあると3本の矢じりが完全に重なって1つの塊に見え、「何本の継承がつながっているか」が分からない。

プレイヤーが「誰が誰を継承・実装しているか」を一目で読み取れるようにする。UMLのクラス図に近い、
**大きな白抜きの三角の矢じり(線と同じアクセント色の枠)**にし、**同じ親へ着地する矢印は着地点を横にずらして並べる**。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/canvas/InheritanceMarker.tsx` | presentation | 新規 | 白抜き三角の矢じりを定義する SVG `<defs>`(`<marker id="inheritance-arrow">`)。`CodebaseCanvas`・`CodebasePreviewCanvas` の両方のキャンバスの中に1つずつ置く |
| `src/presentation/canvas/layoutCodebase.ts` | presentation | 変更 | `inheritanceEdges` の `markerEnd` を `'url(#inheritance-arrow)'` にする。同じ着地点(親クラス+着地側)に集まる継承の辺ごとに、着地点のずらし幅 `data.targetOffset`(px)を計算して付ける(下記の純粋関数) |
| `src/presentation/canvas/layoutCodebase.test.ts` | presentation(test) | 変更 | ずらし幅のテストを追加(TDD、下記) |
| `src/presentation/canvas/OffsetEdge.tsx` | presentation | 新規 | `data.targetOffset` ぶん終点の x をずらして描くエッジ(`getBezierPath` を使う標準の曲線のまま、終点だけ移動する)。継承の辺で `skip` ではないものに使う(`type: 'offset'`) |
| `src/presentation/canvas/TopRouteEdge.tsx` | presentation | 変更 | `skip` の辺でも同じ `data.targetOffset` を終点の x に足す |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `edgeTypes` に `offset: OffsetEdge` を登録し、`<InheritanceMarker />` を `ReactFlow` の子に置く |
| `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | 変更 | 読み取り専用キャンバス(設計くらべ・変更前の図・解答例の図)も同じエッジ・矢じりを使うので、同様に `edgeTypes` と `<InheritanceMarker />` を追加する |
| `src/index.css` | presentation | 変更 | `#inheritance-arrow` の見た目(塗り `var(--surface)`・枠 `var(--accent)`)と、継承の線を少し太くする(`stroke-width: 2` → `2.5` 程度)を調整 |
| `e2e/` の継承に関する既存spec | E2E | 変更・追加 | 矢じりが付いていること・同じ親への複数の矢印の終点が重ならないことを確認する |

## 見た目の仕様

- 矢じり: 大きさは約 16×16px の三角形で、先端が親クラスの枠の縁に接する。塗りは `var(--surface)`(白抜き)、枠線は `var(--accent)`、
  線の太さに依存しないよう `markerUnits="userSpaceOnUse"`。ライト/ダークの両方で読める(色はCSS変数経由。直書きしない)
- 依存の矢印(塗りつぶし矢印・グレー/循環時は赤)・循環依存の赤い矢印の見た目は変えない
- 着地点のずらし: 同じ親クラスの同じ着地側(上端/下端/左端/右端)に N 本(N ≥ 2)の継承の辺が集まるとき、
  終点を `((i - (N - 1) / 2) × spacing)` px だけ元の着地点から横(上端・下端のとき)または縦(左端・右端のとき)にずらして左から(上から)順に並べる。
  `spacing` は 24px を上限とし、クラスの幅に収まるよう `min(24, (CLASS_WIDTH - 40) / (N - 1))` に抑える
- 並び順は、辺の出発元のクラスが載っているファイルの x 座標(左→右)の小さい順にし、辺どうしの交差を減らす
  (ponytail: 同じx座標のものは `allClasses` の並び順。スペースが足りないほど多くの子がつくときは `spacing` が小さくなって矢じりが重なる。そのときは親を幅広にする)
- N が 1 のときは `targetOffset` を付けず、従来と同じ着地点にする
- ずらしは継承・実装の辺だけに適用し、依存の辺には適用しない(今回の対象外)

## データ・型の変更

`Edge.data` に任意のフィールドを追加する(React Flow の `data` はもともと任意の形)。

```ts
// 継承の辺の data(skip のときは lane も持つ)
{ lane?: number; targetOffset?: number }
```

`Codebase`・`Stage` などのドメイン型は変更しない。

## TDD対象の純粋関数

`layoutCodebase.ts` に、着地点のずらし幅を計算する純粋関数(例: `spreadOffsets(count: number, maxWidth: number): number[]`)を切り出して `layoutCodebase.test.ts` でテストする(AAA)。

1. `count = 1` → `[0]`
2. `count = 2` → 左右に対称な2つ(合計が0、差が `spacing`)
3. `count = 3` → `[-spacing, 0, spacing]`(中央が0、左右が対称)
4. `count` が大きく `maxWidth` を超えるとき → 隣との間隔が `spacing` 未満に縮み、すべてのオフセットの絶対値が `maxWidth / 2` 以内に収まる
5. `count = 0` → `[]`

`inheritanceEdges` のテスト: 同じ親を3つの子が継承する Codebase で、3本の辺の `data.targetOffset` が互いに異なり、
出発元のファイルの x 座標の昇順になっている。親が1つの子だけに継承される場合は `targetOffset` が付かない。
全ての継承の辺で `markerEnd` が `'url(#inheritance-arrow)'` である。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る(`rf__edge-inherit-…` を探す既存E2Eが壊れていない)
- 上級3(割引のStrategy)で3つの子クラスを `DiscountStrategy` の実装にすると、`DiscountStrategy` の上端に**3つの白抜き三角の矢じりが横に並び**、重ならずに数えられる
- 矢じりは線と同じアクセント色の枠で、依存の矢印(グレー・塗りつぶし)と一目で区別できる
- 親が1つの子にだけ継承される場合は、矢じりは従来どおり1か所で、位置も大きくずれない
- 「設計くらべ」・「変更前の図を見る」・「解答例の図を見る」の継承の矢印にも、同じ矢じりとずらしが適用される
- ライトモード・ダークモードどちらでも矢じりが見える
- 依存の矢印・循環依存の赤い矢印の見た目は変わらない
- E2E(`e2e/` に追加): 同じ親へ3つの継承の辺があるとき、3つの辺の終点の x 座標がすべて異なる(重なっていない)。継承の辺に `markerEnd` が付いている

## スコープ外

- 依存の矢印(グレー)の矢じり・着地点のずらし(今回は継承・実装の辺だけ)
- 継承(`extends`、実線)と実装(`implements`、UMLでは点線)で線種を変えること。今は両方とも同じ実線のまま
- 矢印の経路を直角折れ線や「幹線にまとめる」ツリー形に変えること(今の曲線のまま)
- `edge-handles-by-position`(Issue #36)が決める出入り口の選び方の変更。#36 が先にマージされた場合は、ファイルの x 座標の取得元を #36 のファイル矩形に合わせて実装する(どちらが先でも、後からのブランチが rebase して衝突を解消する)
- 矢印へのラベル表示、ホバー時の強調
