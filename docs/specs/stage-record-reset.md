# stage-record-reset: ステージ一覧から1ステージの記録だけをリセットする

## 背景・目的

記録(自己ベスト点数・下書き・手数の自己ベスト・100点のあとの段階)はブラウザの localStorage に保存され、
ステージ一覧(`StageRoadmapDialog`)の末尾には書き出し/読み込み(`LearningRecordSection`)しかない。

1ステージだけ「まっさらからやり直して、自力で解き直す」方法が無い。

- 「最初に戻す」(`resetStage`)は盤面を初期コードに戻すだけ。`progress`(自己ベスト)・`milestones`(理解度チェック・変更依頼の段階)・`moveBests`(手数の自己ベスト)は残る。そのため一覧のカードは「✅ クリア」のままで、学べることごとの表示(`conceptMastery`)でも習得済みに数えられる
- 消すには、ブラウザのサイトデータごと全ステージの記録を消すか、書き出したJSONを手で編集して「上書き」で読み込むしかない

ステージ一覧の各ステージに「このステージの記録をリセット」を置く。確認を挟み、そのステージの盤面・下書き・自己ベスト・手数の自己ベスト・段階を消す。他のステージは触らない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/progress/withoutStage.ts` | domain | ステージID→値の記録から1ステージ分を除いた新しい記録を返す汎用の純粋関数 |
| 新規 | `src/domain/progress/withoutStage.test.ts` | domain | 上のテスト |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `resetStageRecord(stageId)` を足す(4つの記録から消して保存し、今のステージなら盤面と履歴もまっさらにする) |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | `resetStageRecord` のテストを足す |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | `StageCard` の横に「記録をリセット」ボタンとその場の確認を置く |
| 変更 | `src/index.css` | presentation | カードとリセットボタン・確認の並びのスタイル |
| 変更 | `e2e/roadmap.spec.ts` | E2E | リセット操作のE2Eテストを足す |

application・infrastructure は変更しない(保存は既存の `saveProgress` / `saveDrafts` / `saveMoveBests` / `saveMilestones` を呼ぶだけ)。新しい依存は足さない。

## データ・型の変更

保存形式(localStorage のキー・JSONの形)は変えない。消すステージのキーがその記録から無くなるだけ。

```ts
// src/domain/progress/withoutStage.ts
/** stageId の分を除いた新しい記録を返す。もともと無ければ同じ参照を返す(保存を省けるように。updateProgress と同じ約束)。 */
export function withoutStage<T>(record: Readonly<Partial<Record<string, T>>>, stageId: string): Readonly<Partial<Record<string, T>>>;
```

`Progress`・`Drafts`・`MoveBests`・`Milestones`・`openingFixes` はすべて `Readonly<Partial<Record<string, …>>>` なので、この1つで全部に使える。
`putDraft(drafts, stage, stage.codebase)` でも下書きは消せるが、`Stage` が要り他の記録に使えないので、`withoutStage` に揃える。

`GameState` に1つ足す。

```ts
/** そのステージの記録(自己ベスト・下書き・手数の自己ベスト・段階)を消す。今のステージなら盤面と履歴も初期状態に戻す。 */
resetStageRecord: (stageId: string) => void;
```

## 動きの仕様

### ステージ一覧

- ステージ順の表示(`StageLevels`)で、記録があるステージのカードにだけ「記録をリセット」ボタン(`data-testid="roadmap-reset-<stageId>"`)を出す。
  記録がある = `progress`・`moveBests`・`milestones` にそのIDのキーがある、または `draftStageIds` に含まれる
- カードは `<button>` なので、ボタンを中に入れない。カードとリセットボタンを `div`(例: `stage-roadmap__card-wrap`)で包んで並べる
- ボタンの見えるラベルは「記録をリセット」。`aria-label` は「<ステージ名>の記録をリセット」にして、どのステージのボタンか読み上げで分かるようにする
- 押すと、そのカードの下に確認を出す(`data-testid="roadmap-reset-confirm"`。`LearningRecordSection` の読み込み確認と同じ、その場に出す形)
  - 文言: 「『<ステージ名>』の点数・下書き・手数の自己ベスト・クリアの印を消して、最初からやり直せるようにします。他のステージの記録は消えません。」
  - ボタン: 「消す」(`roadmap-reset-apply`)と「やめる」(`roadmap-reset-cancel`)
  - 確認を出したら「やめる」にフォーカスを移す(消す操作を Enter 連打で誤って確定させない)
  - 「やめる」で確認を閉じ、フォーカスを「記録をリセット」ボタンに戻す
  - 確認は一度に1つだけ。別のステージの「記録をリセット」を押したら、前の確認は閉じてそちらに出す
- 「消す」で `resetStageRecord(stageId)` を呼び、確認を閉じる。ダイアログ(ステージ一覧)は閉じない。カードの状態表示はその場で「未挑戦」になり、リセットボタンも消える。フォーカスはそのカード(`roadmap-stage-<stageId>`)に移す
- 学べることごとの表示(`ConceptMasteryList`)にはボタンを置かない(ステージ順に切り替えて使う)

### `resetStageRecord(stageId)`

1. `stages` に無いIDなら何もしない
2. `progress`・`moveBests`・`milestones` から `withoutStage` で消し、変わったものだけ既存の `saveProgress` / `saveMoveBests` / `saveMilestones` で保存して `set` する
3. 下書きは `holder.drafts`(`createGameStore` 内のクロージャ)から `withoutStage` で消し、`saveDraftsOn` のときだけ `saveDrafts` する。`draftStageIds` も更新する。
   `holder` を触るので、`selectStage` と同じく `createGameStore` の中で定義する
4. `openingFixes` からもそのIDを消す(最初の手直しも、もう一度出るようにする)
5. 今のステージ(`get().stage.id === stageId`)なら、盤面もまっさらにする
   - 下書きを消したあとの `holder.drafts` で `selectStageState` を呼んだ結果を `set` する(コードは `stage.codebase`、履歴は空、変更依頼・手直し・講評・強調などは閉じる)。
     `layoutResetCount` を1増やし、`ghost` を `null` にし、`endTour()` を呼ぶ(`selectStage` と同じ)
   - 履歴を空にするのは、元に戻す(`undo`)で解いた盤面に戻れると、自動保存で下書きが復活して「まっさら」にならないため
   - 自動保存(`autosaveDrafts`)はコードが変わったときに `putDraft(…, stage.codebase)` を呼ぶが、初期コードと同じ参照なので下書きは作られない
6. 他のステージの記録・最後に遊んだステージ(`lastStageId`)・ストーリーとツアーの設定は触らない

保存に失敗したとき(`saveProgress` / `saveDrafts` が `false`)は、既存の `recordProgress` と同じく画面の状態だけ更新して続ける。
実装時に `// ponytail: 保存に失敗すると再読み込みで記録が戻る。困る報告が出たら message で知らせる` を残す。

「最初に戻す」(`resetStage`)の動きは変えない。

## TDD対象

### `withoutStage`(domain)

- `{ a: 100, b: 80 }` から `'a'` → `{ b: 80 }`。元のオブジェクトは変わらない
- `{ a: 100 }` から `'x'`(無いID)→ 同じ参照を返す
- `{}` から `'a'` → 同じ参照を返す
- 値が配列(`Milestones` の `{ a: ['concept-check'], b: ['change-request'] }`)から `'a'` → `{ b: ['change-request'] }`
- 値が `undefined` で入っているキー(`{ a: undefined, b: 1 }`)から `'a'` → `a` のキーが無くなる(`Object.hasOwn` で判定する。`openingFixes` は `null` を値に持ち、キーの有無に意味があるため)

### `resetStageRecord`(presentation のストア。`useGameStore.test.ts`)

- 2ステージに自己ベスト・手数・段階・下書きがある状態で片方をリセット → そのステージのキーだけが4つの記録・`draftStageIds` から消え、もう片方は残る。localStorage の各キーにも反映される
- 今のステージをリセット → `codebase` が `stage.codebase`、`history` が空になり、`undo` しても戻らない。直後に下書きが作り直されない
- 今のステージ以外をリセット → `stage`・`codebase`・`history` は変わらない
- 変更依頼の途中で今のステージをリセット → `changeSession` が `null`
- 無いステージID → 状態も localStorage も変わらない

## 受け入れ基準

1. 1つめのステージを100点にしてクリアの印が付いた状態で、ステージ一覧の「記録をリセット」→「消す」を押すと、そのカードの表示が「未挑戦」になり、ボタンが消える。学べることごとの表示でもクリア数が1減る
2. 1の直後、盤面が初期コードに戻っていて、ヘッダーの「元に戻す」で解いた盤面に戻れない。ページを再読み込みしても初期コードのまま、一覧も「未挑戦」のまま
3. 2つのステージに記録がある状態で片方だけリセットすると、もう片方のカードの表示(点数・挑戦中・クリア)と、そのステージを開いたときの下書きの復元は変わらない
4. 今のステージ以外をリセットしても、今の盤面と元に戻すの履歴は変わらない
5. 「やめる」を押すと何も消えず、フォーカスが「記録をリセット」ボタンに戻る。確認を出した直後のフォーカスは「やめる」にある
6. 記録が1つも無いステージのカードには「記録をリセット」が出ない
7. Tab / Enter のキーボード操作だけで「記録をリセット」→「消す」まで行える
8. 「最初に戻す」は今までどおり盤面だけを戻し、一覧の点数・クリアの印は残る
9. `e2e/roadmap.spec.ts` に、受け入れ基準1・3・5を確かめるテストがある(localStorage に記録を仕込んで一覧を開く。既存の「学べることごと」のテストと同じやり方)
10. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 全ステージの記録を一度に消すボタン(要望は1ステージ単位。必要ならブラウザのサイトデータ削除か、書き出したJSONの上書き読み込みで足りる)
- リセットの取り消し(元に戻す)。確認を挟むことで足りるとする。不安なら先に「学習記録を書き出す」で保存できる
- 学べることごとの表示・ヘッダーなど、ステージ一覧のステージ順の表示以外からのリセット
- 最後に遊んだステージ・ストーリー・ツアーの設定のリセット
- 保存に失敗したときのお知らせ表示(上の ponytail コメントのとおり、報告が出たら足す)
- `window.confirm` によるネイティブの確認(ゲーム内の他の確認と見た目・テストの書き方を揃えるため使わない)
