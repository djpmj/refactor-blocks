# clear-reflection-note: 100点のあとに「今回気づいたこと」を一言(140字まで)書き残し、ステージ一覧から読み返せるようにする

## 背景・目的

ステージを100点にすると、サイドバーに理解度チェック・手数の1行(`MoveCountNote`)・章の結び(`StoryOutro`)・次のステージ(`NextStageCard`)が出る。
しかし学習者が「今回何に気づいたか」を自分の言葉で書き残す場がない(コードと仕様を「振り返り」「メモ」で grep して、該当する機能がないことを確認済み)。
自分の言葉で書くと学びが定着しやすく、あとで一覧から読み返せば「前に何を学んだか」を思い出せる。

そこで、100点のときのサイドバーに**任意の**一言メモ欄(140字まで)を置き、ステージごとに localStorage に保存する。学習記録の書き出し・読み込み(`LearningRecordUseCases`)にも乗せ、ステージ一覧(`StageRoadmapDialog`)のカードに表示して読み返せるようにする。

### 設計判断(確定)

1. **置き場所はサイドバー(100点のときのカード群)。** 全画面のクリア画面([clear-celebration-screen](clear-celebration-screen.md)、`ClearScreen`)はまだコードにない(`src/` に `ClearScreen` がないことを確認済み)。それに、クリア画面は「次の行き先を選ばせる」ためのモーダルなので、入力欄を置くと主ボタンへのフォーカスと Esc の扱いがぶつかる。メモ欄はサイドバーに置き、クリア画面の「今の画面へ戻る」で戻った先に見える形にする。`ClearScreen` には手を入れない。
2. **出す条件は `MoveCountNote` と同じ** `!investigating && score.total >= 100`。並びは `ConceptCheckPanel` の直後、`StoryOutro` の直前(理解度チェックで考えたあとに書けるようにする)。
3. **保存は入力のたびに自動で行う(保存ボタンは置かない)。** ボタンを押し忘れてステージを移ると書いた内容が消えてしまうため。1キーに数KBを書くだけなので軽い。前後の空白は保存のときに取り除く(入力中の欄の表示は取り除かない)。空白だけになったらそのステージのメモを消す。
4. **140字は `String.prototype.length`(UTF-16のコード単位)で数える。** `<textarea maxLength={140}>` と同じ数え方にそろえ、カウンタとブラウザの制限がずれないようにする。絵文字は2字と数えるが、気にするほどの問題ではない(ponytailコメントを残す)。
5. **プレイヤーに何かを名付けさせる・メモを採点する・AI講評に送る、ということはしない。** 点数・クリア判定・マイルストーンには影響させない。
6. **学習記録ファイルのバージョンは 1 のまま上げない。** `reflectionNotes` は「無くてもよい」フィールドにする。古いファイル(`reflectionNotes` が無い)は空 `{}` として読み込む。形が壊れているときだけエラーにする。古いゲームで新しいファイルを読み込んだ場合、知らないフィールドは無視されるだけなので互換性は壊れない。
7. **マージ(merge)での合成は下書きと同じで、このブラウザのメモを優先する**(`{ ...imported, ...current }`)。上書き(overwrite)ではファイルの内容に置き換える。
8. **ステージ一覧ではカード(`<button>`)の中に1行で出す。** カードの中にボタンや入力を入れ子にできないため、表示するだけにする(一覧からの編集はしない。編集はそのステージを開いて行う)。長いメモは CSS の `text-overflow: ellipsis` で1行に切り詰め、全文は `title` 属性で見られるようにする。

## ponytailチェック

- 本当に専用の編集画面や履歴(ステージごとに複数件)が要るか → 「一言」なので1ステージ1件の上書きで十分。履歴は作らない。
- 既存の再利用: 保存の形は `moveBests`(`domain/progress/moveBests.ts` の型 + `infrastructure/progress/moveBestStorage.ts` の load/save)をそのまま真似る。同じ参照を返して再描画を減らす作法は `updateMoveBest` に合わせる。書き出し・読み込みは `LearningRecordUseCases` に1フィールド足すだけ。
- 標準機能: `<textarea maxLength>`・`<label>`・`aria-describedby` で文字数のカウンタを読み上げさせる。新しい依存は足さない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/progress/reflectionNotes.ts` | domain | 型 `ReflectionNotes`・上限の定数・更新(`updateReflectionNote`)・形の検証(`isReflectionNotes`) |
| 新規 | `src/domain/progress/reflectionNotes.test.ts` | domain | 上のテスト(先に書く) |
| 新規 | `src/infrastructure/progress/reflectionNoteStorage.ts` | infrastructure | キー `refactor-blocks:reflection-notes` の load/save(`moveBestStorage.ts` と同じ作り) |
| 変更 | `src/infrastructure/progress/learningRecordStorage.ts` | infrastructure | `loadLearningRecord` / `saveLearningRecord` に `reflectionNotes` を足す(コメントの「5つのキー」を「6つ」に直す) |
| 変更 | `src/application/LearningRecordUseCases.ts` | application | `LearningRecord` に `reflectionNotes` を足し、`parseLearningRecord`・`combineLearningRecords` を対応させる |
| 変更 | `src/application/LearningRecordUseCases.test.ts` | application | 上のテストを足す(先に書く) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `progressActions` に `reflectionNotes` と `saveReflectionNote` を足す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | `saveReflectionNote` のテスト(先に書く) |
| 新規 | `src/presentation/stage/ReflectionNoteCard.tsx` | presentation | サイドバーのメモ欄 |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `StageSidebar` の `ConceptCheckPanel` の直後に `ReflectionNoteCard` を置く |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | `StageCard` にメモを1行で出す |
| 変更 | `src/presentation/stage/LearningRecordSection.tsx` | presentation | 説明文と `summarize` にメモを含める |
| 変更 | `src/index.css` | presentation | `.reflection-note`・`.stage-roadmap__note` を足す |
| 新規 | `e2e/reflection-note.spec.ts` | E2E | 受け入れ基準を確かめる |

`ClearScreen`・`NextStageCard`・`StoryOutro`・`ConceptCheckPanel`・採点(`domain/scoring`)は変更しない。

## データ・型の変更

### domain

```ts
// src/domain/progress/reflectionNotes.ts
/** ステージIDごとの、学習者が書いた一言メモ(前後の空白を除いた1〜140字)。 */
export type ReflectionNotes = Readonly<Partial<Record<string, string>>>;

// ponytail: String.length(UTF-16のコード単位)で数えるため、絵文字は2字になる。textarea の maxLength と同じ数え方。困る声が出たら [...text].length に変え、textarea 側も合わせる
export const MAX_REFLECTION_NOTE_LENGTH = 140;

/**
 * text の前後の空白を除いて保存する。空になったらそのステージのキーを消す。
 * 上限を超えた分は切り捨てる(textarea の maxLength を通らない入力への備え)。
 * 中身が変わらなければ同じ参照を返す(updateMoveBest と同じ)。
 */
export function updateReflectionNote(notes: ReflectionNotes, stageId: string, text: string): ReflectionNotes;

/** 文字列キー → 1〜140字の文字列、の形か。localStorage・学習記録ファイルを読むときの信頼境界の検証。 */
export function isReflectionNotes(value: unknown): value is ReflectionNotes;
```

### application

```ts
// LearningRecord に足す
readonly reflectionNotes: ReflectionNotes;
```

- `parseLearningRecord`: `reflectionNotes` が `undefined`(キーが無い)なら `{}`。あれば `isReflectionNotes` で検証し、だめなら `err('振り返りメモ(reflectionNotes)の形式が正しくありません')`。
- `combineLearningRecords`: merge は `{ ...imported.reflectionNotes, ...current.reflectionNotes }`、overwrite は `imported` のまま(既存の `{ ...imported, tourSeen }` に含まれる)。
- `serializeLearningRecord` は変えない(`...record` で出力に含まれる)。`LEARNING_RECORD_VERSION` は 1 のまま。

### infrastructure

- `reflectionNoteStorage.ts`: キー `refactor-blocks:reflection-notes`。`loadReflectionNotes(): ReflectionNotes`(壊れている・存在しないときは `{}`、例外は投げない)、`saveReflectionNotes(notes): boolean`(`saveDrafts` と同じく、書けなかったら false)。
- `saveLearningRecord`: `saveDrafts` の次に `saveReflectionNotes` を書く(失敗したら後を書かずに止める、今の作法のまま)。

### presentation(ストア)

```ts
// GameState に足す(progressActions の Pick にも足す)
/** ステージごとの一言メモ。保存される。点数・クリア判定には使わない。 */
reflectionNotes: ReflectionNotes;
saveReflectionNote: (stageId: string, text: string) => void;
```

- `saveReflectionNote` は `updateReflectionNote` の結果が同じ参照なら何もしない。変わったら `saveReflectionNotes` してから `set`。
- 初期値は `loadReflectionNotes()`(`createGameStore` の引数は増やさない。`moveBests` と同じ)。

## 動きの仕様

### サイドバーのメモ欄(`ReflectionNoteCard`)

- 出す条件: `StageSidebar` で `!investigating && score.total >= 100`。`ConceptCheckPanel` の直後、`StoryOutro` の直前。`key={stage.id}` を付け、ステージを移ったら入力中の状態を作り直す。
- 中身:
  - `<section className="reflection-note" aria-labelledby=… data-testid="reflection-note">`
  - 見出し `h3`: `振り返りメモ`
  - `<label>`: `今回気づいたこと(任意・140字まで)`
  - `<textarea maxLength={140} rows={3} data-testid="reflection-note-input" aria-describedby=<カウンタのid>>`。初期値はストアの `reflectionNotes[stage.id] ?? ''`。入力中の値はコンポーネントの `useState` に持ち、`onChange` のたびに `saveReflectionNote(stage.id, value)` を呼ぶ
  - カウンタ `<p data-testid="reflection-note-count">{n} / 140</p>`(`n` は入力欄の今の `value.length`)
  - 補足 `<p>`: `自動で保存され、ステージ一覧から読み返せます。点数には関係しません。`
- 入力は任意。何も書かなくてもクリア・マイルストーンは変わらない。
- ステージのショートカットキー(あれば)が textarea の入力を奪わないこと(キーボードで日本語入力・改行ができる)。改行は保存してよいが、一覧では1行に詰めて出す(下)。

### ステージ一覧(`StageRoadmapDialog` の `StageCard`)

- そのステージにメモがあれば、`stage-roadmap__status` の下に `<span className="stage-roadmap__note" data-testid="roadmap-note-<stageId>" title=<全文>>メモ: <全文></span>` を出す。
- `.stage-roadmap__note` は `display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--muted);`(改行を含んでも1行に出る)。
- メモが無いステージには何も出さない。「学べることごと」表示(`ConceptMasteryList`)は変えない。
- `StageLevels` にはストアの `reflectionNotes` を渡す(引数のオブジェクトに1つ足すだけ。関数の引数の数は増えない)。

### 学習記録の持ち運び(`LearningRecordSection`)

- 説明文の括弧の中に `振り返りメモ` を足す(`記録(自己ベスト・挑戦中の下書き・振り返りメモ・最後に遊んだステージ・設定)`)。
- `summarize` の末尾に `、振り返りメモ ${n} 件` を足す。

## TDD対象

### `updateReflectionNote`(domain)

- 空の `{}` に `'a', '責務ごとに分けると変更が1か所で済む'` → そのキーに同じ文字列が入る
- 前後に空白・改行がある → 取り除いて保存する(中の改行は残す)
- 空文字・空白だけ → そのキーを消す(元にキーがあれば消え、なければ同じ参照を返す)
- 141字 → 先頭140字に切り詰める。ちょうど140字 → そのまま
- 保存済みと同じ文字列(空白を除いた結果が同じ)→ 同じ参照を返す
- 他のステージのメモは変わらない。元のオブジェクトは変更しない

### `isReflectionNotes`(domain)

- `{}`・`{ a: 'x' }` → true
- `null`・配列・文字列 → false
- 値が文字列でない(`{ a: 1 }`)・空文字(`{ a: '' }`)・141字 → false

### `parseLearningRecord` / `combineLearningRecords`(application)

- `reflectionNotes` を含む書き出し結果を `serializeLearningRecord` → `parseLearningRecord` すると、同じメモが戻る
- `reflectionNotes` が無い(今までの)ファイル → ok で `reflectionNotes: {}`
- `reflectionNotes` の形が壊れている → err(`振り返りメモ(reflectionNotes)の形式が正しくありません`)
- merge: 同じステージは今のブラウザのメモが残り、ファイルにしかないステージのメモは足される
- overwrite: ファイルのメモに置き換わる(今のブラウザにしかないメモは消える)

### ストア(`useGameStore.test.ts`)

- `saveReflectionNote('x', ' メモ ')` → `reflectionNotes.x === 'メモ'` で、`localStorage` の `refactor-blocks:reflection-notes` にも入る(`recordMoveBest` のテストと同じ書き方)
- 空白だけで保存 → キーが消える

`loadReflectionNotes` / `saveReflectionNotes`(I/O)はユニットテストの対象外でよい(E2Eで確かめる)。

## 受け入れ基準

1. チュートリアル1を100点にすると、サイドバーの理解度チェックの下に「振り返りメモ」欄(`reflection-note`)が出る。100点になる前は出ない
2. 欄に文字を入力すると、カウンタが `n / 140` で増え、141字目は入らない
3. 入力したあと再読み込みしてチュートリアル1を開くと、書いたメモが欄に残っている(保存ボタンを押さなくてよい)。空にして再読み込みすると、メモは消えている
4. ステージ一覧を開くと、チュートリアル1のカードに `メモ: <書いた内容>` が1行で出る。メモのないステージのカードには出ない。長いメモは1行に切り詰められ、カードを押せば今までどおりそのステージが開く
5. 「学習記録を書き出す」でダウンロードした JSON に `reflectionNotes` が入っている。メモを含むファイルを別の状態(localStorage を消したあと)で読み込むと、ステージ一覧にメモが出る。`reflectionNotes` の無い古い形のファイルも今までどおり読み込める
6. メモを書いても書かなくても、点数・クリア表示・次のステージのおすすめは変わらない
7. キーボードだけで欄にフォーカスして入力でき、ラベルとカウンタが読み上げの対象になっている(`getByLabel('今回気づいたこと(任意・140字まで)')` で欄が取れる)
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 全画面のクリア画面(`ClearScreen`、[clear-celebration-screen](clear-celebration-screen.md))にメモ欄を置くこと
- 1ステージに複数件のメモ・書いた日時・履歴を残すこと
- ステージ一覧からメモを編集・削除すること(編集はそのステージを開いて行う)
- メモの採点・AI講評への送信・メモの例文やテンプレートの提示
- 設計くらべ(`quiz`)・白紙設計(`blank`)のステージでの専用の扱い(サイドバーの100点の条件に乗る範囲で出るだけ)
- `moveBests`・`milestones` を学習記録ファイルに含めること(今も含まれていない。別の課題)
- 学習記録ファイルのバージョンを上げること
