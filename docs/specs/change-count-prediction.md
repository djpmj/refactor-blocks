# change-count-prediction: 冒頭の手直しの前に「直す場所は何か所か」を予想させ、実際の数・読む量と並べて見せる

## 背景・目的

「手で直してみる」(`missed-fix-experience`)では、プレイヤーは印を付けてリリースし、直し忘れがあったかどうかを知る。
しかし、**手を動かす前に「この変更は何か所に効くか」を見積もる**練習にはなっていない。
実務では、変更依頼を受けた時点で「直す場所は2〜3か所だろう」と見積もり、実際に調べると5か所あった、というずれが工数超過や直し忘れにつながる。
そこで、手で直す前に「直す必要があるメソッドは何か所だと思うか」を予想させ、リリース後に予想と実際の数(と読む量)を並べて見せる。
ずれを繰り返し体験することで、散らばった設計では見積もりが外れやすいことを実感させる。

### 予想させるのは冒頭(`opening-fix`)だけにする

調査した結果、冒頭の手直しだけで予想させると決めた。理由は次のとおり。

- **冒頭は答えが隠れている**: `manual-fix-clarity` により、`stageStep === 'opening-fix'` の間は `ChangePainCard` が直す場所の数・メソッド名・読む行数を出さない。そのため予想が意味を持つ
- **仕上げ(`closing-fix`)の直前には答えが見えている**: 100点になる前の `refactor` の段階では、カードの `ModifyBefore` が `直す場所は今 N か所` と読む行数をその場で出し続ける。100点になって `closing-fix` に入った時点で、プレイヤーはもう数を見ている。さらに、自分で組み替えたコードなので、予想は答え合わせにならない
- **仕上げにはもう比較がある**: `closing-fix` の正解後は `FixComparison` と答え合わせ画面(`change-impact-review`)が「冒頭 → 今回」の比較を出している。予想の行を足すと、同じ画面に比較が3つ並ぶ

`refactor` の段階での任意の手直し(直す場所が2か所以上のときに出る「実際に直してみる」)と `closing-fix` では、予想を求めない。今の動きを変えない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/change/prediction.ts` | domain | 予想と実際の直す場所の数を比べる純粋関数 `comparePrediction` |
| 新規 | `src/domain/change/prediction.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/stage/describePrediction.ts` | presentation | 入力文字列を予想の数に変換する `parsePrediction` と、比較の文を組み立てる `describePrediction`(どちらも純粋関数) |
| 新規 | `src/presentation/stage/describePrediction.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `ManualFix` に `prediction` を足す。`setPrediction` を足す。予想が決まるまで、冒頭の手直しでは `toggleFixed` と `releaseManualFix` を受け付けない |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 上のストアの動きのテスト |
| 変更 | `src/presentation/stage/ManualFixPanel.tsx` | presentation | 冒頭の手直しで予想が無いときに予想の入力欄(`PredictionForm`)を出す。冒頭の結果に予想と実際の比較(`PredictionComparison`)を出す |
| 変更 | `src/presentation/canvas/MethodChip.tsx` | presentation | `ManualFixCheck` を、冒頭の手直しで予想が決まるまで出さない |
| 変更 | `src/presentation/tour/tourSteps.ts` | presentation | 手順3の文に「まず何か所か予想して決める」を足す |
| 変更 | `src/index.css` | presentation | 予想の入力欄と比較の行のスタイル(既存の `.manual-fix` の中に収める) |
| 変更 | `e2e/selectStage.ts` | E2E | `answerPrediction(page, value)` を足し、`releaseAllManualFixSites` で予想の入力欄が出ていたら先に答える |
| 変更 | 冒頭の手直しで直接チェックボックスを押している既存の E2E(`e2e/` を `実際に直してみる` で grep して洗い出す。`manual-fix.spec.ts`・`manual-fix-clarity.spec.ts`・`first-visit-tour.spec.ts` など) | E2E | 印を付ける前に `answerPrediction` を挟む |
| 新規 | `e2e/change-count-prediction.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`application` / `infrastructure` は変更しない(ストアが `comparePrediction` を直接呼ぶ必要もない。表示のときに `ManualFixResult.sites` と比べるだけなので、`checkManualFix` と同じく presentation から domain を呼ぶ)。新しい依存は足さない。

## データ・型の変更

### domain

```ts
// src/domain/change/prediction.ts

/** 直す場所の数の予想と、実際の数の比較。 */
export type PredictionGap = {
  readonly predicted: number;
  readonly actual: number;
  /** |predicted - actual| */
  readonly difference: number;
  /** 'exact' = 一致、'under' = 実際のほうが多い(少なく見積もった)、'over' = 実際のほうが少ない(多く見積もった)。 */
  readonly verdict: 'exact' | 'under' | 'over';
};

export function comparePrediction(predicted: number, actual: number): PredictionGap;
```

- `predicted` が正の整数であることの検証は、入力の境界(`parsePrediction`)で行う。`comparePrediction` は受け取った数をそのまま比べる
- `actual` は `checkManualFix(...).sites`(= 冒頭のコードの `findChangeSites` の数)を渡す

### presentation(ストア)

```ts
type ManualFix = {
  readonly fixedIds: readonly string[];
  readonly released: boolean;
  readonly viewedMethodId: string | null;
  readonly step: StageStep;
  /** 冒頭の手直しで決めた「直す場所は何か所か」の予想。未決定・冒頭以外は null。 */
  readonly prediction: number | null;
};
// NEW_MANUAL_FIX に prediction: null を足す
```

- `setPrediction: (value: number) => void` を `GameState` と `manualFixActions` に足す
  - `manualFix !== null`・`!released`・`step === 'opening-fix'`・`prediction === null` のときだけ `prediction` を入れる。それ以外は何もしない(一度決めた予想は変えられない。印を付けてから予想し直すのを防ぐ)
- `toggleFixed`: `manualFix.step === 'opening-fix' && manualFix.prediction === null` のときは何もしない
- `releaseManualFix`: 同じ条件のときは何もしない
- `restartManualFix`: 今どおり `NEW_MANUAL_FIX` に戻すので、`prediction` も `null` に戻る
- `OpeningFix`(`openingFixes` に残す冒頭の結果)には予想を**足さない**。予想の比較は冒頭の結果画面の中だけで見せる(下記スコープ外)

### presentation(純粋関数)

```ts
// src/presentation/stage/describePrediction.ts

/** 入力欄の文字列を予想の数にする。前後の空白は無視。1以上 max 以下の整数でなければ null。 */
export function parsePrediction(text: string, max: number): number | null;

/** 予想と実際の比較を、表示する文の並びにする。1要素が1行。 */
export function describePrediction(gap: PredictionGap, readLines: number): readonly string[];
```

`max` は今のコードのメソッドの総数(`allClasses(codebase).flatMap((c) => c.methods).length`)。直す場所の数そのものは渡さない(答えを漏らさない)。

## 動きの仕様

### 予想の入力(`ManualFixPanel` の `PredictionForm`)

- 出す条件: `manualFix !== null`・`!manualFix.released`・`manualFix.step === 'opening-fix'`・`manualFix.prediction === null`
- このとき `FixInput`(印の案内・「直した印: N 個」・「リリースする」)の代わりに出す。「やめる」ボタンは残す(`endManualFix`)
- 中身(`<form>`。送信は `preventDefault` して `setPrediction`)
  - 案内: `印を付ける前に、見積もってみよう。メソッドをクリックすると中身が右に出ます`
  - ラベル付きの数値入力: ラベル `直す必要があるメソッドは何か所だと思う?`、`<input type="number" min="1" max={max} step="1" inputMode="numeric">`、初期値は空
  - 補足: `1〜{max} の数で入力してください`
  - 送信ボタン `予想を決める`(`type="submit"`)。`parsePrediction(入力, max) === null` の間は `disabled`
  - Enter キーでも送信できる(ネイティブの form の動き)
- 予想を決めている間も、メソッドのクリック(`viewManualFixMethod`、右に中身が出る)は今どおりできる。読んでから見積もってよい
- 予想を決めるまで、メソッドチップの「直した」チェックボックス(`ManualFixCheck`)は出さない
- 予想を決めたら `FixInput` に切り替わり、その上に `あなたの予想: N か所` を1行出す(リリースまで)
- カード(`ChangePainCard`)・バナー(`OpeningFixBanner`)は変えない。直す場所の数は今どおり冒頭では出さない

### 予想と実際の比較(`PredictionComparison`)

- 出す条件: `manualFix.released`・`manualFix.step === 'opening-fix'`・`manualFix.prediction !== null`
- `ResultView` の `FixResultStatus` のすぐ下、`PainSummary` の上に、`data-testid="prediction-comparison"` の中に `describePrediction(comparePrediction(prediction, result.sites), readLines)` の各行を `<p>` で出す
  - `readLines` は `PainSummary` と同じ `measurePain(stage, codebase)?.current.readLines ?? 0`
- `describePrediction` の文
  1. 1行目(常に): `予想 N か所 → 実際 K か所(読む量 R 行)`
  2. 2行目(`verdict` で切り替え)
     - `'exact'`: `予想どおりでした。組み替えたあと、同じ変更の直す場所がどう変わるかも確かめよう`
     - `'under'`: `実際は予想より D か所多くありました。同じ処理が散らばっていると、直す場所は見積もりより増えがちです`
     - `'over'`: `実際は予想より D か所少なくありました。関係のない場所まで直す見積もりになっていないか、見直してみよう`
- 色だけに頼らず文で示す。比較の行は `role="status"` の外に置く(`FixResultStatus` の読み上げと重ねない)

### ツアー(`tourSteps.ts` の手順3)

`text` を次にする(`advance` は変えない):
`メソッドをクリックすると中身が右に出ます。まず直す必要があるメソッドが何か所か予想して「予想を決める」を押そう。次に、直す必要があるメソッドの右のチェックボックスで「直した」印を付け、左の「リリースする」を押そう。結果を読んだら「組み替えを始める」へ。`

## TDD対象

### `comparePrediction`(domain, `src/domain/change/prediction.ts`)

- 予想 2・実際 2 → `{ predicted: 2, actual: 2, difference: 0, verdict: 'exact' }`
- 予想 1・実際 3 → `difference: 2`、`verdict: 'under'`
- 予想 4・実際 1 → `difference: 3`、`verdict: 'over'`
- 境界: 予想 1・実際 0(依頼の責務が無い) → `difference: 1`、`verdict: 'over'`(例外を投げない)

### `parsePrediction`(presentation, `src/presentation/stage/describePrediction.ts`)

- `'3'`, max 10 → `3`
- `' 3 '`, max 10 → `3`(前後の空白は無視)
- `'10'`, max 10 → `10`(上限ちょうどは有効)
- `'11'`, max 10 → `null`
- `''` / `'0'` / `'-1'` / `'2.5'` / `'abc'` / `'1e1'` → `null`

### `describePrediction`(presentation, `src/presentation/stage/describePrediction.ts`)

- `exact`(2・2)、readLines 39 → `['予想 2 か所 → 実際 2 か所(読む量 39 行)', '予想どおりでした。…']`
- `under`(1・3) → 2行目が `実際は予想より 2 か所多くありました。…`
- `over`(4・1) → 2行目が `実際は予想より 3 か所少なくありました。…`

### ストア(`useGameStore.test.ts`)

- 冒頭の手直しを始めた直後は `manualFix.prediction === null`
- 冒頭で予想が無いとき、`toggleFixed` しても `fixedIds` は空のまま。`releaseManualFix` しても `released` は `false` のまま、`openingFixes` に記録されない
- `setPrediction(2)` のあとは `prediction === 2` になり、`toggleFixed` と `releaseManualFix` が今どおり効く
- `setPrediction` を2回呼んでも、最初の値のまま
- `refactor` / `closing-fix` の段階で始めた手直しでは、予想なしで `toggleFixed` と `releaseManualFix` が今どおり効く。`setPrediction` は何もしない
- `restartManualFix` で `prediction` が `null` に戻る

`PredictionForm` / `PredictionComparison` の出し分け、チェックボックスの出し分け、キーボード操作は表示の変更なので E2E で確かめる。

## 受け入れ基準

1. 初級1「何でも屋の UserController」を開き、冒頭の「実際に直してみる」を押すと、`直す必要があるメソッドは何か所だと思う?` の入力欄と `予想を決める` ボタンが出る。このとき `UserController.registerUser() を直した` のチェックボックスと「リリースする」ボタンは出ていない
2. 1の状態で入力欄が空・`0`・メソッドの総数より大きい数のとき、`予想を決める` は押せない(`disabled`)
3. 1の状態でもメソッドをクリックすると中身が右に出る
4. 入力欄に `1` を入れて Enter を押すと、チェックボックスと「リリースする」が出て、`あなたの予想: 1 か所` が出る
5. 4のあと `registerUser` だけに印を付けてリリースすると、`prediction-comparison` に `予想 1 か所 → 実際 2 か所(読む量 R 行)`(R は数字)と `実際は予想より 1 か所多くありました` が出る。直し忘れの表示(`⚠ 直し忘れ 1 か所`)と `manual-fix-clarity` の文(`直す 2 か所は、どれも UserController の中です`)も今どおり出る
6. 予想 `2` で2か所とも印を付けてリリースすると、`予想どおりでした` が出る
7. 冒頭の手直しを終えて組み替え、`refactor` の段階で「実際に直してみる」を押したとき、および `closing-fix` の手直しでは、予想の入力欄は出ず、すぐにチェックボックスが出る。結果に `prediction-comparison` は出ない
8. 下書きから再開したステージ(冒頭の手直しが済んだ扱い)では、予想の入力欄は出ない
9. 初回のツアーで手順3の文に「予想を決める」が含まれ、ツアーに沿って予想 → 印 → リリース → 組み替えを始める、まで進める
10. 冒頭の手直しの間、カードとバナーに直す場所の数・メソッド名が出ない(`manual-fix-clarity` の受け入れ基準1が今どおり通る)
11. `npm run check` と `npm run test:e2e` が通る(`e2e/selectStage.ts` の `completeOpeningFix` を使う既存の E2E を含む)

## スコープ外

- **仕上げ(`closing-fix`)・`refactor` 段階の手直しでの予想**: 上の「予想させるのは冒頭だけ」の理由による。仕上げで答えが見えない作りに変えたときに検討する
- **読む行数の予想**: 要求は「何か所か」の予想だけ。行数は比較の行に実測として並べるだけにする。本当に行数の見積もりも要るかは、遊んでずれの体験が足りないと分かってから
- **予想の保存・履歴・統計**(`OpeningFix` や `localStorage` への記録、ステージをまたいだ的中率の表示): 1回の比較で体験としては足りる。見積もり力の推移を見せたくなったら `OpeningFix` に `predicted` を足す
- **答え合わせ画面(`ChangeImpactDialog`)・`FixComparison` への予想の表示**
- **予想の点数化・減点**(`missed-fix-experience` と同じく体験に留める)
- **変更依頼に挑戦(`changeSession`)・ボス依頼・新しい種類を足す依頼(`extend`)での予想**
- 予想の入力を選択式(ボタン)にすること。数値入力で足りる
