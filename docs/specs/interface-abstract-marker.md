# interface-abstract-marker: インターフェース役・抽象クラス役のクラスに印を付ける

## 背景・目的

2026-10-17 に中級10「会員ランクごとのif分岐をクラスに分ける」と上級3「Strategy」を遊んで、
`MemberRank`(処理の説明に「MemberRank(インターフェース)経由で価格と送料を求める」とある)や `DiscountStrategy` が、
キャンバス上では**普通のクラスとまったく同じ見た目**だった。中身の無い契約メソッドが `+ calculatePrice() 3行` と並ぶだけで、
「ここに処理を入れるのではなく、実装するクラスを作るのだ」ということが図から読み取れない。

採点・置き方の判定では、すでに `isInterfaceLike`(メソッドがすべて public で中身が無い)と `isAbstractLike` で役割を判定している(`domain/codebase/Codebase.ts`)。表示だけがそれを使っていない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/ClassNode.tsx` | presentation | クラス名の上に `«interface»` / `«abstract»` の印を出し、枠の見た目を変える |
| 変更 | `src/presentation/canvas/MethodChip.tsx` | presentation | 中身の無い契約メソッドは行数の代わりに `中身なし` と出し、斜体にする |
| 変更 | `src/index.css` | presentation | 上の見た目 |
| 変更 | 解答例の図・設計くらべなどのプレビュー(`CodebasePreviewCanvas`) | presentation | 同じ `ClassNode` を使っていれば自動で反映される。使っていなければ同じ印を出す |
| 新規 | `e2e/interface-abstract-marker.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` は変更しない(`isInterfaceLike` / `isAbstractLike` を使う)。

## データ・型の変更

なし。

## 見た目の仕様

- `isInterfaceLike(codeClass)` が真 → クラス名の上に小さく `«interface»`、枠を破線にする
- そうでなく `isAbstractLike(codeClass)` が真 → クラス名の上に小さく `«abstract»`、クラス名を斜体にする
- どちらでもない → 今のまま
- 契約メソッド(処理が0個のメソッド)は、行数の欄に `中身なし` と出し、名前を斜体にする。行数の合計(クラス・ファイルの行数)の計算は変えない
- 読み上げ: クラスの見出しの読み上げ名の先頭に `インターフェース` / `抽象クラス` を付ける
- 印は判定から自動で付く(ステージのデータに「これはインターフェース」と書く項目は足さない)

## TDD対象の純粋関数

`domain` に新しいロジックは無い。印の文字を選ぶ小さな関数 `classStereotype(codeClass): 'interface' | 'abstract' | null` を `presentation/canvas/` に置き、テストする。

- メソッドがすべて public・中身なし → `interface`
- `isAbstractLike` が真で、上に当てはまらない → `abstract`
- メソッドが0個のクラス → `null`(空のクラスはインターフェースにしない。`isInterfaceLike` と同じ)
- 中身のあるメソッドだけ → `null`

## 受け入れ基準

1. 中級10を開くと、`MemberRank` に `«interface»` が出て、`calculatePrice()` の行数の欄が `中身なし` になっている
2. `PriceCalculator` などの普通のクラスには印が出ない
3. 上級3の解答例の図で、インターフェース役のクラスに `«interface»` が出る
4. クラスの行数・点数は今と同じ
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 継承・実装の矢印の見た目(`extends-implements-edge-colors` で扱い済み)
- インターフェースを作る操作の追加
