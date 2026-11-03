# tour-clear-screen-after-tour: 初回ツアー中に100点にすると、ツアーを閉じてもクリア画面が出ない

小さな不具合修正。関連する実装済み仕様: `clear-celebration-screen.md`(クリア画面)、`next-stage-after-clear.md`(クリア後の次の一歩)、`tour-step-follows-state.md`(ツアーの手順)。

## 症状

2026-11-03 の実機確認で、チュートリアル1を初回ツアーどおりに遊んだ。

1. 初回訪問でツアーが始まる(1/6)。手順どおり「実際に直してみる」→ リリース →「組み替えを始める」→ `printMonthlyReport()` をクリック → A の処理2つを選んで抽出する
2. 6/6 の吹き出しに「クリア条件をすべて満たしました(100 点)」と出る
3. 「次へ」でツアーを閉じる

期待: 全画面のクリア画面(`ClearScreen`。「STAGE CLEAR!」と次の一歩の選択肢)が出る。
実際: 何も出ない。その後も二度と出ず、初めてのプレイヤーが次の一歩(変更依頼・次のステージ)の入口を見ないまま、左パネルの一番下の「次の章へ」を探すことになる。

## 原因

`src/presentation/store/useGameStore.ts` の `clearScreenAfterCommit` が `state.tourStep === null` を条件にしていて、ツアー中の100点ではクリア画面を立てない(`clear-celebration-screen.md` で、吹き出しとの重なりを避けるために決めた仕様)。
一方でクリア画面は「100未満 → 100 に変わった操作」(`celebration.scoreBefore < 100 && celebration.scoreAfter === 100`)でしか立たないので、ツアーを閉じたあとに出し直す経路がない。

ツアーが閉じる(`tourStep` が `null` になる)のはストアの2か所だけで、ここで直せば足りる(grep で確認済み。`SpotlightTour.tsx` の「次へ」は `advanceTour`、「ガイドを終了」と Escape は `endTour` を呼ぶ)。

- `tourActions` の `advanceTour` で `nextTourStep(...)` が `null` を返した分岐(最終手順で「次へ」)
- `tourActions` の `endTour`(「ガイドを終了」・Escape)

## 修正

方針: **ツアー中に100点になったときは、ツアーを閉じた直後にクリア画面を出す。** 「最終手順の『次へ』でクリア画面へつなぐ」案と比べて、こちらは閉じる2か所に同じ判定を足すだけで済み、吹き出しの文言やボタン(`SpotlightTour.tsx`・`tourSteps.ts`)を変えなくてよい。6/6 で「ガイドを終了」や Escape で閉じたときも同じように出るので、閉じ方による取りこぼしもない。

変更するファイルは `src/presentation/store/useGameStore.ts`(presentation 層)だけ。新しい state は足さない。

1. モジュール内の純粋関数を1つ足す(`clearScreenAfterCommit` の隣に置く)。

   ```ts
   /** ツアー中の操作で100点にしていたら、ツアーを閉じた直後にクリア画面を出す。 */
   function clearScreenAfterTour(state: GameState): Partial<GameState>
   ```

   次の条件をすべて満たすときだけ `{ clearScreen: { stageId: state.stage.id }, clearShownStages: [...state.clearShownStages, state.stage.id] }` を返し、それ以外は `{}` を返す。

   - `state.tourResult?.kind === 'cleared'` かつ `state.tourResult.totalBefore < 100`(ツアーの抽出の手順で100点に**なった**。最初から100点の盤面でツアーをやり直したときは出さない)
   - いまの盤面がまだ100点(`scoreCodebase(state.codebase, state.stage).total === 100`。6/6 で「元に戻す」を押してから閉じたときは出さない)
   - `state.changeSession === null && state.manualFix === null`(`clearScreenAfterCommit` と同じ抑止条件)
   - `!state.clearShownStages.includes(state.stage.id)`(1ステージ1回)

   `tourResult` は最終手順(6/6)に入るときにしか立たない(`advanceTour` の `next === TOUR_STEPS.length - 1` の分岐)ので、1〜5/6 で閉じたときは出ない。

2. `advanceTour` の `next === null` の分岐と `endTour` で、`set({ tourStep: null, tourResult: null })` を `set({ tourStep: null, tourResult: null, ...clearScreenAfterTour(state) })` にする(`endTour` は `get()` の結果を `state` に受ける)。`tourResult: null` にする前の `state` で判定すること。

3. `clearScreenAfterCommit` の `state.tourStep === null` の条件は残す(ツアーの吹き出しとクリア画面を重ねない、という既存の約束はそのまま)。

`ClearScreen.tsx` は変更しない。100のカウントアップは抽出時の `celebration.seq` をそのまま使うので、ツアーを閉じた時点で表示しても動く。

## テスト

先に書いて失敗させるもの。

### Vitest(`src/presentation/store/useGameStore.test.ts` の `describe('クリア画面')` に追加)

`clearScreenAfterTour` はモジュール内の関数なので、既存の `clearScreenAfterCommit` と同じくストアの公開アクション経由でテストする(`createGameStore([stage], false, false)`)。ツアーは `startTour(true)` で始め、`advanceTour({ kind: 'next' })` を4回で 5/6(インデックス4)まで進め、`extractMethod(...)`(既存の `complete`)のあと `advanceTour({ kind: 'method-count', count: 0, countAtStepStart: 0 })`(`countAtStepStart` はストアが差し替える。`count` には抽出後のメソッド数を渡す)で 6/6 に入れる。`tourPreference.ts` は `localStorage` が無くても例外を出さないので Node でそのまま動く。

1. **正常系: 6/6 で「次へ」** — 6/6 の時点では `clearScreen` が `null`、`advanceTour({ kind: 'next' })` のあと `tourStep` が `null`、`clearScreen` が `{ stageId: stage.id }`、`clearShownStages` が `[stage.id]`
2. **正常系: 6/6 で `endTour()`** — 1 と同じくクリア画面が出る
3. **異常系: 6/6 で `undo()` してから閉じる** — `clearScreen` は `null`、`clearShownStages` は `[]`
4. **異常系: 100点にならずにツアーを閉じる** — 1/6 で `endTour()` したとき、および B・C の処理を抜き出して `tourResult.kind` が `'cleared'` 以外で 6/6 を閉じたとき、`clearScreen` は `null`
5. **異常系: すでにクリア画面を出したステージ** — `clearShownStages` に `stage.id` が入っている状態で 1 の手順をしても `clearScreen` は `null`

既存の「ツアー中の100点では出さず、ステージ移動では表示だけを閉じる」は `store.setState({ tourStep: 0 })` で `tourResult` が `null` のままなので、そのまま通る(変更不要)。

### E2E(`e2e/first-visit-tour.spec.ts`)

- 1本目 `first visit guides a player through Extract Method using the actual actions` の最後(6/6 で「次へ」→ `tour` が0件)のあとに、`page.getByTestId('clear-screen')` が見えること、`clear-choice-primary` にフォーカスがあることを足す
- 新規テスト: 6/6 まで進めて「ガイドを終了」を押すと、ツアーが消えてクリア画面が出る
- 既存の `after the tour extraction, re-fixing "前年同月比も出して" has one site and nothing is missed` は、ツアーを「次へ」で閉じた直後にクリア画面が出て操作を塞ぐようになるので、`page.getByTestId('clear-choice-back').click()` でクリア画面を閉じてから(`clear-screen` が0件になるのを待ってから)続ける

ほかの E2E(`selectStage.ts`・`manual-fix-clarity.spec.ts`・`opening-fix-banner-fit.spec.ts` など)は 1〜2/6 でツアーを閉じるだけで `tourResult` が立たないため、影響しない。

## 受け入れ基準

1. 初回訪問でチュートリアル1をツアーどおりに進め、6/6 で「次へ」を押すと、ツアーが消えてクリア画面(「STAGE CLEAR!」と次の一歩の選択肢)が出る
2. 6/6 で「ガイドを終了」または Escape で閉じても、同じようにクリア画面が出る
3. 6/6 の吹き出しが出ている間はクリア画面が出ない(吹き出しと重ならない)
4. 100点にならずにツアーを閉じたとき、6/6 で元に戻してから閉じたとき、最初から100点の盤面でツアーをやり直して閉じたときは出ない
5. クリア画面を一度出したあとは、同じステージで再表示しない(既存の `clearShownStages` の約束どおり)
6. 上の Vitest と E2E が追加・更新されていて、`npm run check` と `npm run test:e2e` が通る

## スコープ外

- 6/6 の吹き出しの文言やボタンの変更(「次へ」を「クリア画面へ」にする、など)。閉じた直後に出せば足りる
- 設計くらべ・白紙設計の紹介ツアー(`MODE_INTRO_STEPS`)。100点の概念もクリア画面もないので対象外
- ツアーの手順の途中(1〜5/6)で、抽出以外の操作(メソッドの移動など)で100点にしたケース。初回ツアーの手順では起きないので、`tourResult` を使った判定で足りる。起きる手順をツアーに足すときに、ツアー中に抑止したことを記録する方式へ広げる
- 再読み込みをまたいでクリア画面を出したかを覚えること(`clearShownStages` の永続化)
