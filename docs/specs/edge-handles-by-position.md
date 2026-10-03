# 矢印の出入り口を、ファイルの実際の位置関係で決める

## 背景・目的

キャンバスの依存・継承の矢印は、どの辺(上・下・左・右)から出てどの辺へ入るかを `layoutCodebase.ts` の `handleSides` が決めている。
ところが `handleSides` が見ているのは**自動レイアウト上の論理位置**(層 `row`・層内の並び `col`)であり、プレイヤーがファイルの箱を
ドラッグして動かした後の**実際の位置**ではない(`CodebaseCanvas.tsx` の `useFlowOverrides` が動かした座標を覚えているが、矢印は
`dependencyEdges(codebase)` / `inheritanceEdges(codebase)` がコードベースだけから作るため、動かしても再計算されない)。

その結果、ファイルを横に並べ直しても、層が違うままだと矢印は「呼ぶ側の下端 → 呼ばれる側の上端」のまま残り、
横並びの2ファイルをS字や大回りの線でつなぐ不自然な見た目になる(例: `BillingService.ts` の下端から `Subscription.ts` の上端へ、
横に並んだファイルの間を斜めに横切る線)。

矢印の出入り口を、**今画面にあるファイルの箱どうしの位置関係**から決め直す。横に並んでいれば横の線(右端↔左端)、
縦に並んでいれば縦の線(下端↔上端)になるようにし、ファイルをドラッグして動かしている最中も追従する。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/canvas/layoutCodebase.ts` | presentation | 変更 | `handleSides` を、論理位置(row/col)ではなく**ファイルの矩形**(`x, y, width, height`)から選ぶ形にする。`dependencyEdges` / `inheritanceEdges` が、`layoutCodebase`が返す(ドラッグ反映後の)ファイルノードの位置・大きさを受け取れるようにする |
| `src/presentation/canvas/layoutCodebase.test.ts` | presentation | 変更 | 位置関係による出入り口の選び方のテストを追加・更新する(TDD対象、下記) |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `edges` を、ドラッグ反映後の `nodes`(`arrangeNodes` の結果)から作り直す。動かすたびに再計算されるよう `useMemo` の依存に `nodes` を入れる |
| `e2e/refactor.spec.ts` もしくは新規 `e2e/edge-routing.spec.ts` | E2E | 追加 | ファイルを横並びに動かしたとき、矢印が左右の接続点につながることを確認する |

`TopRouteEdge.tsx` / `DependencyHandles.tsx` / `index.css` のハンドル位置は、接続点の種類(`left/right/top/bottom/skip`)を増やさない限り変更しない。

## 出入り口の選び方(新しいルール)

2つのクラスA(依存元)・B(依存先)について、それぞれを含む**ファイルの矩形**(ファイルノードの現在の `position` と `style.width/height`)を比べる。

1. **同じファイルのクラスどうし**: 従来どおり、ファイル内の縦の並び(`classIndex`)で上のクラスの下端→下のクラスの上端(`bottom`/`top`)
2. **別ファイルどうし**: ファイルの中心の差 `dx`, `dy` と、2つの矩形の隙間を比べて向きを決める
   - 横方向の隙間(Aの右端とBの左端の距離、またはその逆。矩形が横に重なっていれば0)が、縦方向の隙間より大きければ**横並び**とみなす
     → B が右にあれば A=`right` / B=`left`、B が左にあれば A=`left` / B=`right`
   - そうでなければ**縦並び**とみなす → B が下にあれば A=`bottom` / B=`top`、上にあれば A=`top` / B=`bottom`
   - 隙間が縦横とも同じ(完全に重なっている・斜め同距離)ときは縦並びを優先する(従来の見た目に近いほう)
3. **間に別ファイルを挟む場合の迂回(`skip`)**: A・Bが横並び(上のルールで `left/right` になる)で、AとBの中心を結ぶ線分が、
   A・B以外のファイルの矩形と交わるときは、従来どおり `skip`(上端から上へ引き上げて渡る `TopRouteEdge`)にする。
   `skip` のレーン割り当て(`assignTopLanes`)は、同じ高さの帯にあるファイルを `x` の小さい順に並べたときの順位を区間の端として使う
   (論理的な `col` ではなく実際の並びで重なりを判定する。ponytail: ファイルが多く密集していると最適なレーンにならない。そのときは `lane` を増やしてしのぐ)
4. 判定はすべて純粋関数(矩形の配列と、クラスID→ファイルIDの対応を受け取って `[sourceSide, targetSide]` を返す)にして単体テストできるようにする

自動レイアウト直後(ドラッグしていない状態)で、従来と見た目が変わらない・悪くならないこと。

## データ・型の変更

`dependencyEdges(codebase)` / `inheritanceEdges(codebase)` に、ファイルの現在の矩形を渡す引数を追加する
(例: `fileRects: ReadonlyMap<string, FileRect>`、`type FileRect = { x: number; y: number; width: number; height: number }`)。
`layoutCodebase(codebase)` が返す `CodebaseFlowNode[]`(ファイルノードの `position` と `style.width/height`)から作れるので、
呼び出し側(`CodebaseCanvas.tsx`、`preview/` の読み取り専用キャンバスなど他の呼び出し元)は `grep` で全部洗い出して揃える
(`CodebasePreviewCanvas.tsx` など、`dependencyEdges` を使っている箇所を直す)。`Codebase` などのドメイン型は変更しない。

## TDD対象の純粋関数

`layoutCodebase.test.ts` に、矩形から出入り口を選ぶ関数のテストを書く(AAA)。

1. Bが A のすぐ右(縦の位置が同程度)にある → `right` / `left`
2. Bが A のすぐ左にある → `left` / `right`
3. Bが A の真下(縦に離れ、横は重なる)にある → `bottom` / `top`
4. Bが A の真上にある → `top` / `bottom`
5. 斜め(右下)で、横の隙間のほうが大きい → `right` / `left`。縦の隙間のほうが大きい → `bottom` / `top`
6. 同じファイル内のクラスどうし → 従来どおり `classIndex` で上下
7. 横並びでAとBの間に別ファイルがあり、線分が交わる → `skip` / `skip`。別ファイルが線分からずれていれば `right` / `left`
8. 自動レイアウトのまま(ドラッグしていない)の既存ステージの代表例で、これまでの期待値(層が違えば `bottom`/`top`、同じ層の隣なら `right`/`left`)と
   同じになる(既存の `layoutCodebase.test.ts` のエッジ関連の期待値が、ほぼそのまま通ること。変わる箇所があれば理由をテスト名に書く)

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る(`rf__edge-dep-…` / `rf__edge-inherit-…` を探している既存E2Eが壊れていない)
- 任意のステージで2つのファイルの箱を左右に並べ直すと、それらをつなぐ矢印が**右端↔左端**につながり、ほぼ水平の線になる
- 上下に並べ直すと**下端↔上端**のほぼ垂直な線になる
- ファイルをドラッグしている最中も、矢印の出入り口が追従して切り替わる(ドラッグを離してから切り替わるのではない)
- 自動レイアウト直後(何も動かしていない)の矢印は、今までと同等の見た目
- 同じファイル内のクラスどうしの矢印・継承の矢印(白抜き)・循環依存の赤い矢印も、同じルールで位置関係に応じて出入りする
- 上のE2E(`e2e/` に追加)が、ファイルのドラッグで横並びにした後、矢印が右端・左端のハンドル(`source-right`/`target-left` のクラスが付く接続点)につながることを確認し、通る

## スコープ外

- 辺の経路をなめらかな曲線・直角折れ線など別の形に変えること(今の `BaseEdge` の描画のまま。出入り口を選び直すだけ)
- 接続点の位置(`class-node__handle--*` のCSSの割合)の調整、`top/bottom/left/right/skip` 以外の接続点の追加
- ファイルの自動レイアウト(層の割り当て)自体の変更、ドラッグした位置の保存(`localStorage` など)
- 複数の矢印が同じ点に集まったときの重なり回避(従来どおり、source/targetでずらすだけ)
