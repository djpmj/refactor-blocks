# tour-score-count-sync: ツアー6/6の「100点」の文が、点数リングのカウントアップ途中(91点など)と同時に出る

## 症状

2026-11-03、チュートリアル1(`tutorial-extract-method`)の初回ツアーで確認した。

1. ツアーを 1/6 から進め、5/6 で `printMonthlyReport()` の A の処理(「今月の売上を集計する」「前月比を計算する」)を選んで抽出する
2. 90点 → 100点になった直後、ツアー 6/6 の吹き出しは「クリア条件をすべて満たしました(100 点)」と言っている
3. 同じ瞬間、ヘッダーの点数リング(`data-testid="score-value"`)は「91点」など、カウントアップの途中の値を出している。リングは「✅ 減点なし」のすぐ隣なので、「減点なしなのに91点」に見える
4. キャンバス上部の操作結果の通知も、一瞬「(-10)」に見えてから「(+10)」になったように見えた

点数リングは 90 → 100 を約1秒(`useCountUp` で 100点のときは 1000ms)かけて数え上げる。その間、ツアー文は確定値(100点)を出しているので、2つの数字が食い違って見える。

## 原因

**ツアー6/6の文(主な原因)**

- `src/presentation/store/useGameStore.ts` の `advanceTour` は、抽出でメソッドが増えた瞬間に 6/6 へ進め、その場で `tourResultOf(...)` で確定値の `tourResult` を作る。
- `src/presentation/tour/SpotlightTour.tsx` の `SpotlightTour` は、`tourResult` があればすぐ `tourResultText(tourResult)` を出す。リングのカウントアップが終わったかどうかを見ていない。
- カウントアップの状態は `src/presentation/stage/StagePanel.tsx` の `ScoreBadge` の中で `useCountUp(score.total, rising ? celebration.seq : null, rising ? celebration.scoreBefore : score.total, rising)` として作られ、外から見えない。「点数が上がったときだけ数え上げる」という判定(`rising`)も `ScoreBadge` の中にだけ書かれている。
- `useCountUp` を呼んでいるのは `ScoreBadge` と `ClearScreen`(0→100の固定演出。ツアー中はクリア画面を出さない: `clearScreenAfterCommit` の `state.tourStep === null`)の2か所だけ。点数リングの数え上げ方を決めているのは `ScoreBadge` の1か所なので、そこを共通の hook に切り出せば、ツアーも同じ判定で「数え終わったか」を知れる。

**通知(操作結果)の符号**

- 通知の文は `useGameStore.ts` の `scoredOperation` が、操作の前後の確定した `Score` から `describeOperationResult(before, after)` で1回だけ作る。`sentenceOf` は「消えました」のとき必ず `(+N)` を付け、カウントアップの値は一切使っていない。チュートリアル1の A 抽出では最初から `「行数」の減点が1件消えました(+10)` になる。
- 抽出の直後に `extractActions` が `nextStep` を足すため2回 `set` されるが、`lines` は変わらない。
- したがって通知の符号が逆になるコードの経路はない。見えた「(-10)」は、同じヘッダーの抽出前の表示 `減点 1項目(-10)`(`describeScoreShort`)か、リングの途中の値と見比べたことによる見え方と判断する。**通知のコードは直さず**、この挙動を回帰テストで固定するだけにする(症状のうち「数字が食い違う」本体は、ツアー文をカウントアップ後に出すことで解消する)。

## 修正

ツアー6/6の結果文を、点数リングのカウントアップが終わってから出す。数え終わるまでは手順6の元の文(`TOUR_STEPS[5].text`「抽出の結果、点数とクリア条件がどう変わったか確かめよう。」)を出しておく。

変更するファイル(すべて presentation 層):

| ファイル | 変更 | 内容 |
| --- | --- | --- |
| `src/presentation/stage/useCountUp.ts` | 変更 | 純粋関数 `scoreCountUpInput` と hook `useScoreCountUp` を足す |
| `src/presentation/stage/useCountUp.test.ts` | 新規 | `scoreCountUpInput` のテスト |
| `src/presentation/stage/StagePanel.tsx` | 変更 | `ScoreBadge` の `rising` 判定と `useCountUp` 呼び出しを `useScoreCountUp(score.total)` に置き換える |
| `src/presentation/tour/SpotlightTour.tsx` | 変更 | 6/6 の結果文を、`useScoreCountUp` が `active` の間は出さない |
| `src/presentation/store/useGameStore.test.ts` | 変更 | 通知の符号の回帰テストを1件足す |
| `e2e/first-visit-tour.spec.ts` | 変更 | リングが100点になってから文が出ることを確かめるE2Eを1件足す |

### 純粋関数(`useCountUp.ts` に追加)

```ts
type ScoreCelebrationLike = { readonly seq: number; readonly scoreBefore: number; readonly scoreAfter: number } | null;

/** 点数リングを数え上げるか、どこから数えるか。点数が上がった直後の celebration がそのときの点数と一致するときだけ数える。 */
export function scoreCountUpInput(celebration: ScoreCelebrationLike, total: number): { readonly seq: number | null; readonly start: number; readonly enabled: boolean };
```

- `ScoreBadge` の今の `rising` と同じ判定: `celebration !== null && celebration.scoreAfter === total && celebration.scoreAfter > celebration.scoreBefore`
- 数えるとき: `{ seq: celebration.seq, start: celebration.scoreBefore, enabled: true }`
- 数えないとき: `{ seq: null, start: total, enabled: false }`
- 型は store の `GameState['celebration']` をそのまま受けられる構造的な部分型にする(store を import しない。`useCountUp.ts` から store への依存を増やさないため)

### hook(`useCountUp.ts` に追加)

```ts
/** 点数リングと同じ条件で数え上げる。ヘッダーのリングとツアーが同じ判定を使う。 */
export function useScoreCountUp(total: number): { readonly value: number; readonly active: boolean };
```

- 中身は `useGameStore((state) => state.celebration)` を読み、`scoreCountUpInput` の結果を `useCountUp(total, seq, start, enabled)` に渡すだけ。
- `useCountUp` 本体(rAF・`prefers-reduced-motion` の扱い・duration)は変えない。

### `ScoreBadge`(StagePanel.tsx)

- `rising` と `useCountUp(...)` の行を `const animation = useScoreCountUp(score.total);` に置き換える。`celebration` は `isFloorProgress` でまだ使うので読み出しは残す。見た目・クラス名・`data-testid` は変えない。

### `SpotlightTour`(SpotlightTour.tsx)

- `const countUp = useScoreCountUp(tourResult?.totalAfter ?? 0);` を hook の並びに足す(条件付きで呼ばない)。
- 表示する文: `tourStep === TOUR_STEPS.length - 1 && tourResult !== null && !countUp.active ? tourResultText(tourResult) : step.text`
- `tourResult.totalAfter` は抽出直後の確定点数で、`celebration.scoreAfter` と同じ値なので、ヘッダーのリングと同じ seq・同じ始点・同じ長さで数える。下がった・変わらないときは `scoreCountUpInput` が数えない判定を返し、今までどおりすぐ結果文を出す。
- `prefers-reduced-motion: reduce` のときは `useCountUp` が `active: false` を返すので、すぐ結果文を出す(今と同じ)。
- 吹き出しは `aria-live="polite"` なので、数え終わったときに結果文が1回読み上げられる。

ponytail: ツアーとリングは別々の `useCountUp`(別々の rAF)で数えるので、終わる瞬間が1フレームずれることがありうる。目に見える差ではないので、共有の時計は作らない。ずれが問題になったら、`celebration` に開始時刻を持たせて両方がそれを使う形に直す(コードにこのコメントを残す)。

### 通知(操作結果)

- コードは変えない(原因の節のとおり、すでに確定値の差分から作っている)。

## テスト

先に書いて失敗(または未定義でコンパイルエラー)を確かめてから実装する。AAAパターン。

### Vitest: `src/presentation/stage/useCountUp.test.ts`(新規)— `scoreCountUpInput`

- 正常系: `celebration = { seq: 3, scoreBefore: 90, scoreAfter: 100 }`, `total = 100` → `{ seq: 3, start: 90, enabled: true }`
- `celebration === null`, `total = 90` → `{ seq: null, start: 90, enabled: false }`
- 点数が下がった `{ seq: 2, scoreBefore: 90, scoreAfter: 80 }`, `total = 80` → 数えない(`enabled: false`, `start: 80`)
- 同点(解消だけの celebration)`{ seq: 2, scoreBefore: 90, scoreAfter: 90 }`, `total = 90` → 数えない
- 古い celebration(`scoreAfter: 100` のまま、取り消し等で `total = 90`)→ 数えない(`start: 90`)

### Vitest: `src/presentation/store/useGameStore.test.ts` — 通知の符号の回帰

- `tutorial-extract-method` のストアで `tourStep: 0` にしてから、A の2処理(`frag-aggregate-sales`, `frag-compare-last-month`)を抽出する
- `operationResult.tone` が `'better'`、`lines` が `「行数」の減点が1件消えました(+10)` を含み、どの行にも `(-` が含まれないこと(実際のルール名・件数はこのステージの採点に合わせて確認し、確定した文字列で書く)

### E2E: `e2e/first-visit-tour.spec.ts` に1件追加

`step 6 shows the result only after the score ring has counted up to 100` のような名前で:

1. 既存の1件目と同じ手順で 5/6 まで進め、A の2処理を選ぶ
2. 抽出ボタンを押す前に `page.evaluate` で `MutationObserver` を `document.body`(`subtree`, `childList`, `characterData`)に付け、変化のたびに「`[data-testid="first-visit-tour"]` の文が `クリア条件をすべて満たしました` を含むのに、`[data-testid="score-value"]` の文が `100点` でない」瞬間があれば `window` 上の配列に記録する
3. 抽出ボタンを押す
4. 直後に吹き出しが `6/6` かつ `確かめよう`(手順6の元の文)を含むこと
5. `toContainText('クリア条件をすべて満たしました(100 点)')` で結果文を待ち、その時点で `score-value` が `100点` であること
6. 記録した配列が空であること

既存の 6/6 のテスト(`toContainText` で自動待ちしている)はそのまま通る想定。通らなければ待ち方だけ直し、期待する文言は変えない。

## 受け入れ基準

1. 症状の手順をもう一度やると、6/6 の吹き出しは数え上げの間「抽出の結果、点数とクリア条件がどう変わったか確かめよう。」を出し、リングが100点になってから「クリア条件をすべて満たしました(100 点)」に変わる。リングが途中の値のときに「100 点」の文が出ない
2. B・C を抜いて点数が変わらない/下がる場合の 6/6 の文(既存のE2E 2件)は今までどおり、すぐ出る
3. OS の「視差効果を減らす」(`prefers-reduced-motion: reduce`)では、今までどおりリングは数えずにすぐ100点、文もすぐ出る
4. ヘッダーの点数リングの見た目・数え上げ方(長さ・光り方)は変わらない
5. 通知の文は `(+10)` で、カウントアップの値を使わない(回帰テストで固定)
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 点数リングのカウントアップ自体をやめる・短くする(演出として残す)
- 通知(操作結果)の表示タイミングを遅らせる(通知は差分 `(+10)` だけで合計点を言わないので、リングと食い違わない)
- `ClearScreen` の 0→100 の演出(ツアー中は出ない。別の画面)
- リングとツアーの数え上げを1つの時計で揃える仕組み(上の ponytail コメントのとおり、必要になったら)
- ツアーの手順・文言の見直し
