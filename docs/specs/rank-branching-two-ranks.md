# rank-branching-two-ranks: 中級10の会員ランクを2つに減らし、同じ手順のくり返しをなくす

## 背景・目的

中級10(`intermediate-member-rank-branching`、会員ランクごとの if 分岐をクラスに分ける)の模範解答は21手ある。
通常・プレミアム・VIP の3ランクそれぞれに、次の7手をくり返す作りになっている。

1. ファイルを追加
2. クラスを追加
3. 価格の分岐を抽出
4. 価格のメソッドをそのクラスへ移す
5. 送料の分岐を抽出
6. 送料のメソッドをそのクラスへ移す
7. 実装するインターフェースに `MemberRank` を設定

2ランク目以降は同じ作業のくり返しで、学びが増えず、疲れて手が止まる。

ランクを「通常」「プレミアム」の2つに減らし、14手にする。
「新しいランクが増えても、クラスを1つ足すだけで済む」ことは、すでにある変更依頼「ゴールド会員を追加して」(extend)で体験させる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 中級10の初期コードから VIP の分岐(`frag-price-vip`・`frag-shipping-vip`)を除き、`classNames`・`methodNames`・説明文・行数の上限を2ランクに合わせる |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | 中級10の模範解答の手順から VIP の7手を除く |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 中級10の手数・点数を確かめるテストを2ランクに合わせる |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 中級10の章の文に VIP があれば直す |
| 変更 | 中級10を操作する既存の E2E | E2E | 2ランクに合わせる |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する |

`application` / `presentation` は変更しない。

## データ・型の変更

なし(ステージ定義の中身だけを変える)。

## ステージの変更

- 初期コード: `PriceCalculator.quotePrice` と `ShippingCalculator.quoteShipping` から、VIP の分岐の処理(`frag-price-vip`・`frag-shipping-vip`)を除く
- `classNames` / `methodNames` から `price-vip` / `shipping-vip` を除く
- `description`・`problem`・ステージ説明の「(通常/プレミアム/VIP)」を「(通常/プレミアム)」にする
- 行数の上限(`limits`)を、2ランクの初期コードで今と同じくらいの減点になるように見直す。基準は次の2つ
  - 初期状態で、`quotePrice` / `quoteShipping` が行数の上限を超えている
  - 模範解答で100点になる
- 変更依頼
  - `req-add-gold-rank`(ゴールド会員を追加して、extend)はそのまま。「価格も送料もゴールド用の計算にする」で、新しいランクをクラス1つで足す体験になる
  - `req-premium-shipping`(modify)はそのまま
- 模範解答: VIP の7手(ファイルを追加 → `VipRank` を追加 → 価格を抽出・移動 → 送料を抽出・移動 → インターフェースを設定)を除いた14手

## TDD対象の純粋関数

なし(ステージ定義の変更)。カタログのテストを先に直してから(手数 14、模範解答で100点、初期状態の点数)、ステージ定義を直す。

## 受け入れ基準

1. 中級10の初期コードに VIP の分岐が無く、説明文にも VIP が出てこない
2. 模範解答が14手で、模範解答どおりに操作すると100点になる
3. 初期状態で行数の上限を超えるメソッドがあり、点数は100点未満である
4. 変更依頼「ゴールド会員を追加して」で、解答例の置き方が新しいクラスとして `MemberRank` を実装する形になる
5. カタログのテスト・ヒント・解答の再生・既存の E2E が通る
6. `npm run check` と `npm run test:e2e` が通る。`npm run stage-report` を再生成してコミットする

## スコープ外

- 「同じ形で作る」のような、くり返しをまとめる新しい操作
- ほかのステージの手数の見直し
- `change-request-fairness`(#176)・`pain-request-alignment`(#181)で扱う、変更依頼の点数の見直し(中級10の `req-premium-shipping` の解答例 95点は #176 で扱う)
