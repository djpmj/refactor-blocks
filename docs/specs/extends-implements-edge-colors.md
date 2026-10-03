# 継承(extends)と実装(implements)の矢印の色を分ける

## 背景・目的

キャンバスの矢印のうち、親クラスへの継承(`extends`)とインターフェースへの実装(`implements`)は、どちらも
`inheritanceEdges`(`src/presentation/canvas/layoutCodebase.ts`)が `className: 'edge--inheritance'` を付けて描いており、
`src/index.css` の `.edge--inheritance` で**同じアクセント色(青)・同じ実線**になっている。

そのため、`extends` の線と `implements` の線が見分けられない。特に上級3(`DiscountStrategy` を3つの割引クラスが実装)や
上級8(基底クラスの継承とインターフェースの実装が混在)で、「これは継承か、実装か」を線から読み取れない。
`extends`(実装を引き継ぐ、結合が強い)と `implements`(契約だけを共有する、結合が弱い)の違いは、このゲームで
設計の良し悪しを学ぶ核心なので、線の色で一目で区別できるようにする。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/canvas/layoutCodebase.ts` | presentation | 変更 | `inheritanceEdges` が、辺が `extends`(`superclassId`)由来か `implements`(`interfaceIds`)由来かを区別し、`className` を `edge--inheritance edge--extends` / `edge--inheritance edge--implements` にする。辺のID(`inherit-<子>-<親>`)・`edge--inheritance` クラスは変えない(既存E2Eが使っている)。矢じり(`markerEnd`)にも対応する色を付ける |
| `src/presentation/canvas/layoutCodebase.test.ts` | presentation(test) | 変更 | 辺の種類の判定のテストを追加(TDD、下記) |
| `src/presentation/canvas/SuperclassLabel.tsx` | presentation | 変更 | クラス名の後ろの `extends 親` と `implements A, B` の、`extends` / `implements` の文字をそれぞれ辺と同じ色にする(線と色で対応が取れるように) |
| `src/index.css` | presentation | 変更 | 色の変数 `--edge-extends` / `--edge-implements` をライト・ダーク両方に定義し、`.edge--extends` / `.edge--implements` の `stroke` と、`SuperclassLabel` の文字色に使う。実装の線は点線にする(下記) |
| `e2e/` の継承に関する既存spec | E2E | 追加 | `extends` の辺と `implements` の辺で、付くクラスが異なることを確認する |

## 見た目の仕様

| 種類 | 色(変数) | 線種 | 矢じり |
| --- | --- | --- | --- |
| 継承(extends) | `--edge-extends`(既存のアクセント色と同じ青系。ライト `#4f6bed` / ダーク `#7c93ff`) | 実線 | 同色 |
| 実装(implements) | `--edge-implements`(オレンジ系。ライト `#d9730d` / ダーク `#f0a050`) | 点線(`stroke-dasharray: 6 4`) | 同色 |

- 青とオレンジは色覚多様性でも区別しやすい組み合わせ。色だけに頼らず点線でも区別する(アクセシビリティ。`FileNode` の警告マークと同じ考え方)
- 依存の矢印(グレー)・循環依存の赤い矢印とも区別できる色にする。可視性のマーク(`--public`/`--protected` など)の色とは別の変数にし、既存変数を流用しない
- 矢じり: 辺と同じ色。`edge-handles`/`inheritance-arrow-clarity`(Issue #42)が先にマージされて矢じりが SVG `<marker>`(`#inheritance-arrow`)になっている場合は、
  実装用にもう1つ `#implements-arrow` を定義して `extends`/`implements` で別々に参照する(白抜き三角の枠線の色を、それぞれ `--edge-extends` / `--edge-implements`)。
  #42 が未マージなら、`markerEnd: { type: MarkerType.Arrow, color }` に色を指定する形でよい
- 1つのクラスが `extends` と `implements` の両方を持つ場合も、辺ごとにそれぞれの色になる
- `edge--cyclic`(循環依存の赤)は継承の辺には付かないので影響しない

## データ・型の変更

なし。`Codebase` の型は変更しない。辺の `className` と `markerEnd` が増えるだけ。

## TDD対象の純粋関数

`layoutCodebase.ts` で、辺の種類(`extends` / `implements`)を判定する小さな純粋関数(例: `inheritanceKind(codeClass, parentId): 'extends' | 'implements'`)を
切り出してテストする(AAA)。`parentIds` の順序(継承元 → 実装先)に依存せず、`codeClass.superclassId === parentId` かどうかで判定する。

1. `superclassId` と一致する親 → `'extends'`
2. `interfaceIds` に含まれる親 → `'implements'`
3. `superclassId` と `interfaceIds` の両方を持つクラスで、それぞれの親 → 各々 `'extends'` / `'implements'`
4. 同じIDが両方に入っているという不整合な状態(通常は起きない)→ `'extends'` を優先する

`inheritanceEdges` のテスト: `extends` の辺の `className` に `edge--extends` が、`implements` の辺に `edge--implements` が含まれ、
どちらにも `edge--inheritance` が残っている。辺のIDは従来と同じ。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る(`rf__edge-inherit-…` と `edge--inheritance` を探す既存E2Eが変更なしで通る)
- 上級3で、`DiscountStrategy` への3本の実装の線が**オレンジの点線**で表示される
- 継承(extends)の線が**青の実線**で表示され、同じ画面に両方があるステージ(上級8など)で見分けられる
- クラスの枠の `extends 親` / `implements A, B` の文字の色が、対応する線の色と同じになっている
- ライトモード・ダークモードどちらでも、両方の色が背景から読み取れる
- 「設計くらべ」・「変更前の図を見る」・「解答例の図を見る」(読み取り専用キャンバス)でも同じ色・線種になる
- 依存の矢印(グレー)・循環依存の赤い矢印の見た目は変わらない
- E2E(`e2e/` に追加): `extends` の辺に `edge--extends`、`implements` の辺に `edge--implements` が付いている

## スコープ外

- 凡例(色と意味の説明パネル)の表示。必要になったら別タスクで足す
- 矢印の経路・着地点・矢じりの大きさの変更(`inheritance-arrow-clarity`(Issue #42)の担当)
- 依存の矢印の色の変更
- 色をプレイヤーが選べる設定
- 「継承のやり方が分からない」(右クリックメニュー `継承元を設定` / `実装するインターフェースを設定` の見つけやすさ)は別の要求。今回は扱わない
