# edge-click-over-method-chip: 矢印が上を通るメソッドチップをクリックしても、矢印にクリックを奪われる

## 症状

中級12「横流しするだけの OrderManager」で、次の手順で起きる(模範解答の2手目で詰まる)。

1. `OrderManager.placeOrder()` をクリックし、メソッドエディタの「呼び出し元へ戻す」を押す
2. Controller → Service の依存の矢印(`rf__edge-dep-class-order-controller-class-order-service`)が、OrderManager のクラスボックスの上を通るようになる
3. OrderManager に残った `cancelOrder()` チップの中央をクリックする

→ `document.elementFromPoint` は `path.react-flow__edge-interaction` を返し、クリックは矢印に取られる。右のメソッドエディタは直前のメソッドのまま変わらない。
チップの左10〜30%・右70〜90%は矢印の当たり判定から外れるのでクリックできる。Playwright の通常の `click()` も
「`react-flow__edge-interaction` が pointer events を横取りする」で失敗する(既存の `e2e/refactor.spec.ts` の中級12のテストは
`clickExposedTarget` で当たり判定の外れた位置を探してクリックしているため、この不具合を見逃していた)。

## 原因

- 矢印は `src/presentation/canvas/layoutCodebase.ts` の `edgeFor()` で作られ、`zIndex: EDGE_Z_INDEX`(1000)でファイル・クラスのノードより手前に描かれる。依存の矢印(`dependencyEdges`)も継承の矢印(`inheritanceEdges`)もこの関数1か所を通る(キャンバス `CodebaseCanvas.tsx` とプレビュー `CodebasePreviewCanvas.tsx` の両方の呼び出し元を grep で確認済み)。
- React Flow は既定で矢印を「選択できる」(`selectable` 未指定 → `elementsSelectable: true`)ものとして扱い、`g.react-flow__edge` に `pointer-events: visibleStroke` を付け、BaseEdge は幅20pxの透明な `path.react-flow__edge-interaction` を重ねる。前面にあるこの20pxの帯がチップへのクリック・pointerdown を奪う。
- このアプリでは矢印のクリックを使っていない。`onEdgeClick` 等のハンドラは無く、矢印の選択状態(`.selected`)に依存するCSS・E2Eも無い(grep で確認済み)。警告の矢印のボタン(`WarningEdge.tsx`)は `EdgeLabelRenderer` の別レイヤーにあり、`.warning-edge { pointer-events: all; }` で独自に当たり判定を持つので、矢印本体の当たり判定とは無関係。
- 既に手で直す間(`.canvas-column__flow--marking`)だけ `src/index.css` で `.react-flow__edge-interaction { pointer-events: none; }` にして同じ問題を回避している。今回はそれを常時に広げる形になる。

## 修正

方向として挙がった3案のうち「矢印のクリック判定自体を無効にする」を採る。

- z-index を下げる案は不採用: `EDGE_Z_INDEX` は「矢印をファイルの箱より手前に描く」ためのもので、下げると矢印がファイルの箱に隠れる(`layoutCodebase.test.ts` の `zIndex > 0` のテストもこの意図を守っている)。
- `interactionWidth` を小さくする案は不採用: 0にしても矢印の線そのもの(`.react-flow__edge-path`、太さ1〜3px)は `visibleStroke` で当たり判定を持ち続けるので、線の真下のチップは同じく奪われる。

変更は次の2つ(どちらも presentation 層)。

1. `src/presentation/canvas/layoutCodebase.ts` の `edgeFor()` が返す `Edge` に `selectable: false` を足す(`zIndex: EDGE_Z_INDEX` の隣)。
   React Flow は `selectable` が false で `onEdgeClick` も無い矢印に `inactive` クラスを付け、同梱の `style.css`(`main.tsx` で読み込み済み)の
   `.react-flow__edge.inactive { pointer-events: none; }` で矢印全体(線・interaction の帯)の当たり判定が消える。クリック・ドラッグはその下のチップへ届く。
   新しい依存・新しいコンポーネント・新しいCSSは足さない。
2. `src/index.css` の `.canvas-column__flow--marking .react-flow__edge-interaction { pointer-events: none; }` を削除し、直前のコメントを「矢印ラベルをノードの背面に回して」だけに直す(当たり判定は 1. で常に無いので重複)。`.canvas-column__flow--marking .react-flow__edgelabel-renderer { z-index: 0; }` は残す。

CLAUDE.md の「React Flow と dnd-kit を併用するときの約束」との関係: チップ側の `nodrag nopan`・`DragOverlay` のポータル・`PointerSensor` の `distance: 5` には触らない。矢印の当たり判定を消すだけなので、チップの pointerdown が dnd-kit に届くようになり、ドラッグ(Move Method)も同じく直る。

## テスト

先に書いて Red を確認してから実装する。

- Vitest(`src/presentation/canvas/layoutCodebase.test.ts`、AAA):
  - `dependencyEdges(codebase)` の矢印が `selectable: false` を持つ(既存の `zIndex > 0` のテストと同じ2ファイルの codebase でよい)
  - `inheritanceEdges(codebase)` の矢印も `selectable: false` を持つ
- E2E(新規 `e2e/edge-click-over-method-chip.spec.ts`。`selectStage` は `e2e/selectStage.ts` から import):
  1. Arrange: `page.setViewportSize({ width: 1920, height: 1200 })`、`selectStage(page, '中級12: 横流しするだけの OrderManager')`。`class-OrderManager` 内の `method-placeOrder` をクリックし、「呼び出し元へ戻す」を押す。
  2. 前提の確認: `class-OrderManager` 内の `method-cancelOrder` の中心点が、矢印 `rf__edge-dep-class-order-controller-class-order-service` の `.react-flow__edge-interaction` の帯の上にあることを `evaluate` で確かめる(`path.getScreenCTM().inverse()` で画面座標を path の座標系へ変換し `SVGGeometryElement.isPointInStroke()` を使う。`elementFromPoint` は修正後に矢印を返さなくなるので前提の確認には使わない)。この前提が成り立たないとテストの意味が無いので、1920×1200 で重ならない場合は、重なるビューポートを探して固定する(実機の再現環境に合わせる)。
  3. Act: `page.getByTestId('class-OrderManager').getByTestId('method-cancelOrder').click()`(`clickExposedTarget` ではなく Playwright の通常クリック。チップの中心を押す)。
  4. Assert: 見出し `OrderManager.cancelOrder()` が表示される(`getByRole('heading', { name: /OrderManager\.cancelOrder\(\)/ })`)。あわせて、チップ中心の `elementFromPoint` がチップ自身かその子孫であること。
  - 修正前は 3. が pointer events の横取りでタイムアウトし Red になる。

## 受け入れ基準

1. 中級12で症状の手順をやり、`cancelOrder()` チップの中央をクリックすると、右のメソッドエディタが `OrderManager.cancelOrder()` に切り替わる。チップを掴んで別クラスへドラッグもできる。
2. 矢印は従来どおりファイルの箱より手前に描かれ、警告の矢印のボタン(ポップオーバー)は従来どおりクリックで開閉できる(既存の `e2e/visibility-violation-edge.spec.ts` などが通る)。
3. 手で直す間の「直した」チェックボックスが従来どおり押せる(既存の手で直す系のE2Eが通る)。
4. 上記の Vitest と E2E が追加されて通る。
5. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 矢印の z-index・配線(ルーティング)を変えて、そもそもクラスボックスの上を通らないようにすること。
- 既存の `e2e/refactor.spec.ts` の `clickExposedTarget` を通常クリックへ置き換えること(動いているので触らない)。
- 矢印のキーボードフォーカス(`edgesFocusable`)の見直し。今回は `selectable` だけ変え、Tab で矢印に止まる既存の挙動はそのまま残す。
- 警告の矢印のボタン(`EdgeLabelRenderer` の層)がチップに重なる場合の扱い。今回の再現とは別の層なので、実機で再現したら別の仕様にする。
- 矢印のクリックで何かを表示する機能(矢印の選択・ハイライト)。要るとわかったら `onEdgeClick` を足す形で再検討する。
