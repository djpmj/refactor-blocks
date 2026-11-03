# recommend-next-skip-just-cleared: 100点にして次へ進んだのに「次のおすすめ」が前のステージに戻る

小さな不具合修正用の短い型。

## 症状

実機(2026-11-03)での再現手順:

1. チュートリアル1「長いメソッドを分ける」を100点にする(理解度チェック・変更依頼はやらない)
2. ストーリーの「次の章へ」でチュートリアル2に進む
3. ステージ一覧を開く

見えたもの:

- 最上部が「次のおすすめ: チュートリアル1: 長いメソッドを分ける」のまま
- チュートリアル1のカードに「100点(あと: 理解度チェック・変更依頼) おすすめ」と出る

いま遊んでいるのはチュートリアル2で、1はもう100点なのに、おすすめが1に戻ってしまう。

## 原因

`src/domain/progress/roadmap.ts` の `recommendNextStage(stages, progress, milestones)` が
「並び順で最初の、`stageStatus` が `cleared` ではないステージ」を返している。`cleared` は
「100点かつ理解度チェック・変更依頼も済み」(clear-means-learned.md)なので、100点で任意の段階が
残っている(`perfect`)ステージが、並び順で先にあれば必ずおすすめに戻ってくる。いま開いているステージも見ていない。

呼び出し元(grep 済み、この3か所だけ):

| ファイル | 呼び方 |
|---|---|
| `src/presentation/stage/StageRoadmapDialog.tsx` | `recommendNextStage(stages, progress, milestones)`(今のステージを考えない。今回の症状) |
| `src/presentation/stage/ClearScreen.tsx` | 今のステージを除いた一覧で呼び、結果が今のステージなら `undefined` にする |
| `src/presentation/stage/NextStageCard.tsx` | 今のステージを除いた一覧で呼ぶ |

ClearScreen / NextStageCard は今のステージだけを除いているので、同じ問題(100点で段階が残る前のステージに戻る)を
潜在的に持っている。`recommendNextStage` 1か所を直し、3つの呼び出し元を同じ呼び方にそろえる。

## 修正

### 決めたこと(未決事項は残さない)

1. **「次のおすすめ」は100点未満(記録なしを含む)のステージだけから選ぶ。** 100点で段階が残るステージは
   おすすめにしない。clear-means-learned.md の決定5(「100点で残りがあるステージもおすすめに残す」)はここで改める。
2. **探す順は「今のステージ → 今より後ろ(`stages` の並び順=章の順) → 先頭に戻って今より前」。** 最初に見つかった100点未満を返す。
   - 今のステージが100点未満なら、今のステージがおすすめ(初めての人がチュートリアル1を開いたまま一覧を開くと、チュートリアル1。今の動きと同じ)
   - 今のステージが100点なら、その後ろの最初の100点未満。後ろに無ければ先頭から今より前を探す
   - `currentId` が `stages` に無ければ、`stages` の先頭から探す
   - 全ステージが100点なら `undefined`
3. **100点で段階が残るステージは、別の小さい欄「おさらい」に出す。** 同じ順(今のステージ → 後ろ → 前)で
   最初の `perfect` のステージ1件だけ。既存の「復習のおすすめ」(もう一度自力で、`recommendReviewStage`)とは別物で、そちらは変えない。
4. 一覧の最上部の文言:
   - おすすめがある: `次のおすすめ: <タイトル>`(今と同じ)
   - おすすめが無く、おさらいがある: `全ステージ100点です`
   - どちらも無い: `全ステージをクリアしました`(今と同じ)
5. ClearScreen / NextStageCard はおさらい欄を出さない(100点の画面には「このステージの残り」が既にある)。
   おすすめが今のステージ自身だったら(記録が追いつく前の一瞬)`undefined` 扱いにする。ClearScreen の既存の判定と同じことを NextStageCard にも入れる。

本当に新しい欄が要るか: `perfect` をおすすめから外すだけだと、段階が残るステージへの入口がカードの状態表示だけになり、
「理解度チェック・変更依頼までやってクリア」(clear-means-learned.md)の案内が弱まる。1行の `<p>` で足りるので、それだけ足す。

### domain(`src/domain/progress/roadmap.ts`)

```ts
/** 次のおすすめ: 今のステージ → 後ろ → 先頭に戻って前、の順で最初の100点未満(記録なしを含む)。全部100点なら undefined。 */
export function recommendNextStage(stages: readonly Stage[], progress: Progress, currentId: string): Stage | undefined;

/** おさらい: 同じ順で最初の、100点だが段階が残っているステージ(stageStatus が perfect)。無ければ undefined。 */
export function recommendUnfinishedStage(
  stages: readonly Stage[],
  progress: Progress,
  milestones: Milestones,
  currentId: string,
): Stage | undefined;
```

- 並べ替えは非公開の関数1つ(例: `fromCurrent(stages, currentId): readonly Stage[]`)にまとめ、両方から使う。
  `index < 0` なら `stages` をそのまま返す。`[...stages.slice(i), ...stages.slice(0, i)]` で足りる
- 100点未満の判定は既存の `isStageCleared`、`perfect` の判定は既存の `stageStatus(..., false).kind === 'perfect'` を使う
- `recommendNextStage` の引数から `milestones` を外す(100点未満かどうかだけで決まるため)

### presentation

| ファイル | 変更 |
|---|---|
| `src/presentation/stage/StageRoadmapDialog.tsx` | `recommendNextStage(stages, progress, currentId)` に変える。`recommendUnfinishedStage(..., currentId)` の結果があれば、最上部の `roadmap-next` の直後に `<p className="stage-roadmap__next" data-testid="roadmap-unfinished">おさらい: <タイトル>(あと: 理解度チェック・変更依頼)</p>` を出す。「あと:」の中身は既存の `remainingMilestones` + `MILESTONE_LABEL` を `・` でつなぐ(`describeStatus` の `perfect` と同じ書き方)。最上部の文言は「決めたこと4」。カードの「おすすめ」印は `nextId` のままなので自然に新しいおすすめへ移る |
| `src/presentation/stage/ClearScreen.tsx` | `stages.filter(...)` をやめ、`recommendNextStage(stages, progress, stage.id)` にする。`next?.id === stage.id ? undefined : next?.id` の判定はそのまま |
| `src/presentation/stage/NextStageCard.tsx` | 同じく `recommendNextStage(stages, progress, stage.id)` にし、結果が `stage.id` なら `undefined` として扱う |

`describeStatus` の `perfect` の文字列組み立てと、おさらい欄の「あと: ...」が同じになるので、小さな関数(例: `remainingText(remaining)`)にまとめて両方から使ってよい(同じファイル内)。

## テスト

### Vitest(`src/domain/progress/roadmap.test.ts`、先に書く)

`recommendNextStage` の既存テストは新しいシグネチャ(第3引数が `currentId`)に書き直す。
「100点で残りありの a が、未挑戦の b より先におすすめされる」は仕様が逆になるので消し、下の新しいケースに置き換える。
stages は `a, b, c` の3つ。

`recommendNextStage`:

| ケース | progress | currentId | 期待 |
|---|---|---|---|
| 記録が空なら今のステージ(先頭) | `{}` | `a` | `a` |
| 今のステージが100点未満なら今のステージ | `{ a: 100, b: 60 }` | `b` | `b` |
| 今のステージが100点なら、後ろの最初の100点未満(症状の再現) | `{ a: 100 }` | `a` | `b` |
| 前のステージが100点で段階が残っていても戻らない(症状そのもの。a は perfect) | `{ a: 100 }` | `b` | `b` |
| 後ろが全部100点なら、先頭に戻って前の100点未満 | `{ b: 100, c: 100 }` | `c` | `a` |
| 後ろの100点未満を、前の100点未満より先に返す | `{ b: 100 }` | `b` | `c` |
| `currentId` が stages に無ければ先頭から | `{ a: 100 }` | `zzz` | `b` |
| 全ステージ100点なら undefined | `{ a: 100, b: 100, c: 100 }` | `b` | `undefined` |
| stages が空なら undefined | `{}` | `a` | `undefined` |

`recommendUnfinishedStage`(stages は理解度チェック・変更依頼を持つもの、`stageOf(id, ['x'], true)` を使う):

| ケース | progress | milestones | currentId | 期待 |
|---|---|---|---|---|
| 100点で段階が残るステージを返す | `{ a: 100 }` | `{}` | `b` | `a` |
| 今のステージより後ろの perfect を、前の perfect より先に返す | `{ a: 100, c: 100 }` | `{}` | `b` | `c` |
| 今のステージが perfect なら今のステージ | `{ a: 100, b: 100 }` | `{}` | `b` | `b` |
| 段階を全部済ませた(cleared)ステージは返さない | `{ a: 100 }` | `{ a: ['concept-check', 'change-request'] }` | `b` | `undefined` |
| 100点未満のステージは返さない | `{ a: 60 }` | `{}` | `b` | `undefined` |

### E2E

- 新規 `e2e/recommend-next-skip-just-cleared.spec.ts`: ストーリーがオンのまま、チュートリアル1を100点にし
  (`clear-means-learned.spec.ts` の `clearTutorial1` と同じ操作)、「次の章へ」(`story-next`)でチュートリアル2に進む。ステージ一覧を開いて:
  - `roadmap-next` が `次のおすすめ: チュートリアル2: 太った placeOrder`
  - `roadmap-unfinished` が `おさらい: チュートリアル1: 長いメソッドを分ける(あと: 理解度チェック・変更依頼)`
  - チュートリアル1のカード(`roadmap-stage-tutorial-extract-method`)の状態に `100点(あと: 理解度チェック・変更依頼)` があり、` おすすめ` が無い
  - チュートリアル2のカードに ` おすすめ` がある
- 既存 `e2e/clear-means-learned.spec.ts` の「100点にしただけでは「クリア」にならず…(おすすめもそのまま)」を更新する。
  チュートリアル1を100点にしてチュートリアル1を開いたままなので、`roadmap-next` は `次のおすすめ: チュートリアル2: 太った placeOrder`、
  `roadmap-unfinished` は `おさらい: チュートリアル1: …(あと: 理解度チェック・変更依頼)` になる。テスト名の「(おすすめもそのまま)」も合わせて直す
- 既存の `micro-drills.spec.ts`(初回はチュートリアル1がおすすめ)・`review-weak-stages.spec.ts`・`quiz.spec.ts`・
  `next-stage-after-clear.spec.ts`・`roadmap.spec.ts` は期待が変わらないはず。通らなければ、仕様(決めたこと1〜5)に照らして直す

## 受け入れ基準

1. 症状の再現手順(チュートリアル1を100点 → 次の章へ → ステージ一覧)で、最上部が「次のおすすめ: チュートリアル2: 太った placeOrder」になり、
   チュートリアル1は「おさらい: …(あと: 理解度チェック・変更依頼)」の欄に出て、カードに「おすすめ」が付かない
2. 初めての人(記録なし)が一覧を開くと、今と同じく「次のおすすめ: チュートリアル1: 長いメソッドを分ける」で、おさらい欄は出ない
3. `recommendNextStage` の呼び出し元3か所が、すべて `currentId` を渡す新しい呼び方になっている(`stages.filter` で今のステージを除く書き方が残っていない)
4. 上の Vitest のケースがすべてある
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ClearScreen / NextStageCard / StoryOutro へのおさらい欄の追加
- 「復習のおすすめ」(`recommendReviewStage`、もう一度自力で)の選び方・表示の変更
- おさらい欄を押してそのステージへ移るボタン化(カードを押せば移れるので足りる)
- 章(ストーリー)単位でのおすすめや、学べること(`learns`)・前提ステージ(`unclearedPrerequisites`)を見たおすすめ
- 設計くらべ(クイズ)を「全ステージ」の判定に含めること
- 過去の仕様書(stage-roadmap.md・clear-means-learned.md など)の記述の書き換え
