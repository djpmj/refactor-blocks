# change-request-sample-on-ideal-base: 変更依頼の解答例を、前の依頼の置き間違いに引きずられずに出す

## 背景・目的

2026-10-17 に初級2「クラスを自分で作る」で変更依頼に挑戦し、依頼1「請求書PDFのレイアウトを変えて」の部品 `adjustPdfLayout()` を、
わざと描画のクラス(`InvoicePdfRenderer`)ではなく `InvoiceService` に置いた。依頼1の結果は「置き方 90点、解答例: 既存の InvoicePdfRenderer に置く」で正しい。

ところが依頼3(鬼の変更)「請求書の描画を、PDFだけでなくHTMLや多言語まで含めて作り直して」の結果が
**「解答例: 既存の InvoiceService に置く(100点)」**になった。「解答例の図を見る」を開くと、依頼1で私が誤って置いた `adjustPdfLayout()` が `InvoiceService` に残っていて、
そのせいで `InvoiceService` が描画の責務を持つクラスとして扱われ、描画の作り直しの置き場所に選ばれていた。

変更依頼は前の依頼の実装の上に積み重なる(`ChangeSession.carried`、`implement-change-request`・`change-request-fairness`)。
置き方の点数をプレイヤーの実際のコードで測るのは正しいが、**解答例(お手本)まで間違いの上で作る**と、
「描画の作り直しはサービスクラスに置くのが正解」と、クラス設計として逆のことを教えてしまう。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/application/ChangeRequestUseCases.ts`(依頼の評価で解答例を求める箇所) | application | 解答例を「挑戦前のコードに、前の依頼までの**解答例の置き方**を当てたコード」で求める |
| 変更 | `src/application/ChangeRequestUseCases.test.ts` | application | 上のテスト |
| 変更 | `src/domain/change/sampleImplementation.ts`(必要なら) | domain | 前の依頼の解答例を順に当てる小さな関数 `sampleCarried` を足す |
| 変更 | `src/domain/change/sampleImplementation.test.ts` | domain | 上のテスト |
| 変更 | `src/presentation/store/useGameStore.ts`(`ChangeSession`・`finishImplementation`) | presentation | `sampleCarried` を持ち、依頼の評価へ渡す |
| 変更 | 変更依頼の結果カード(`presentation/change/ChangeRequestPanel.tsx`) | presentation | 前の依頼で解答例と違う場所に置いていたとき、`解答例は、前の依頼もすべて解答例どおりに置いた場合の置き場所です` と1行添える |
| 新規 | `e2e/change-request-sample-on-ideal-base.spec.ts` | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

- `ChangeSession` に `sampleCarried: Codebase` を足す(挑戦開始時は `base`。依頼を終えるたびに、その依頼の解答例の置き方を `sampleCarried` に当てて更新する)
- 置き方の点数・変更コスト(`current`)は今どおり `carried`(プレイヤーの実際のコード)で測る。**変えるのは解答例(`sample`)と、解答例の図の土台だけ**
- 鬼の変更の比較(`bossCounterfactual`)は今どおり

## TDD対象の純粋関数

### `sampleCarried(base, requests)`(`domain/change/sampleImplementation.ts`)

- 依頼が0件 → `base` のまま
- 依頼1・2 → `base` に依頼1の解答例の置き方を当て、その上に依頼2の解答例の置き方を当てたコード
- 元の `base` を変更しない

### 変更依頼の評価(application)

- 依頼1で部品を解答例と違うクラスに置いても、依頼3の解答例は、依頼1を解答例どおりに置いた場合と同じ置き場所になる
- 依頼1を解答例どおりに置いたときは、今と同じ結果

## 受け入れ基準

1. 初級2で解答例どおりに100点にし、変更依頼1の部品を `InvoiceService` に置いて進めると、依頼3(鬼の変更)の解答例が `InvoicePdfRenderer` になる
2. そのとき依頼3の結果カードに `解答例は、前の依頼もすべて解答例どおりに置いた場合の置き場所です` が出る
3. 全依頼を解答例どおりに置いたときの結果(点数・解答例・文)は今と同じ
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 置き方の点数の計算方法の変更
- 1件ごとに置き直せるようにすること(`change-request-step-feedback` で扱う)
