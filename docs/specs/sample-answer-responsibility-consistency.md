# sample-answer-responsibility-consistency: 解答例で、同じ責務の処理を複数のクラスに散らさない

## 背景・目的

2026-10-17 に初級2「クラスを自分で作る」を解いて解答例の図と見比べると、**解答例そのものが責務を散らしていた**。

- 解答例は `InvoiceStorage` を作り、「PDFをストレージに保存する」(責務 `storage`)を `storePdf()` として移している
- ところが同じ責務 `storage` の「送信履歴を記録する」(`frag-record-history`)は、`InvoiceService.sendInvoice()` に残したまま
- 採点上は `InvoiceService` の責務が2種類(上限2)なので100点だが、「保存の仕事は保存のクラスへ」という初級2の教えと、お手本の形が食い違う

プレイヤーは解答例を「正しい形」として真似るので、解答例が採点の上限ぎりぎりの妥協になっていると、クラス設計の考え方を誤って覚える。
ほかのステージにも同じような解答例が無いか、テストで点検できるようにする。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/stage/scatteredResponsibilities.ts` | domain | コードベースの中で、同じ責務の処理(`call` を除く)を持つクラスが2つ以上ある責務を列挙する |
| 新規 | `src/domain/stage/scatteredResponsibilities.test.ts` | domain | 上のテスト |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 全ステージの解答例(`sampleAnswerCodebase`)について、散らばった責務が無いことを確かめる。意図して散らしているステージは、例外の表(ステージID・責務・理由)に書いたものだけ許す |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | 初級2の解答例に、「送信履歴を記録する」の抽出と `InvoiceStorage` への移動を足す。ほかに点検で見つかったステージも直す |
| 変更 | 初級2の解答例に依存するテスト・E2E・`docs/stages/report.md` | テスト/docs | 新しい解答例に合わせる(`npm run stage-report` で作り直す) |

## データ・型の変更

```ts
export type ScatteredResponsibility = { readonly responsibility: string; readonly classIds: readonly string[] };
export function findScatteredResponsibilities(codebase: Codebase): ScatteredResponsibility[];
```

- インターフェース役・抽象クラス役のクラスは数えない(実装クラスごとに同じ責務を持つのは正しい形のため)
- 継承関係にあるクラス同士(親と子、兄弟)で同じ責務を持つのは数えない(Template Method・Strategy の各実装のため)

## 例外の表の書き方(stageCatalog.test.ts)

```ts
const ALLOWED_SCATTER: readonly { stageId: string; responsibility: string; reason: string }[] = [
  // 例: { stageId: '...', responsibility: '...', reason: 'Controller ごとに検証を持つのが自然なため' },
];
```

- 実装時に全ステージを点検し、直すべきものは解答例を直す。直さない(意図した)ものだけ理由つきで表に入れる
- 表に入れたものはPRの説明に一覧で書く

## TDD対象の純粋関数

### `findScatteredResponsibilities`(`domain/stage/scatteredResponsibilities.ts`)

- 責務 `storage` の処理が `InvoiceStorage` と `InvoiceService` にある → `[{ responsibility: 'storage', classIds: [...2件] }]`
- 同じ責務が1クラスだけ → 空
- 兄弟の実装クラス(同じインターフェースを実装)に同じ責務 → 空
- 呼び出し行(`call`)だけが別クラスにある → 空

## 受け入れ基準

1. 初級2の解答例の図で、`InvoiceStorage` に `storePdf()` と送信履歴の記録の両方があり、`InvoiceService` に保存の処理が無い
2. 初級2の解答例の点数は100点のまま、変更依頼の「解答例の設計では100点」などの既存の保証も成り立つ
3. `stageCatalog.test.ts` に、全ステージの解答例の点検が入っている
4. `npm run stage-report` で `docs/stages/report.md` を作り直し、差分をPRに含める
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 責務の散らばりを採点で減点すること(今回は解答例の点検だけ)
