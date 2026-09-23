# 詰まったときのヒント機能

## 背景・目的

新卒〜4年目のプレイヤーが、行数や責務の混在を見て「次に何をすればいいか」がわからず詰まることがある。
`goal`(ステージの目標文)は方針を一言で書いているが、具体的にどのメソッドから何を取り出せばいいかまでは書いていない。
各ステージには既に「模範解答の手順」(`sampleAnswerSteps`、`stageCatalog.test.ts` が100点になることを保証している)が
あるので、新しくヒント文を書き下ろすのではなく、この模範解答の手順を1手ずつ日本語の文にして順番に見せる。

## スコープ

- ヒントは模範解答の手順をそのまま説明する(「次にどのメソッドを移すべきか」を新しく判定するロジックは作らない。YAGNI)。
  プレイヤーが模範解答と違う手順で進めていても、ヒントは模範解答の順番のまま出す
- クリックするたびに1手ずつ開く(全部を一度に見せない)。ステージを切り替えたら開いた数を0に戻す
- Undo/Redo・「最初に戻す」をしても、開いたヒントの数は連動しない(今のコードベースの状態とヒントの手順を
  突き合わせる診断はしない。単純にクリック数だけで管理する)

## 受け入れ条件

### `src/presentation/stage/describeSolutionStep.ts`(新規)

- 純粋関数 `describeSolutionStep(codebase: Codebase, step: SolutionStep): string` を追加する
  - `codebase` はステージの初期コードベース(`stage.codebase`)。`extract` の `fragmentIds` から処理のラベル
    (`Fragment.label`)を引いて文に含める(既存の `sampleAnswerSteps` は `extract` 以外、メソッド名・クラス名・
    ファイルパスをそのまま文字列で持っているのでそのまま使える)
  - `SolutionStep` の6種類(`extract`/`move`/`merge`/`addFile`/`addClass`/`moveClass`/`setSuperclass`)それぞれに
    「〇〇から『△△』をExtract Methodで取り出し、□□という名前にしよう」のような1文を用意する
  - `presentation`層に置く(`describeChange.ts`と同じく、ドメインのデータを表示用の日本語文にする役割のため)。
    表示用のテキスト生成関数はこのリポジトリの慣習上ユニットテスト対象外(`describeChange.ts`も未テスト)だが、
    手動確認(ブラウザプレビュー)で全パターンの文言崩れがないことを確認する

### `src/presentation/stage/HintPanel.tsx`(新規)

- 開いたヒントの数をコンポーネント内の `useState` で持つ(Zustandストアには入れない。ゲームの状態ではなく
  UIの表示状態のため)
- 「ヒントを見る」ボタン(開いた数/全体数を表示)。押すたびに1つ開く。全部開いたら無効化する
- 開いたヒントは番号付きリストで表示する
- `StagePanel.tsx` から `key={stage.id}` を付けて呼び出し、ステージ切り替えで開いた数をリセットする
  (`PreviewButtons` と同じパターン)
- 変更依頼の調査中(`investigating`)は他の操作ボタンと同様に無効化する

### `src/index.css`

- `.stage-panel__hints` / `.stage-panel__hint-list` の最小限のスタイルを追加する(装飾は既存の
  `.stage-panel__actions button` 等を流用し、新しい色や装飾は増やさない)

## テスト

- ドメイン層の新規ロジックはない(既存の `sampleAnswerSteps` を読むだけ)ので、Vitestの新規テストは追加しない
- 手動確認: ブラウザプレビューで、いくつかのステージ(上級を含む)を切り替えながら「ヒントを見る」を押し、
  日本語の文が破綻しないこと・全部開いたらボタンが無効になること・ステージ切り替えで0に戻ることを確認する
