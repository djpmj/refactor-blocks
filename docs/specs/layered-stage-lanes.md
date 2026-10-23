# layered-stage-lanes: 層を扱うステージでは、層ごとに段を分けて並べ、層を飛ばす・逆らう矢印を目立たせる

## 背景・目的

2026-10-17 に中級11「Controller に全部書いてある注文API」で、保存の処理を `OrderService` を通さず `OrderRepository` へ直接移したところ、
「層の依存の向き -10」で正しく減点された。ところがキャンバスでは `OrderController`・`OrderService`・`OrderRepository` の3つのファイルが**横一列に並んでいて**、

- どれが上の層・下の層なのかが図から読み取れない(クラス名の横の小さな `Controller` などの印だけ)
- どの矢印が層を飛ばしているのかが、ほかの矢印と同じ見た目で分からない

層(レイヤードアーキテクチャ)は「上から下への一方通行」を図で掴むのが本質なので、図の並びそのもので伝えたい。
`layered-architecture-stage` の仕様では「キャンバス上で層ごとに帯(レーン)を描く・自動で層ごとに並べるレイアウト」をスコープ外にしていた。今回これを入れる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/layoutCodebase.ts` | presentation | `stage.layers` があるステージでは、ファイルを層の順に上から段に並べる(どの層にも属さないファイルは一番下の段) |
| 新規 | `src/presentation/canvas/layerLanes.ts` | presentation | ファイルごとの段の番号を決める純粋関数 |
| 新規 | `src/presentation/canvas/layerLanes.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 段ごとに薄い帯と層の名前(`Controller` / `Service` / `Repository`)を背景に描く。層の違反の矢印に印を付ける |
| 変更 | `src/index.css` | presentation | 帯と違反の矢印の見た目 |
| 新規 | `e2e/layered-stage-lanes.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` は変更しない(ファイルの層は `domain/scoring/layers.ts` の `classLayers` で、層の違反は同じファイルの判定を使う)。

## データ・型の変更

なし。

## 見た目・動きの仕様

- 段の決め方: ファイルの中のクラスの層(`classLayers`)のうち、いちばん上の層の段に置く。層が決まらないファイル(空のクラスだけ・層の責務を持たないもの)は、最後の層の下の「未分類」の段に置く
- 段の中では、今の並べ方(左から右)を使う
- 段ごとに、キャンバスの幅いっぱいの薄い帯と、帯の左端に層の名前を描く(帯はクリック・ドラッグの邪魔をしない)
- 層の違反の矢印(下の層 → 上の層、または1つ以上の層を飛ばす)は、太い破線の赤にし、ラベル `層を飛ばしています` / `下の層から上の層を呼んでいます` を付ける
- 「整列」ボタンを押したときも同じ段の並びにする
- プレイヤーがファイルの箱を手で動かしたあとは、今どおりその位置を保つ(`freeze-file-positions`)。「整列」で段の並びに戻る
- `stage.layers` が無いステージは今のまま

## TDD対象の純粋関数

### `layerLanes(codebase, layers)`(`presentation/canvas/layerLanes.ts`)

- Controller・Service・Repository の3ファイル → それぞれ段 0・1・2
- 1つのファイルに Controller と Service のクラスがある → 段 0(上の層)
- 層が決まらないファイル → 段 3(未分類)

## 受け入れ基準

1. 中級11を開くと、`OrderController` のファイルが一番上の段、`OrderService` が中段、`OrderRepository` が下の段にあり、各段に層の名前の帯が出ている
2. 保存の処理を `OrderController` から `OrderRepository` へ直接移すと、`OrderController → OrderRepository` の矢印が赤い破線になり、`層を飛ばしています` と出る
3. 層のないステージ(例: 中級1)の並びは今と同じ
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 層の採点ルールの変更
- 層の割り当てをプレイヤーが変える操作
