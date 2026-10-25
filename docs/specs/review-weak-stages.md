# review-weak-stages: 答えやヒントに頼って100点にしたステージに「もう一度自力で」の印を付け、復習のおすすめを出す

## 背景・目的

学習者として実際に遊んでみて、次の不足が見つかった。

- 「解答を再生」で手順を見てからその通りに動かして100点にしても、ヒントの「次の一手」を最後まで開いて100点にしても、
  ステージ一覧(`StageRoadmapDialog`)では自力で解いたときと同じ `✅ クリア` になる。
  あとから「あのステージは自力で解けていなかった」と振り返る材料が何も残らない。
- 「次のおすすめ」(`src/domain/progress/roadmap.ts` の `recommendNextStage`)は、並び順で最初の100点未満のステージを返すだけで、
  100点を取ったステージを勧めることはない。復習の導線がない。

学習は、つまずいたところをもう一度自分で解くことで定着する。そこで、ステージごとに「どこまで助けを使って100点にしたか」を記録し、
ステージ一覧で「もう一度自力で」の印と「復習のおすすめ」を出す。

## 「助け」として数える操作(実装を grep して確定)

ツールバーの「ヒント ▾」(`HintPopover`)と「参考・答え ▾」(`ReferenceMenu`)にある操作を、助けの強さの順に並べる。

| 操作 | 実装の場所 | 数えるか | 記録する段階(`AssistLevel`) |
| --- | --- | --- | --- |
| ヒント1「どこが問題?」 | `ProblemHint` → `useStageHintState().revealProblem`(`StagePanel.tsx`) | 数えない | ― |
| ヒント2「次の一手」(1つでも開いたら) | `HintButton` → `useStageHintState().revealStep`。答えの確認ダイアログの「ヒントを見る」(`ReferenceMenu` の `onRevealHint`)も、問題を開いた後は同じ `revealStep` を通る | 数える | `'step'` |
| ヒント3「動きで見る」 | `GhostHintButton` の `onClick`(`playGhost(move)`) | 数える | `'ghost'` |
| 解答例の図を見る | `ReferenceMenu` で `setPreview('sample')` が実際に呼ばれたとき | 数える | `'answer'` |
| 解答を再生 | `ReferenceMenu` で `setReplaying(true)` が実際に呼ばれたとき | 数える | `'answer'` |
| 変更前の図を見る | `ReferenceMenu` の `setPreview('before')` | 数えない | ― |
| 確認ダイアログ(`answer-confirm`)を開いただけ・「やめる」 | `ReferenceMenu` の `pendingAnswer` | 数えない | ― |
| 減点の内訳・AI講評・変更のうわさ | `ScoreBreakdown`・`CritiqueButton`・`RumorPopover` | 数えない | ― |

段階の強さは `'step' < 'ghost' < 'answer'` とする。

## 設計判断(確定)

1. **「どこが問題?」は助けとして数えない。** 一番大きい減点のルールを光らせるだけで、内容はいつでも見られる減点の内訳と同じ。
   これを数えると、ほとんどのクリアに印が付いてしまい、印の意味が薄れる。答えの手順(次の一手)を見たところから数える。
2. **記録は2つの値で持つ。** ステージごとに
   - `attempt`: 今のコード(初期コードから、または最後の「最初に戻す」からの作業)で使った一番強い助け
   - `clearedWith`: 100点にしたときに使っていた助け(自力なら持たない)
   を持ち、`attempt` も保存する。下書き(`refactor-blocks:drafts`)がリロード後も残るので、
   「答えを見る → リロード → 続きから100点」で助けが消えないようにするため。
3. **`attempt` を消すのは「最初に戻す」(`resetStage`)だけ。** コードが初期状態に戻ったときだけ「やり直し」とみなす。
   ステージの切り替えやリロードでは消さない(下書きから続きを再開するため)。
4. **印は「一番良いクリア」で決める。** すでに100点を取っているステージを、もっと弱い助け(または自力)でもう一度100点にしたら印を弱める・消す。
   もっと強い助けで100点を取り直しても、印は強めない・付けない(例: 自力で解いたあと、答え合わせに解答例を見てからステージを開き直しても印は付かない)。
5. **古いデータは「記録なし=自力」として読む。** 新しいキーが無い・壊れているときは空として扱い、
   すでに `✅ クリア` のステージに印は付かない。4により、記録が無いまま100点のステージに、あとから印が付くこともない。
6. **保存は別のキー `refactor-blocks:assists` にする。** 既存の `refactor-blocks:progress`(自己ベスト)の形は変えない。
   到達段階を記録する別仕様 clear-means-learned とも、キーと型を分けて干渉させない。
7. **復習のおすすめは、印の付いたステージのうち並び順で最初のもの。** ステージは難易度順に並んでおり、前のステージが後の土台になるため、
   助けの強さ順ではなく `recommendNextStage` と同じ並び順にする(予測しやすさも優先)。
8. **表示はステージ一覧だけ。** 100点のときの `NextStageCard` には復習を出さない(クリア直後に「もう一度」を勧めても、
   答えがまだ頭に残っていて効果が薄い)。
9. **印は見える文字で助けの種類まで書く。** カードはボタンで、中の文字がそのまま読み上げ名になる。`title` だけに頼らず、
   `もう一度自力で(答えを見てクリア)` のように本文に書く。

本当に別の保存キーと2つの値が要るか: `clearedWith` だけだと、リロードを挟むと助けが消える(2)。
既存の `Progress` に入れると数値だけの形(`isProgress`)が壊れ、古いデータとの互換を崩す(6)。この2つで最小と判断した。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/progress/assists.ts` | domain | `AssistLevel`・`Assists` の型と、記録・判定の純粋関数 |
| 新規 | `src/domain/progress/assists.test.ts` | domain | 上のテスト(先に書く) |
| 変更 | `src/domain/progress/roadmap.ts` | domain | `recommendReviewStage` を追加 |
| 変更 | `src/domain/progress/roadmap.test.ts` | domain | `recommendReviewStage` のテスト(先に書く) |
| 新規 | `src/infrastructure/progress/assistStorage.ts` | infrastructure | `refactor-blocks:assists` の読み書きと信頼境界での検証(`progressStorage.ts`・`draftStorage.ts` と同じ作り) |
| 新規 | `src/infrastructure/progress/assistStorage.test.ts` | infrastructure | 検証のテスト(壊れた値・不正なエントリ) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `assists` 状態と `recordAssist` を追加。`recordProgress` で100点のときにクリアを記録、`resetStage` で `attempt` を消す |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `useStageHintState().revealStep` で `recordAssist('step')` |
| 変更 | `src/presentation/stage/GhostHintButton.tsx` | presentation | 「動きで見る」を押したら `recordAssist('ghost')` |
| 変更 | `src/presentation/stage/ReferenceMenu.tsx` | presentation | 解答例の図・解答の再生を実際に開いたら `recordAssist('answer')`(`useReferenceAnswer` の `openAnswer` の確認済みの経路と `chooseAnswer` の両方) |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | 「もう一度自力で」の印と「復習のおすすめ」の行 |
| 変更 | `src/index.css` | presentation | 印のスタイル(`stage-roadmap__recommend` と同じ大きさ) |
| 新規 | `e2e/review-weak-stages.spec.ts` | E2E | 受け入れ基準を確かめる |

`application` 層は変更しない(既存の自己ベストの記録もストアから domain を直接呼んでいる。`recordProgress` と同じ作りに合わせる)。新しい依存は足さない。

## データ・型の変更

`src/domain/progress/assists.ts`:

```ts
/** 100点に向けて使った助けの段階。弱い順に 'step'(次の一手)< 'ghost'(動きで見る)< 'answer'(解答例の図・解答の再生)。 */
export type AssistLevel = 'step' | 'ghost' | 'answer';

export type StageAssists = {
  /** 今のコード(最後の「最初に戻す」以降)で使った一番強い助け。使っていなければ持たない。 */
  readonly attempt?: AssistLevel;
  /** 100点にしたときの助け(一番弱かったクリア)。自力・記録なしなら持たない。 */
  readonly clearedWith?: AssistLevel;
};

/** ステージIDごとの助けの記録。 */
export type Assists = Readonly<Partial<Record<string, StageAssists>>>;
```

関数(すべて元の `Assists` を変更せず新しい値を返す。変わらないときは同じ参照を返す。失敗の起きない操作なので `Result` は使わない):

```ts
export function markAssist(assists: Assists, stageId: string, level: AssistLevel): Assists;
export function resetAttempt(assists: Assists, stageId: string): Assists;
export function recordClear(assists: Assists, stageId: string, alreadyCleared: boolean): Assists;
/** 「もう一度自力で」の印。clearedWith を返す。 */
export function retryMark(assists: Assists, stageId: string): AssistLevel | undefined;
```

`src/domain/progress/roadmap.ts` に追加:

```ts
/** 並び順で最初の、自己ベスト100で retryMark があるステージ。無ければ undefined。 */
export function recommendReviewStage(stages: readonly Stage[], progress: Progress, assists: Assists): Stage | undefined;
```

保存形式(`localStorage` の `refactor-blocks:assists`、JSON):

```json
{ "tutorial-extract-method": { "attempt": "answer", "clearedWith": "answer" }, "tutorial-order-service": { "attempt": "step" } }
```

- 読み込み(`loadAssists`)は、`draftStorage.ts` の `loadDrafts` と同じく、全体が壊れていれば `{}`、
  エントリ単位で不正なもの(オブジェクトでない・`attempt`/`clearedWith` が3つの値以外)は捨てる。例外は投げない
- 書き込み(`saveAssists`)は書けなくても画面を壊さない(`saveProgress` と同じ)
- `refactor-blocks:progress` の形は変えない

ストア(`GameState`)に追加・変更:

- `assists: Assists`(初期値 `loadAssists()`。`progress` と同じく `saveDraftsOn` に関係なく読み書きする)
- `recordAssist: (level: AssistLevel) => void` — 今のステージ(`get().stage.id`)に `markAssist` し、変わったら保存
- `recordProgress(stageId, score)`: 更新前の `progress[stageId]` が100以上かを `alreadyCleared` として取り、
  `score >= 100` なら `recordClear` して、変わったら保存する。今の「自己ベストが変わらなければ return」より前に行う(100点を取り直したときも印を弱められるように)
- `resetStage`: 変更依頼中で弾かれなかったとき、今のステージに `resetAttempt` して保存する

## 動きの仕様

### 記録

- 上の表の「数える」操作をすると、そのステージの `attempt` が、今より強い段階なら上がる(弱い段階では下がらない)
- 採点の対象のコードが100点になったとき(`recordProgress` が100で呼ばれたとき)
  - そのステージを初めて100点にしたなら、`clearedWith` を `attempt` にする(`attempt` が無ければ何も付けない=自力)
  - すでに100点を取っていたなら、`clearedWith` がある場合だけ、`attempt` と比べて弱いほうにする(`attempt` が無ければ消す)
- 「最初に戻す」で `attempt` を消す。`clearedWith` は消さない(印は自力で100点を取り直すまで残る)

### ステージ一覧(`StageRoadmapDialog`)

- `roadmap-next`(「次のおすすめ: …」)の下に、復習のおすすめがあるときだけ
  `復習のおすすめ: <ステージ名>(もう一度自力で)`(`<p className="stage-roadmap__next" data-testid="roadmap-review">`)を出す
- 印の付いたステージのカードの状態欄に、`✅ クリア` に続けて印
  `<span className="stage-roadmap__retry" data-testid="roadmap-retry-<stageId>">` を出す。本文は段階ごとに次のとおり
  - `'step'` → `もう一度自力で(次の一手を見てクリア)`
  - `'ghost'` → `もう一度自力で(動きで見てクリア)`
  - `'answer'` → `もう一度自力で(答えを見てクリア)`
- 復習のおすすめのカードには、今の「おすすめ」と同じ見た目(`stage-roadmap__recommend`)で ` 復習` を添える
- 印もおすすめも無いときの表示は今と変わらない。`stageStatus` と `describeStatus` は変えない

### 自力で解き直したとき

- 復習のおすすめのステージを開くと、下書きから100点のコードが復元される(今と同じ。`DraftRestoredNotice` が「最初に戻す」を案内する)。
  この時点では `attempt` が残っているので、印は消えない
- 「最初に戻す」を押し、助けを使わずに100点にすると、そのステージの印が消え、復習のおすすめから外れる

## TDD対象

### `markAssist`(domain)

- 記録が空 → `'step'` を記録すると `{ [id]: { attempt: 'step' } }`
- `attempt: 'step'` → `'answer'` を記録すると `'answer'` に上がる
- `attempt: 'answer'` → `'step'` を記録しても変わらない(同じ参照を返す)
- 他のステージの記録・同じステージの `clearedWith` は変えない

### `resetAttempt`(domain)

- `{ attempt: 'ghost', clearedWith: 'ghost' }` → `attempt` だけ消え `{ clearedWith: 'ghost' }`
- 記録が無い・`attempt` が無いステージ → 同じ参照を返す

### `recordClear`(domain)

- 初めての100点(`alreadyCleared: false`)、`attempt: 'answer'` → `clearedWith: 'answer'`
- 初めての100点、`attempt` なし → 変わらない(同じ参照。自力)
- 100点済み(`alreadyCleared: true`)、`clearedWith` なし(自力または古いデータ)、`attempt: 'answer'` → 変わらない(印を付けない)
- 100点済み、`clearedWith: 'answer'`、`attempt: 'step'` → `clearedWith: 'step'` に弱まる
- 100点済み、`clearedWith: 'step'`、`attempt: 'answer'` → 変わらない(強めない)
- 100点済み、`clearedWith: 'ghost'`、`attempt` なし → `clearedWith` が消える
- 100点済み、`clearedWith: 'ghost'`、`attempt: 'ghost'` → 変わらない(同じ参照)

### `retryMark`(domain)

- `clearedWith: 'ghost'` のステージ → `'ghost'`
- 記録が無い・`attempt` だけのステージ → `undefined`

### `recommendReviewStage`(domain、`roadmap.test.ts`)

- 記録が空 → `undefined`
- `a`・`b`・`c` が100点で、`b` と `c` に `clearedWith` → `b`(並び順で最初)
- `clearedWith` があっても自己ベストが100未満のステージ(壊れた組み合わせ)→ 選ばない
- `attempt` だけ(まだ100点でない作業中)のステージ → 選ばない
- `stages` が空 → `undefined`

### `loadAssists` / `saveAssists`(infrastructure、信頼境界)

- キーが無い → `{}`
- JSON でない・配列・`null` → `{}`
- `{ a: { attempt: 'answer' }, b: { attempt: 'hint' }, c: 3 }` → `{ a: { attempt: 'answer' } }`(不正なエントリだけ捨てる)
- `saveAssists` で書いた値を `loadAssists` で読むと同じ値になる
- `localStorage` が例外を投げる → `loadAssists` は `{}`、`saveAssists` は何も起きない(`lastStageStorage.test.ts` と同じ確かめ方)

## 受け入れ基準

1. 新しいブラウザ(記録なし)でチュートリアル1を開き、「参考・答え ▾」→「解答を再生」→確認で「答えを見る」で再生を開いてから、自分で操作して100点にする。
   ステージ一覧を開くと、チュートリアル1のカードに `✅ クリア` と `もう一度自力で(答えを見てクリア)` が出て、
   `復習のおすすめ: チュートリアル1: 長いメソッドを分ける(もう一度自力で)` が出る。「次のおすすめ」はチュートリアル2のまま
2. 1のあとページを再読み込みしても、印と復習のおすすめが残っている
3. 「ヒント ▾」で「どこが問題?」だけを開いて100点にしたステージには、印が付かない
4. 「ヒント ▾」で「次の一手」を1つ開いてから100点にしたステージには `もう一度自力で(次の一手を見てクリア)` が付く
5. 1の状態からチュートリアル1を開き、「最初に戻す」を押して、助けを使わずに100点にすると、印と復習のおすすめが消える
6. 助けを使わずに100点にしたあとで「解答例の図を見る」を開き、ページを再読み込みしても、印は付かない
7. 解答例の図を見たあと、100点にする前にページを再読み込みし、下書きの続きから100点にしても、印が付く
8. この機能の前から `refactor-blocks:progress` に100点の記録があり、`refactor-blocks:assists` が無い状態で開くと、印も復習のおすすめも出ず、今までどおり `✅ クリア` だけが出る
9. `refactor-blocks:assists` に壊れた値(`'{'` など)が入っていても、画面は普通に開き、印は出ない
10. 既存の `e2e/roadmap.spec.ts`・`e2e/next-stage-after-clear.spec.ts` が変更なしで通る
11. `npm run check` と `npm run test:e2e` が通る

E2E では100点にする手順に `e2e/next-stage-after-clear.spec.ts` の `clearTutorial1` と同じ操作を使い、古いデータ・壊れた値は `page.addInitScript` で `localStorage` に入れて再現する。

## スコープ外

- クリア時の到達段階の記録(別仕様 clear-means-learned。記録は `refactor-blocks:assists` と別のキー・別の型で持ち、この仕様では触らない)
- 100点のときのカード(`NextStageCard`、next-stage-after-clear)に復習を出すこと
- 次のおすすめ(`recommendNextStage`、stage-roadmap)の選び方の変更
- 助けを使ったことの採点(点数)への反映(toolbar-answer-menu でもスコープ外にしたまま)
- 答えの確認ダイアログ(toolbar-answer-menu)の文言・挙動の変更
- 「最初に戻す」のあと「元に戻す」で助けを使ったコードに戻した場合の扱い(`attempt` は消えたまま)。
  実装時に `resetStage` へ `// ponytail: 最初に戻すのあとの元に戻すで attempt は戻らない。抜け道として問題になったら、履歴の各コードに attempt を持たせる` を残す
- 変更依頼(`ChangeRequest`)・仕上げの手直し中の操作を数えること(どちらも100点のあとなので、クリアの記録に関係しない)
- 記録を消すボタン・設定画面
- AI講評・減点の内訳・変更のうわさを助けとして数えること
