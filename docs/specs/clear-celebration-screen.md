# clear-celebration-screen: 初めて100点にしたら、全画面のクリア画面を出し、次の行き先を選ばせる

## 背景・目的

ステージを100点にしても、画面は点数のリングが光るだけで、左のサイドバーに「章の結び」「ステージクリア」「理解度チェック」などのカードが静かに増える。
プレイヤーは「100点になったが、次に何をすればよいのか」が分からず、達成感も薄い(実機の指摘)。

そこで、**操作で初めて100点にしたとき**に、いつもの画面の上に全画面のクリア画面を重ね、大きく祝う。
同じ画面で、次の行き先を選ばせる。

- 変更依頼を受ける(このステージの変更依頼に挑戦する)
- 次のステージへ進む(ステージ一覧のおすすめ)
- 今の画面へ戻る(組み替えた設計を眺める・理解度チェックを読む)

別の「モード」やルートは増やさず、既存のダイアログと同じ `<dialog>` のモーダルとして重ねる(状態はそのまま残り、「今の画面へ戻る」は閉じるだけで済む)。

### 設計判断(対話で確定済み)

- **「次の依頼」**: このステージの変更依頼とは別に、「次のステージへ」(`recommendNextStage` のおすすめ)を選べるようにする
- **出す時機**: 操作で初めて100点にしたとき。ステージごとに、そのタブを開いている間は1回だけ。元に戻す・やり直し・最初に戻す・再読み込み・すでに100点のステージを開き直したときは出さない
- **演出**: 全画面で、ライブラリを足さずCSSだけで行う(大きな「STAGE CLEAR!」、100点のリングのカウントアップ、紙吹雪、光のパルス)

## ponytailチェック

1. YAGNI: 効果音・Canvas・紙吹雪ライブラリは足さない。紙吹雪は `<span>` 24個と `@keyframes` だけ。
2. 既存の再利用: 点数の判定は `scoreCodebase`(`celebration.scoreAfter` / `scoreBefore`)、おすすめステージは `recommendNextStage`、カウントアップは `useCountUp`、
   変更依頼の開始は `startChangeRequests`、ステージ移動は `selectStage`、手直しは `startManualFix`、ダイアログの作法は `SampleAnswerReplayDialog`(`showModal`)に合わせる。
3. 標準機能: `<dialog>` の `showModal()`(フォーカストラップ・Escで閉じる)、CSSアニメーション、`prefers-reduced-motion`。
4. 新しい依存は足さない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/stage/clearChoices.ts` | domain | クリア画面に出す選択肢と並びを決める純粋関数 |
| 新規 | `src/domain/stage/clearChoices.test.ts` | domain | 上のテスト(先に書く) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `clearScreen`(今出しているステージID)・`clearShownStages`(出し済みのステージID)・`dismissClearScreen` を持ち、`commit` で初めて100点になったときに立てる |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 出る・出ない条件のテスト(先に書く) |
| 新規 | `src/presentation/stage/ClearScreen.tsx` | presentation | 全画面のクリア画面(`<dialog>`) |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `ClearScreen` を置く(`SpotlightTour` と同じ階層) |
| 変更 | `src/index.css` | presentation | 全画面の見た目・紙吹雪・光・`@media (prefers-reduced-motion: reduce)` |
| 新規 | `e2e/clear-screen.spec.ts` | E2E | 受け入れ基準を確かめる |
| 変更 | `e2e/selectStage.ts` ほか、100点にしたあとサイドバーを触る既存のE2E | E2E | クリア画面を閉じる共通ヘルパーを足し、必要な箇所で呼ぶ(下の「既存E2Eへの影響」) |

`application` / `infrastructure` は変更しない。`domain` は上の1ファイルを足すだけで、既存の関数は変えない。

## データ・型の変更

### domain

```ts
// src/domain/stage/clearChoices.ts
import type { StageStep } from '../change/stageStep';

export type ClearChoice =
  | { readonly kind: 'accept-change-request' }
  | { readonly kind: 'closing-fix' }
  | { readonly kind: 'next-stage'; readonly stageId: string }
  | { readonly kind: 'back' };

/** クリア画面に並べる選択肢。先頭が主ボタン(大きく目立たせる)。`back` は必ず最後。 */
export function clearChoices(input: Readonly<{
  /** 今の段階(`stageStep` の結果)。 */
  step: StageStep;
  /** このステージに変更依頼があるか(`stage.changeRequests.length > 0`)。 */
  hasChangeRequests: boolean;
  /** `recommendNextStage` の結果のID。おすすめが無い(全ステージクリア)・自分自身なら undefined。 */
  nextStageId: string | undefined;
}>): ClearChoice[];
```

並びの規則:

1. `step === 'change-request'` で `hasChangeRequests` なら `accept-change-request`
2. `step === 'closing-fix'` なら `closing-fix`(組み替えたあとの手直しを先に解かないと変更依頼に進めないため。`accept-change-request` の代わりに出す)
3. `nextStageId` があれば `next-stage`
4. 最後に `back`

### presentation(ストア)

```ts
// GameState に足す
clearScreen: { readonly stageId: string } | null;   // 出しているクリア画面。null なら出していない
clearShownStages: readonly string[];                // そのタブでクリア画面を出し済みのステージID

// 足すアクション
dismissClearScreen: () => void;                     // clearScreen を null にする(出し済みの記録は残す)
```

- `commit`(`celebrationFor` の結果が `scoreBefore < 100 && scoreAfter === 100`)のとき、次をすべて満たすなら `clearScreen = { stageId }` にして `clearShownStages` に足す
  - `changeSession === null` で、`manualFix === null`(変更依頼の実装中・手で直している最中は出さない)
  - そのステージIDが `clearShownStages` にまだ無い
  - ステージ切り替え直後の初期状態(`restoredDraft` の復元など、`commit` を通らないもの)では立てない(出すのは `commit` を通った操作のときだけ)
- 元に戻す(`undo`)・やり直し(`redo`)・最初に戻す(`resetStage`)は `commit` の `celebrate = false` 経路(または別の更新)なので、`clearScreen` は立てない
- `selectStage` で別のステージへ移ったら `clearScreen` を `null` にする。`clearShownStages` は残す
- `createGameStore` の引数は増やさない。ユニットテストは `clearScreen` / `clearShownStages` を直接見る

### 画面が持つ値

- 次のステージ: `recommendNextStage(stages, progress)` を `ClearScreen` の中で呼ぶ。結果のIDが今のステージ自身なら(記録が追いつく前の一瞬)`undefined` として `clearChoices` に渡す
- 段階: `stageStep({ score: 100, hasModifyRequest: painRequestsOf(stage).modify !== undefined, openingDone, closingSolved })`(`StoryOutro` と同じ作り方)

## 見た目・動きの仕様

### 全体

- `clearScreen !== null` のとき、画面全体を覆う `<dialog>`(`showModal()`、`data-testid="clear-screen"`、`aria-labelledby` は見出し)を出す
  - 背景は `color-mix(in srgb, var(--accent) 30%, #000)` ぐらいの濃い色に、放射状のグラデーションで中心を明るくする(ライト・ダークどちらのテーマでも文字が読める)
  - 紙吹雪: `<span class="clear-screen__confetti">` を24個、`style={{ '--i': index }}` を使い、色・横位置・落ちる速さ・遅れを `--i` から `calc` で散らす(`@keyframes clear-confetti-fall`、約3〜5秒を繰り返す)
- 中身(縦中央寄せ、縦に積む)
  1. 小さな文 `ステージクリア`(ステージ名 `stage.title` を添える)
  2. 見出し `STAGE CLEAR!`(`h2`、`clamp(48px, 12vw, 120px)`、太字、`@keyframes clear-pop` で `scale(0.4 → 1.15 → 1)` と跳ねて現れる)
  3. 100点のリング: 既存 `ScoreBadge` と同じ `conic-gradient` で、`useCountUp` を使い **0 → 100 を約1.2秒でカウントアップ**。終わったら一度だけ強く光る(`clear-glow`)
  4. 一言 `減点なし`(`describeScoreShort` ではなく固定文でよい)
  5. 選択肢のボタン(下)
- 見出しの出現 → リングのカウントアップ → ボタンの出現の順に、`animation-delay` を少しずつずらして出す(ボタンは約1.4秒後にフェードイン。ただしフォーカスと操作はすぐできる。`opacity` だけでなく `pointer-events` は止めない)
- `@media (prefers-reduced-motion: reduce)` では、紙吹雪を出さず、アニメーションを止める(カウントアップも最初から100を出す)。文字・ボタンは最初から見える

### 選択肢(`clearChoices` の順に縦に並べる)

| `kind` | ボタンの文 | 押したとき |
| --- | --- | --- |
| `accept-change-request` | `変更依頼を受ける` | `dismissClearScreen` → `startChangeRequests` |
| `closing-fix` | `同じ変更をもう一度手で直す` | `dismissClearScreen` → `startManualFix` |
| `next-stage` | `次のステージへ(<ステージ名>)` | `dismissClearScreen` → `selectStage(stageId)` |
| `back` | `今の画面へ戻る` | `dismissClearScreen` |

- 先頭の1つを主ボタンにする(`button--primary`、大きめ、`data-testid="clear-choice-primary"`)。残りは通常のボタン
- 各ボタンの `data-testid` は `clear-choice-<kind>`(`clear-choice-accept-change-request` など)
- ダイアログを開いたら、主ボタンにフォーカスを置く
- `Esc` と、画面の外のクリックは使わない(`<dialog>` 標準の `cancel` イベントは `今の画面へ戻る` と同じ扱いにして `dismissClearScreen` を呼ぶ)
- 閉じたあと、フォーカスは `showModal` 前の要素に戻る(標準の挙動のまま)
- 見出しの要素 `h2` と `aria-live` は付けない(100点の読み上げは `score-announcement` がすでにしている。ダイアログを開いた時点で見出しが読まれる)

### 今ある表示との関係

- サイドバーの `StoryOutro`・`NextStageCard`・理解度チェック・`UnusedPublicNote` は変えない。「今の画面へ戻る」で戻ったときに今までどおり見える
- 100点でサイドバーを自動で開く挙動(`useStageSidebar`)は変えない(クリア画面の下で開いたままにしておく)
- 初回訪問のツアー中(`tourStep !== null`)は出さない(ツアーの吹き出しと重ならないようにする。`commit` で `clearScreen` を立てる条件に `tourStep === null` を足す)

## 既存E2Eへの影響

100点にしたあとサイドバーのボタンを押すE2E(`next-stage-after-clear`・`story-mode`・`sidebar-flow-visibility`・`sidebar-structure`・`stage-flow`・`refactor`・`toolbar-hint-rumor-popovers` など。`e2e` で `100点`・`story-accept`・`story-next`・`next-stage-go`・`change-request-start` を使うもの)は、
モーダルに遮られて押せなくなる。

- `e2e/selectStage.ts` に `dismissClearScreen(page)` を足す(`clear-screen` が見えていれば `clear-choice-back` を押し、見えなければ何もしない)
- 100点にした操作のあとで、サイドバーなどを触る前に呼ぶ。数が多いので、100点にする共通の操作(`stage-flow.spec.ts` などのヘルパー)の中に入れてよい
- クリア画面そのものを確かめるのは `e2e/clear-screen.spec.ts` だけにする

## TDD対象

### `clearChoices`(domain)

- `step: 'change-request'`、変更依頼あり、次のステージあり → `[accept-change-request, next-stage, back]`
- `step: 'change-request'`、変更依頼なし → `accept-change-request` を含まない(`[next-stage, back]`)
- `step: 'closing-fix'`、次のステージあり → `[closing-fix, next-stage, back]`(`accept-change-request` は出さない)
- `step: 'refactor'`(変更依頼の有無によらず) → `accept-change-request` も `closing-fix` も出さない(`[next-stage, back]`)
- 次のステージなし(全ステージクリア) → `next-stage` を含まない。`back` だけになりうる(`[back]`)
- どの入力でも、最後の要素は必ず `back`

### ストア(`useGameStore.test.ts`)

- 99点 → 100点になる操作(`commit`)で、`clearScreen` が `{ stageId }` になり、`clearShownStages` にそのステージが入る
- `dismissClearScreen` で `clearScreen` が `null` になり、`clearShownStages` は残る
- 一度出したステージで、元に戻す → もう一度100点にする操作をしても、`clearScreen` は立たない
- すでに100点のステージを開いた(復元・初期状態)だけでは、`clearScreen` は立たない
- `undo` / `redo` / `resetStage` で100点になっても、`clearScreen` は立たない
- `changeSession !== null` または `manualFix !== null` または `tourStep !== null` のとき、100点にしても `clearScreen` は立たず、`clearShownStages` にも入らない
- `selectStage` で別のステージへ移ると `clearScreen` が `null` になり、`clearShownStages` は残る

見た目・アニメーション・フォーカスは表示の状態なので、E2E で確かめる。

## 受け入れ基準

1. チュートリアル1などを操作で初めて100点にすると、全画面のクリア画面が出て、大きな `STAGE CLEAR!`・0から100へのカウントアップ・紙吹雪が見える
2. 変更依頼のあるステージで、手直しまで済ませて100点にした場合、選択肢は `変更依頼を受ける`(主ボタン)・`次のステージへ(…)`・`今の画面へ戻る` の順に並ぶ。
   組み替えたあとの手直しがまだなら、`変更依頼を受ける` の代わりに `同じ変更をもう一度手で直す` が主ボタンで出る
3. `変更依頼を受ける` で変更依頼の画面が始まり、`次のステージへ` でおすすめのステージが開き、`今の画面へ戻る`(と `Esc`)で閉じて今の画面に戻る(サイドバーの「ステージクリア」などはそのまま見える)
4. 次のステージが無い(全ステージクリア)とき、`次のステージへ` は出ない。変更依頼が無いステージでは `変更依頼を受ける` は出ない
5. 同じステージで、元に戻してもう一度100点にしてもクリア画面は出ない。再読み込み・すでに100点のステージを開き直した場合も出ない。別のステージを操作して初めて100点にしたときは出る
6. 初回訪問のツアー中・変更依頼の実装中・手で直している最中に100点になっても出ない
7. ダイアログを開いたら主ボタンにフォーカスがあり、キーボードだけで選べる。閉じたらフォーカスが元に戻る
8. `prefers-reduced-motion: reduce` では紙吹雪とアニメーションが動かず、最初から `100点` が見える。ライト・ダーク両方のテーマで文字が読める。幅375pxでもボタンが画面内に収まる
9. 既存のE2Eが、`dismissClearScreen` を呼ぶことで今までどおり通る
10. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 効果音・音声、紙吹雪などのライブラリ導入
- 設計くらべ(`quiz`)・白紙設計(`blank`)のクリア画面(リファクタリングモードのステージだけを対象にする)
- ストーリーがオンのときの「次の章へ」の文面や章の結びを、クリア画面へ移すこと(サイドバーにそのまま残す)
- クリア済みステージの一覧・記録の表示・シェア機能
- 変更依頼をすべて終えたあとの結果画面の演出(別の仕様で扱う)
- `NextStageCard`・`StoryOutro`・ステージ一覧(ロードマップ)の変更
