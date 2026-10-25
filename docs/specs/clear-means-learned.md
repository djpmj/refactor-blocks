# clear-means-learned: 「✅ クリア」を、100点・理解度チェック・変更依頼をすべて終えたステージにだけ付ける

## 背景・目的

学習者として実機で遊ぶと、ステージ一覧ではチュートリアル1を1回抽出して100点にしただけで「✅ クリア」が付く。
理解度チェックに答えておらず、変更依頼にも挑戦していない。
このゲームで学ぶ中心は「冒頭の手直し → 組み替え → 仕上げの手直し → 理解度チェック → 変更依頼」の流れ(`post-perfect-flow`)である。
ところが、一覧の状態(`src/domain/progress/roadmap.ts` の `stageStatus`)と「次のおすすめ」(`recommendNextStage`)は、
保存している自己ベスト(`Progress`)の点数しか見ていない。

- 一覧を見ても、どのステージで何を終えたのか(学んだことが身についたのか)が分からない
- 「次のおすすめ」は100点を取った時点で次のステージへ進み、理解度チェックと変更依頼を飛ばしても気付けない
- 100点の画面の「ステージクリア」カード(`NextStageCard`)は、残りがあっても次のステージへの移動を勧める

そこで、理解度チェックと変更依頼を終えたことを「到達段階」としてステージごとに保存する。
一覧・おすすめ・100点のカードがその段階を見るようにする。

本当に新しい段階の仕組みが要るのか、`stageStep`(`domain/change/stageStep.ts`)で足りないのかも確かめた。
`stageStep` は「今のタブで今どこにいるか」を返すだけで、保存されず、理解度チェックも含まない。
一覧には再読み込みしても残る記録が要るため、保存する記録を足す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/progress/milestones.ts` | domain | 到達段階の型、`addMilestone`、`remainingMilestones` |
| 新規 | `src/domain/progress/milestones.test.ts` | domain | 上のテスト |
| 変更 | `src/domain/progress/roadmap.ts` | domain | `stageStatus` に `perfect`(100点だが残りあり)を足し、`cleared` は残りが無いときだけにする。`recommendNextStage` は到達段階も見る |
| 変更 | `src/domain/progress/roadmap.test.ts` | domain | 上のテスト(既存ケースを新しい引数に合わせて残す) |
| 変更 | `src/application/ChangeRequestUseCases.ts` | application | `isChangeChallengeCleared`(変更依頼を全件、解答例と同じ点以上で確定したか) |
| 変更 | `src/application/ChangeRequestUseCases.test.ts` | application | 上のテスト |
| 変更 | `src/infrastructure/progress/progressStorage.ts` | infrastructure | `isMilestones` / `loadMilestones` / `saveMilestones`(キー `refactor-blocks:milestones`) |
| 変更 | `src/infrastructure/progress/progressStorage.test.ts` | infrastructure | `isMilestones` のテスト(信頼境界の検証なのでテストする) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `milestones` と `recordMilestone` を `progressActions` に足す。最後の変更依頼を確定したとき(`advanceChangeRequest`)に `'change-request'` を記録する |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 記録のテスト |
| 変更 | `src/presentation/stage/ConceptCheckPanel.tsx` | presentation | 全問正解したときに呼ぶ `onAllCorrect` を受け取る |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `ConceptCheckPanel` に `onAllCorrect={() => recordMilestone(stage.id, 'concept-check')}` を渡す |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | `perfect` の表示(残りの段階)を足し、`stageStatus` / `recommendNextStage` に到達段階を渡す |
| 変更 | `src/presentation/stage/NextStageCard.tsx` | presentation | 残りがあるときは見出しを「100点達成」にして残りを出す。おすすめは今のステージを除いて求める |
| 新規 | `e2e/clear-means-learned.spec.ts` | E2E | 受け入れ基準1〜6を確かめる |
| 変更 | `e2e/next-stage-after-clear.spec.ts` | E2E | 新しい見出し・残りの表示と、全ステージクリア済みの準備(到達段階も保存する)に合わせる |

`Progress` 型・`updateProgress`・`refactor-blocks:progress` の保存形式は変更しない(下の「設計判断」を参照)。新しい依存は足さない。

## データ・型の変更

### domain(`src/domain/progress/milestones.ts`)

```ts
/** 100点のあとに終える段階。並び順はゲームの流れの順(一覧の表示もこの順)。 */
export type StageMilestone = 'concept-check' | 'change-request';

/** ステージIDごとの、終えた段階。100点かどうかは Progress(自己ベスト)が持つので、ここには持たない。 */
export type Milestones = Readonly<Partial<Record<string, readonly StageMilestone[]>>>;

/** 段階を記録する。すでに記録済みなら同じ参照を返す(保存を省けるように。updateProgress と同じ約束)。 */
export function addMilestone(milestones: Milestones, stageId: string, milestone: StageMilestone): Milestones;

/**
 * そのステージで、まだ終えていない段階(StageMilestone の並び順)。
 * 理解度チェックが0問のステージは 'concept-check' を、変更依頼が0件のステージは 'change-request' を求めない。
 */
export function remainingMilestones(
  stage: Pick<Stage, 'id' | 'checks' | 'changeRequests'>,
  milestones: Milestones,
): readonly StageMilestone[];
```

### domain(`src/domain/progress/roadmap.ts`)

```ts
export type StageStatus =
  | { readonly kind: 'not-started' }
  | { readonly kind: 'in-progress' }
  | { readonly kind: 'scored'; readonly best: number }
  /** 自己ベスト100点だが、残りの段階がある(remaining は空でない)。 */
  | { readonly kind: 'perfect'; readonly remaining: readonly StageMilestone[] }
  /** 自己ベスト100点で、残りの段階も無い。 */
  | { readonly kind: 'cleared' };

export function stageStatus(
  stage: Pick<Stage, 'id' | 'checks' | 'changeRequests'>,
  progress: Progress,
  milestones: Milestones,
  hasDraft: boolean,
): StageStatus;

/** 並び順で最初の、クリア(100点かつ残りの段階なし)していないステージ。全部クリアしていれば undefined。 */
export function recommendNextStage(stages: readonly Stage[], progress: Progress, milestones: Milestones): Stage | undefined;
```

### application(`src/application/ChangeRequestUseCases.ts`)

```ts
/**
 * 変更依頼をすべて確定し、どの依頼も解答例と同じ点以上で置けたか。
 * 解答例が無い依頼(sample が undefined)は、比べる相手が無いので満たしたとみなす。
 */
export function isChangeChallengeCleared(outcomes: readonly ChangeOutcome[], requestCount: number): boolean;
// requestCount > 0 && outcomes.length === requestCount
//   && outcomes.every((o) => o.placement.score.total >= (o.sample?.score ?? 0))
```

### infrastructure(`src/infrastructure/progress/progressStorage.ts`)

```ts
const MILESTONES_KEY = 'refactor-blocks:milestones';

/** localStorage から読んだ値が Milestones(文字列キー → 既知の段階名の配列)の形か。信頼境界の入力検証。 */
export function isMilestones(value: unknown): value is Milestones;
/** 壊れている・形が違う・存在しないときは空を返す(例外は投げない)。 */
export function loadMilestones(): Milestones;
/** 書き込めない環境でも画面を壊さない(saveProgress と同じ)。 */
export function saveMilestones(milestones: Milestones): void;
```

保存例: `{"tutorial-extract-method":["concept-check","change-request"]}`

### presentation(ストア)

```ts
// GameState に足す
milestones: Milestones;               // 初期値は loadMilestones()
recordMilestone: (stageId: string, milestone: StageMilestone) => void;
// addMilestone の結果が同じ参照なら何もしない。違えば saveMilestones して set する(recordProgress と同じ形)
```

## 動きの仕様

### 記録するとき

- **理解度チェック**: `ConceptCheckPanel` で、1回の挑戦(「もう一度」で区切られる回)の全問に答え、**全問正解**したとき、`onAllCorrect()` を呼ぶ。
  `StagePanel` はそれを `recordMilestone(stage.id, 'concept-check')` につなぐ。
  答えを入れる処理(`onAnswer`)の中で次の回答を計算して判定し、`useEffect` は使わない。
  不正解が混ざった回では記録しない。「もう一度」で全問正解すれば記録する
- **変更依頼**: `advanceChangeRequest` で最後の依頼を確定したとき(進めたあとの `index` が `stage.changeRequests.length` と等しい)、
  確定した `outcomes` に対して `isChangeChallengeCleared(outcomes, stage.changeRequests.length)` が `true` なら `recordMilestone(stage.id, 'change-request')` する。
  途中で「リファクタリングに戻る」(`endChangeRequests`)を押して抜けたときは記録しない
- 一度記録した段階は消さない(「最初に戻す」・ステージの切り替え・点数が下がった、のどれでも消さない)

### ステージ一覧(`StageRoadmapDialog`)

| `StageStatus` | 表示 |
| --- | --- |
| `not-started` / `in-progress` / `scored` | 今のまま(`未挑戦` / `挑戦中` / `N点`) |
| `perfect` | `100点(あと: 理解度チェック・変更依頼)`。残りの名前は `StageMilestone` の並び順で `・` でつなぐ(`'concept-check'` → `理解度チェック`、`'change-request'` → `変更依頼`) |
| `cleared` | `✅ クリア`(今と同じ文言) |

- 「次のおすすめ」は新しい `recommendNextStage` の結果を出す。100点で残りがあるステージは、おすすめとして残る(並び順で先にあれば、それが出る)
- 「全ステージをクリアしました」は、全ステージが `cleared` のときだけ出る
- アイコンや色だけに頼らず、残りは文字で出す

### 100点のカード(`NextStageCard`)

- 出る条件は今のまま(100点、`StoryOutro` が出ていない、変更依頼・手直しの最中でない)
- おすすめは**今のステージを除いた**一覧で求める: `recommendNextStage(stages.filter((s) => s.id !== stage.id), progress, milestones)`。
  これで「記録が追いつく前の一瞬は自分自身がおすすめに出る」ための早期 `return null` は要らなくなるので消す
- 今のステージの残り `remainingMilestones(stage, milestones)` によって出し方を変える

| 残り | 見出し | 本文 |
| --- | --- | --- |
| 空 | `ステージクリア`(今と同じ) | 今と同じ(`次のおすすめ: <名前>` + `次のステージへ`、または `全ステージをクリアしました`) |
| 空でない | `100点達成` | `このステージの残り: 理解度チェック・変更依頼`(`data-testid="next-stage-remaining"`)。続けて、おすすめがあれば `次のおすすめ: <名前>` + `次のステージへ`。おすすめが無ければそれ以上は出さない(`全ステージをクリアしました` は出さない) |

- 次のステージへ進むボタンは残りがあっても出す(学習者が先へ進むのを止めない。残りは一覧とこのカードで見えるようにする)

## 設計判断(確定)

1. **到達段階は別のキー(`refactor-blocks:milestones`)に保存し、`Progress` の形は変えない。**
   `Progress` は `updateProgress` と、まだ実装していない `untouched-stage-not-scored` が前提にしている形である。
   値を数値からオブジェクトへ変えると、両方と既存の保存データの読み込みを同時に直すことになる。
   別のキーにすれば、古い保存データ(点数だけ)は「到達段階なし = 100点のみ」としてそのまま読め、移し替えの処理は要らない。
   どちらも `progressStorage.ts` に置き、「進捗の保存」を1か所にまとめる。
2. **✅ は全段階を終えたステージだけに付け、100点で残りがあるステージには残りの段階を文字で出す。**
   「クリア」を「学んだ」の意味に揃えるため。段階アイコンを並べる案もあるが、新しい見た目の部品が要るうえ、色やアイコンだけでは読み上げで伝わりにくい。
   そのため文字にする。
   今まで100点で ✅ だったステージは、保存し直さなくても「100点(あと: 理解度チェック・変更依頼)」になる(意図した変化)。
3. **理解度チェックは「1回の挑戦で全問正解」で記録する。** 答えただけで記録すると、適当に押しても済んでしまう。
   「もう一度」で何度でもやり直せ、不正解には解説が出るので、全問正解を求めても詰まらない。
4. **変更依頼は「全件を確定し、どの依頼も解答例と同じ点以上」で記録する。** 置き方100点を求めると、解答例でも100点にならない既知の例外
   (`stageCatalog.test.ts` の `knownChangeRequestExceptions`)があるステージでは、いつまでも段階が終わらない。
   比べる相手は、結果カードにすでに出ている解答例の点(`ChangeOutcome.sample.score`)にする。
   1件ごとに「置き直す」でやり直せる(`change-request-step-feedback`)ので、基準に届くまで試せる。
   判定は `ChangeOutcome`(application の型)を受け取るため、domain ではなく application に置く。
5. **`recommendNextStage` は、100点で残りがあるステージもおすすめに残す。** 「次のおすすめ」が点数だけで決まる、という不足点を直すため。
   一方、100点の画面のカードは今のステージを除いておすすめを求める。
   これは、すでに入れた「100点のあと次へ進む入口」(`next-stage-after-clear`)を消さず、残りは文字で知らせるため。
6. **理解度チェックの判定は今の `judgeCheck`(`domain/stage/conceptCheck.ts`)をそのまま使う。** 新しい domain 関数は足さない。

## TDD対象

### `addMilestone`(domain)

- 空の記録に `('a', 'concept-check')` → `{ a: ['concept-check'] }`
- `{ a: ['concept-check'] }` に `('a', 'change-request')` → `{ a: ['concept-check', 'change-request'] }`
- すでに `'concept-check'` がある → 同じ参照を返す
- 別のステージ `b` の記録は変えない(元の `Milestones` も書き換えない)

### `remainingMilestones`(domain)

- 理解度チェック2問・変更依頼1件、記録なし → `['concept-check', 'change-request']`
- 同じステージで `'change-request'` だけ記録 → `['concept-check']`
- 両方記録 → `[]`
- 理解度チェック0問 → `'concept-check'` を求めない(変更依頼だけ残る)
- 変更依頼0件 → `'change-request'` を求めない
- 記録の並びが `['change-request', 'concept-check']` でも、返す順は `StageMilestone` の並び順

### `stageStatus`(domain)

- 既存の4ケース(未挑戦・挑戦中・N点・下書きの有無)は、引数を `(stage, progress, milestones, hasDraft)` に合わせて残す
- 自己ベスト100・記録なし → `{ kind: 'perfect', remaining: ['concept-check', 'change-request'] }`
- 自己ベスト100・両方記録 → `{ kind: 'cleared' }`
- 自己ベスト100・理解度チェック0問・変更依頼0件のステージ → `{ kind: 'cleared' }`
- 自己ベスト60・両方記録(古い記録など) → `{ kind: 'scored', best: 60 }`(100点が先)

### `recommendNextStage`(domain)

- 既存のケースは、到達段階を全ステージ済みにして残す(点数だけで決まるケースとして)
- `a` が100点で残りあり・`b` が未挑戦 → `a`
- `a` が100点で全段階済み・`b` が100点で残りあり → `b`
- 全ステージが100点で全段階済み → `undefined`
- `stages` が空 → `undefined`

### `isChangeChallengeCleared`(application)

- 2件とも確定、置き方100・解答例100 → `true`
- 1件目が置き方90・解答例100 → `false`
- 置き方80・解答例80(解答例でも100にならない依頼) → `true`
- 解答例が無い(`sample: undefined`)依頼 → その依頼は満たしたとみなす
- 確定が1件だけで依頼は2件 → `false`
- 依頼が0件・確定も0件 → `false`

### `isMilestones`(infrastructure。信頼境界の検証)

- `{ 'stage-1': ['concept-check', 'change-request'] }` → `true`
- `{}` → `true`
- 値が配列でない(`{ 'stage-1': 'concept-check' }`)→ `false`
- 知らない段階名(`['quiz']`)・文字列でない要素 → `false`
- `null`・配列・プリミティブ → `false`

### ストア(`useGameStore.test.ts`)

- `recordMilestone` で `milestones` が変わり、同じ段階を2回記録しても参照が変わらない
- 変更依頼を全件、解答例どおりに置いて最後まで確定すると `milestones[stage.id]` に `'change-request'` が入る
- 途中で `endChangeRequests` すると入らない

## 受け入れ基準

1. `localStorage` をまっさらにして、チュートリアル1を1回抽出して100点にし、ステージ一覧を開く。
   チュートリアル1は `✅ クリア` ではなく `100点(あと: 理解度チェック・変更依頼)` と出て、「次のおすすめ」はチュートリアル1のまま
2. 続けて理解度チェックで1問間違えると、一覧は変わらない。「もう一度」で全問正解すると、`100点(あと: 変更依頼)` になる
3. 仕上げの手直しを正解して変更依頼に挑戦し、全件を解答例どおりに置いて最後まで確定すると、一覧が `✅ クリア` になり、「次のおすすめ」がチュートリアル2になる。
   再読み込みしても `✅ クリア` のまま(`refactor-blocks:milestones` に残る)
4. 変更依頼の途中で「リファクタリングに戻る」を押した場合や、解答例より低い置き方のまま確定した場合は、`(あと: 変更依頼)` のまま
5. 点数だけの古い保存データ(`refactor-blocks:progress` に `{"tutorial-extract-method":100}` だけがあり、`refactor-blocks:milestones` が無い)で開く。
   一覧は `100点(あと: 理解度チェック・変更依頼)` と出て、画面は壊れない。
   `refactor-blocks:milestones` に壊れた値(`"{"`、`{"a":"x"}` など)を入れて開いても、記録なしとして読まれ、画面は壊れない
6. ストーリーをオフにして、チュートリアル1を100点にしただけのとき、左パネルのカードは見出し `100点達成`、`このステージの残り: 理解度チェック・変更依頼`、`次のおすすめ: チュートリアル2: 太った placeOrder` と `次のステージへ` を出す。
   全段階を終えたあとは、見出しが `ステージクリア` になる
7. `e2e/next-stage-after-clear.spec.ts` は、1件目を受け入れ基準6の表示に合わせて直す。
   「全ステージをクリア済み」の準備では、`refactor-blocks:milestones` にも全ステージの2段階を保存する。
   ほかのケースはそのまま通る
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 冒頭・仕上げの手直し(`post-perfect-flow` の `openingFixes` / `closingFixSolved`)の記録・一覧への表示。
  到達段階は今回、理解度チェックと変更依頼の2つだけにする(手直しは変更依頼の前提なので、変更依頼を終えていれば済んでいる)
- 理解度チェックの回答そのもの(選んだ選択肢・正答数)の保存
- 変更依頼の点数の保存・一覧への表示
- ストーリーがオンのときの「第1章 おわり / 次の章へ」(`StoryOutro`)の出し方の変更(残りがあっても今どおり出す)
- 白紙設計モード(`blank-design-mode`)・設計比較クイズ(`design-comparison-quiz`)の記録
- 開いただけのステージを点数として記録しない件(`untouched-stage-not-scored` で扱う)
- 到達段階を消す(記録をリセットする)操作
- 段階を表すアイコン・ステッパーなどの新しい見た目の部品
