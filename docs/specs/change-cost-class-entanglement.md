# change-cost-class-entanglement: 変更のしやすさで、クラスに混ざった別の責務も「巻き込み」として数える

## 背景・目的

2026-10-17 に白紙設計「白紙1: 注文と発送」で、`placeOrder()`(注文の流れ)と `calculateOrderTax()`(税)を**同じクラス**に置いて答え合わせをした。
すると変更依頼「軽減税率に対応して」の点数が **あなたの設計 100点 / 模範解答 95点** になり、責務を混ぜた設計の方が高く出た。

原因は変更のしやすさの採点(`measureChange` → `scoreChange`)にある。

- **巻き込み**(`mixedResponsibilities`)は、変更箇所の**メソッドの中**にある別の責務しか数えない。
  `calculateOrderTax()` 自体は税の処理だけなので、同じクラスに注文の流れが同居していても0になる
- **波及**(`rippleClasses`)は、変更したクラスを呼んでいるクラスを1つにつき5点引く。模範解答は `OrderService` が `TaxCalculator` を呼ぶので -5 になる

つまり「分けると波及で引かれ、混ぜても巻き込みで引かれない」ため、白紙設計の教えたいこと(変わる理由ごとにクラスを分ける)と点数が逆になる。
同じ採点はリファクタリングモードの「変更のしやすさ」にも使われている。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/change/measureChange.ts` | domain | 変更するクラスに同居する、依頼と無関係な責務の種類数(`classMixedResponsibilities`)を数える |
| 変更 | `src/domain/change/measureChange.test.ts` | domain | 上のテスト |
| 変更 | `src/domain/change/scoreChange.ts` | domain | 新しいルール `entangled-class` を足す |
| 変更 | `src/domain/change/scoreChange.test.ts` | domain | 上のテスト |
| 変更 | 減点の理由の表示(`presentation/change/` の減点ルール名・説明の表、`describeScore` 相当) | presentation | `entangled-class` の名前と説明を足す |
| 変更 | 変更のしやすさの点数を固定値で確かめている既存のテスト・E2E | テスト | 新しい点数に合わせる |
| 変更 | `docs/stages/report.md` | docs | `npm run stage-report` で作り直す |

## データ・型の変更

- `ChangeImpact` に `readonly classMixedResponsibilities: number` を足す
  - 変更するクラス(`touchedClasses`)ごとに、**変更箇所のメソッド以外**のメソッドの処理の責務のうち、依頼の責務・`call` と違うものの種類数を数え、クラスについて合計する
  - 変更箇所のメソッドの中の別の責務は、今どおり `mixedResponsibilities` で数える(二重に数えない)
- `ChangeRule` に `'entangled-class'` を足す。1種類につき 5点(`entangled` と同じ)
- 表示名は `巻き込み(クラス)`、説明は `直すクラスに、この変更と関係のない処理が同居している。直すときに読む量が増え、巻き込んで壊すおそれもある`

## TDD対象の純粋関数

### `measureChange`(`domain/change/measureChange.ts`)

- 税のメソッドだけのクラスで税の変更 → `classMixedResponsibilities` は 0
- 税のメソッドと注文の流れのメソッドが同じクラスで税の変更 → 1
- 税・保存・通知のメソッドが同じクラスで税の変更 → 2
- 変更箇所が2クラスにまたがる → クラスごとの数の合計
- `call` だけのメソッドが同居していても数えない

### `scoreChange`(`domain/change/scoreChange.ts`)

- `classMixedResponsibilities: 1` → `entangled-class` の減点が 5点
- 既存のルールの点数は今のまま

## 受け入れ基準

1. 白紙1で `placeOrder()` と `calculateOrderTax()` を同じクラスに置き、残りを模範解答どおりに置いて答え合わせすると、「軽減税率に対応して」の点数が模範解答(95点)以下になる
2. 白紙1の模範解答の点数は今と同じ
3. `stageCatalog.test.ts` の「解答例の設計では100点」「組み替える前より解答例の方が高い」などの既存の保証が、全ステージで今どおり成り立つ
   (成り立たないステージが出たら、そのステージの解答例か変更依頼のデータを直してそろえる。採点ルールの側は変えない)
4. `npm run stage-report` で `docs/stages/report.md` を作り直し、差分をPRに含める
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 波及(`ripple`)の点数の見直し
- 置き方(`scorePlacement`)の採点の見直し
