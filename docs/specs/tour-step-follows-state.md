# tour-step-follows-state: 初回ツアーの最後の文を抽出の結果で出し分け、手順4を飛ばさない

## 背景・目的

学習者としてチュートリアル1の初回ツアー(`src/presentation/tour/tourSteps.ts` の `TOUR_STEPS`、`SpotlightTour`)を実機で遊んで、次の不足点を見つけた。

1. **最後の文が実際の状態と食い違う**: 手順6/6は、抽出の結果にかかわらず
   「新しいメソッドができ、点数とクリア条件が変わりました。メソッドがクリア条件の行数以内になるまで続けてみよう。」の固定文で出る。
   - A の処理(「今月の売上を集計する」「前月比を計算する」)を1回抽出した時点で、もう100点・クリア条件をすべて満たしている。
     なのに「行数以内になるまで続けてみよう」と言われ、まだ未達だと誤解する
   - 「前月比を計算する」+「表のヘッダーを組み立てる」をまとめて抽出すると 90 → 80 点に**下がる**のに同じ文が出る。ツアーが「正しく進んだ」と思わせ、実際に起きたこと(点数が下がった)を無視している
   - 手順5で処理の一覧が照らせず「次へ」で進んだときも(抽出していないのに)「新しいメソッドができ」と出る
2. **手順4/6が飛ぶことがある**: メソッドを先にクリックしていた場合に、3/6 から 5/6 へ進んだように見える。

### 手順4が飛ぶ条件(コードを読んで調べた結果)

- `nextTourStep` は1つのイベントで高々1手順しか進めない。手順4(`select-method`)を進めるのは `selectMethod` が出す `method-selected`(`printMonthlyReport`)か、
  対象が測れないときに出る「次へ」(`next`)だけで、`endManualFix`(手順3の終わり)から自動で2手順進む経路は無い。
- 一方 `selectedMethodId` は手で直すシミュレーション(`startManualFix` / `endManualFix`)をまたいで残る。`MethodChip` の `selected` は
  `manualFix === null` のときだけ真なので、手直し中は見えないが、「組み替えを始める」で手直しを閉じた瞬間に、
  **前に選んでいた printMonthlyReport の処理の一覧(`data-tour="extract-area"`)がもう開いている**。
  操作ガイドの「初回ガイドをもう一度」(`repeat-first-visit-tour`)でツアーをやり直したときがこれにあたる。
  - この状態の手順4/6は「クリックしてみよう」と言いながら、その先の画面(手順5の内容)がもう出ている。プレイヤーは一覧を見てメソッドを再クリックするか、
    一覧で抽出してしまい(手順4のまま止まる)、どちらにしても手順4の役目(メソッドを選ぶと中身が出る、を体験する)が飛んだのと同じになる
- つまり原因は「手順4の前提(まだメソッドを選んでいない)が、手順4に入る時点で崩れていること」。症状(手順の数え方)ではなく、手順4に入るときに前提を揃える形で直す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/tour/tourSteps.ts` | presentation | 抽出の結果の判定 `tourResultOf` と文 `tourResultText` を足す。手順6の固定文を、結果が無いとき用の控えめな文に直す |
| 変更 | `src/presentation/tour/tourSteps.test.ts` | presentation | 上の2関数のテスト(先に書く) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | 手順の開始時の点数を覚え、最後の手順に入るときに結果を作って持つ。`select-method` の手順に入るときにメソッドの選択を外す |
| 変更 | `src/presentation/tour/SpotlightTour.tsx` | presentation | 最後の手順の文を `tourResultText(tourResult)` で出す |
| 変更 | `e2e/first-visit-tour.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない(`scoreCodebase`(`src/domain/scoring/score.ts`)と `Score` 型を読むだけ)。新しい依存は足さない。

## データ・型の変更

`src/presentation/tour/tourSteps.ts` に足す。

```ts
import type { Score } from '../../domain/scoring/score';

export type TourScore = Pick<Score, 'total' | 'deducted'>;
export type TourResultKind = 'cleared' | 'improved' | 'worsened' | 'unchanged';
export type TourResult = { readonly kind: TourResultKind; readonly totalBefore: number; readonly totalAfter: number };

export function tourResultOf(before: TourScore, after: TourScore): TourResult;
export function tourResultText(result: TourResult): string;
```

`GameState`(`src/presentation/store/useGameStore.ts`)に足す。

- `tourScoreAtStepStart: TourScore` — 今の手順に入ったときの点数。`tourMethodCountAtStepStart` と同じ場所(`startTour` と、手順が変わったとき)で `scoreCodebase(state.codebase, state.stage)` から入れる。初期値 `{ total: 100, deducted: 0 }`
- `tourResult: TourResult | null` — 最後の手順に入るときに作る。`startTour` / `endTour` / ツアー完了時に `null` へ戻す

`TourEvent` / `TourAdvance` / `nextTourStep` は変更しない。保存形式の変更はなし。

## 設計判断(確定)

1. **判定は `deducted`(減点の合計)で比べ、表示は `total` を使う**。`total` は0点で下げ止まるため、比べるのは `deducted`。
   クリア条件(`clearConditions`)は減点のルールごとの件数なので、「クリア条件をすべて満たした」⇔ `deducted === 0`。別の判定関数は作らない
   - `after.deducted === 0` → `cleared`(前も0だった場合も含む)
   - `after.deducted < before.deducted` → `improved`
   - `after.deducted > before.deducted` → `worsened`
   - それ以外 → `unchanged`
2. **比べる「前」は手順5(抽出)に入った時点、「後」は手順6に入った時点の点数で、手順6のあいだは文を固定する**。手順6は「今の抽出で何が起きたか」を伝える手順なので、
   そのあとの操作で文が変わると何に対する説明か分からなくなる。手順6は「次へ」で閉じるだけの手順なので固定で困らない
3. **TourEvent に点数を載せず、ストアが前後の点数を持つ**。手順の開始時の値をストアが覚える形は `tourMethodCountAtStepStart` と同じで、既存の設計に合わせる。
   手順6へは「抽出(`method-count`)」と「対象が無いときの『次へ』」の2通りで入るため、イベントに載せると2か所で作ることになる。ストアの `advanceTour` で、
   次の手順が最後の手順なら `tourResultOf(state.tourScoreAtStepStart, scoreCodebase(state.codebase, state.stage))` を1回だけ作る
4. **手順4は飛ばさない(前提を揃える)**。`advanceTour` で次の手順の `advance.kind` が `select-method` のとき、同じ `set` で `selectedMethodId: null`, `extractDraft: null` にする。
   「飛ばしたと分かる表示」は選ばない。手順4の役目は「メソッドをクリックすると中身が開く」を体験させることで、表示で知らせても体験は戻らないため
5. **対象が測れないときの「次へ」は残す**(`allows skipping when an action target is unavailable` の今の動き)。ツアーで詰まないための逃げ道なので消さない。
   抽出せずに手順6へ来た場合は、設計判断1により `unchanged` の文になり、「新しいメソッドができ」とは言わない
6. 文には行数の数字(`/\d行/`)を書かない(ステージの `limits` と二重に持たないため。今のテスト `最後の手順の文に行数の数字を書かない` を守る)。点数の数字は書く(スポットライトの点数ゲージは今の点しか出さず、前後の変化が分からないため)
7. どの処理を選んだかは判定に使わない。点数の増減だけで出し分ける(「A を選んだか」を見ると、ステージの答えをツアーに二重に持つことになる)

## 動きの仕様

### 手順6/6の文(`tourResultText`)

`{前}` は `totalBefore`、`{後}` は `totalAfter`。

| 結果 | 文 |
| --- | --- |
| `cleared` | `クリア条件をすべて満たしました({後} 点)。同じ英字(同じ仕事)の処理を1つのメソッドにまとめると、長いメソッドが短くなり、仕事も混ざりません。` |
| `improved` | `点数が {前} → {後} 点に上がりました。まだ満たしていないクリア条件があります。課題のクリア条件を確かめて、続けてみよう。` |
| `worsened` | `点数が {前} → {後} 点に下がりました。「減点の内訳」で何が増えたかを確かめ、「元に戻す」で戻して選び直そう。` |
| `unchanged` | `点数は {後} 点のまま変わっていません。同じ英字の処理をまとめて抜き出すと、点数が上がります。` |

- `cleared` の文には「続けてみよう」を入れない
- 「減点の内訳」(`ScoreBreakdown.tsx` の summary)と「元に戻す」(`StagePanel.tsx` のボタン)は画面にある名前をそのまま使う
- `SpotlightTour` は、最後の手順(`tourStep === TOUR_STEPS.length - 1`)で `tourResult !== null` のとき `tourResultText(tourResult)` を出し、それ以外は `step.text` を出す
- `TOUR_STEPS[5].text`(結果が無いときだけ使う控え)は `抽出の結果、点数とクリア条件がどう変わったか確かめよう。` に直す(何が起きたかを断定しない)
- 対象(`.score-badge`)・進み方(`next`)・「n/6」の表示は今のまま

### 手順4/6に入るとき

- 手順3で「組み替えを始める」を押して手順4へ入ると、メソッドの選択が外れ、左パネルに処理の一覧(`data-tour="extract-area"`)は出ていない
- printMonthlyReport をクリックすると処理の一覧が開き、手順5へ進む(今どおり)
- 手順4で別のメソッドを選んで抽出しても手順4のまま(今どおり)。その後 printMonthlyReport を選んで手順5へ入ると、比べる「前」はその時点の点数になる

## TDD対象

### `tourResultOf`(presentation、`tourSteps.ts`)

- 前 `{ total: 90, deducted: 10 }`・後 `{ total: 100, deducted: 0 }` → `{ kind: 'cleared', totalBefore: 90, totalAfter: 100 }`
- 前 `{ total: 70, deducted: 30 }`・後 `{ total: 90, deducted: 10 }` → `improved`
- 前 `{ total: 90, deducted: 10 }`・後 `{ total: 80, deducted: 20 }` → `worsened`
- 前後とも `{ total: 90, deducted: 10 }` → `unchanged`
- 境界: 前後とも `{ total: 100, deducted: 0 }` → `cleared`
- 境界: 前 `{ total: 0, deducted: 120 }`・後 `{ total: 0, deducted: 110 }` → `improved`(`total` が同じでも `deducted` で比べる)

### `tourResultText`(presentation、`tourSteps.ts`)

- `cleared`(90 → 100)→ 「クリア条件をすべて満たしました」と「100 点」を含み、「続けてみよう」を含まない
- `improved`(70 → 90)→ 「70 → 90 点に上がりました」を含む
- `worsened`(90 → 80)→ 「90 → 80 点に下がりました」と「元に戻す」を含む
- `unchanged`(90 → 90)→ 「90 点のまま」を含み、「新しいメソッドができ」を含まない
- 4種類とも `/\d行/` に一致しない

`nextTourStep` の既存テストはそのまま通ること。ストアの `advanceTour` の変更とスポットライトの表示は E2E で確かめる。

## 受け入れ基準

1. 初回ツアーで手順5まで進め、「今月の売上を集計する」「前月比を計算する」を選んで抽出すると、手順6/6に「クリア条件をすべて満たしました(100 点)」が出て、「続けてみよう」は出ない
2. 初回ツアーで手順5まで進め、「前月比を計算する」「表のヘッダーを組み立てる」を選んで抽出すると、点数が下がり(実機で 90 → 80 点を確認済み)、手順6/6に「点に下がりました」と「元に戻す」が出る
3. printMonthlyReport を選んだ状態で、操作ガイドの「初回ガイドをもう一度」(`repeat-first-visit-tour`)からツアーをやり直し、手順2・3を終えて「組み替えを始める」を押すと、手順4/6が出て、処理の一覧(`[data-tour="fragment-list"]`)は出ていない。printMonthlyReport をクリックすると手順5/6へ進む
4. 手順6/6の文に行数の数字(「〇行」)が出ない(今の `not.toContainText('50行')` を含む)
5. 既存の `e2e/first-visit-tour.spec.ts` のほかのテスト(Escape・終了ボタン・閉じた印の保存・やり直し・抽出後の手直し)が通る
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ツアーの手順の追加・並べ替え・対象の変更(手順1〜5の文と対象は今のまま。手順1は `toolbar-hint-rumor-popovers` で据え置きを決めている)
- 手順6のあいだにさらに操作したとき、文を追いかけて変えること(設計判断2。必要になったら `tourResult` を手順6のあいだ再計算する形で足す)
- 抽出した処理の組み合わせ(どの英字を選んだか)ごとの説明。点数の増減の4通りで足りる(設計判断7)
- 手順5で「次へ」を押して抽出を飛ばせなくすること(設計判断5)
- 点数が0点で下げ止まっているときの文(`0 → 0 点に上がりました` になる)の言い回しの調整。チュートリアル1は0点にならないため。`// ponytail: 0点で下げ止まると「0 → 0 点に上がりました」になる、0点のステージにツアーを足すときに直す` を残す
- 抽出のお祝い表示(`celebration`)や点数ゲージの変更
- チュートリアル1以外へのツアーの追加(`first-visit-tour` / `tutorial-tour-fixes` と同じ)
