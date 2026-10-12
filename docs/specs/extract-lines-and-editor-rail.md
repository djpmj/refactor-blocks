# extract-lines-and-editor-rail: 抽出で行数が増える理由を伝え、何も選んでいないときの右パネルを細い帯に畳む

## 背景・目的

実際に遊んで見つかった、遊びやすさの問題を2つ直す。

### 1. 抽出すると行数が増えて、悪くなったように見える

チュートリアル1で `printMonthlyReport`(39行)から「今月の売上を集計する」(7行)を抽出すると、次のように見える。

- ファイル・クラスの行数が 42行 → 48行 に**増える**
  - 新しいメソッドの宣言と波括弧の3行(`METHOD_OVERHEAD_LINES`)、呼び出しの1行(`CALL_LINES`)、処理やメソッドの間の空行が足されるため
- 左パネルの「もし、この変更が来たら?」が「1か所・39行を読む」→「2か所・44行を読む」に**悪化する**
  - 集計の責務の処理の一部(前月比)がまだ `printMonthlyReport` に残っていて、直す場所が2か所に分かれたため。正しい計算で、「まだ途中」という意味のある情報

抽出前のプレビュー(`抽出すると: printMonthlyReport 39行 → 34行 / 新しい aggregateSales 10行`)にも、合計が増える理由は書かれていない。
初めての人は「抽出は間違いだった?」と感じて手が止まる。
`post-perfect-flow`(#160)で「もし、この変更が来たら?」の数字が主役になるので、途中の悪化を正しく読めるようにしておく必要がある。

### 2. 何も選んでいないときの右パネルが広すぎる

右パネル(メソッドエディタ)は、何も選んでいないときも「中央の図から、直したいメソッドをクリックしてみよう」の案内だけで、固定幅(既定 360px)を取っている。
キャンバスが狭くなり、大きなステージでは図が見づらい。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/application/RefactorUseCases.ts` | application | `ExtractPreview` に、ファイル全体の行数の増減を足す |
| 変更 | `src/application/RefactorUseCases.test.ts` | application | 上のテスト |
| 新規 | `src/presentation/editor/describeExtractPreview.ts` | presentation | 抽出プレビューの文を作る純粋関数(今の `useExtractPreviewSummary` の文の組み立てをここへ移す) |
| 新規 | `src/presentation/editor/describeExtractPreview.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | プレビューの文を `describeExtractPreview` で出す |
| 変更 | `src/presentation/stage/describePain.ts` | presentation | 直す場所・読む量が最初より増えたときの説明の文を足す |
| 変更 | `src/presentation/stage/describePain.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | 増えたときの説明を出す |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | 最初の抽出のあとに、行数が増える理由のお知らせを1回だけ出す |
| 変更 | `src/presentation/App.tsx` | presentation | 何も選んでいないとき、右パネルを細い帯に畳む |
| 変更 | `src/index.css` | presentation | 細い帯のスタイル |
| 新規 | `e2e/extract-lines-and-editor-rail.spec.ts` | E2E | 下の受け入れ基準を確かめる |
| 変更 | 右パネルの空の案内(`method-editor-empty`)を前提にしている既存の E2E | E2E | 細い帯の表示に合わせて直す |

`domain` は変更しない(行数の数え方 `lineCount.ts` はそのまま)。

## データ・型の変更

### application

```ts
export type ExtractPreview = {
  // 既存のフィールドに加えて
  /** 抽出前後の、元のメソッドがあるファイルの行数(fileLines)。 */
  readonly fileLinesBefore: number;
  readonly fileLinesAfter: number;
};
```

### presentation(ストア)

- `GameState` に `extractOverheadExplained: boolean` を足す(初期値 `false`。保存はしない)
- 抽出が成功し、ファイルの行数が増え、`extractOverheadExplained` が `false` のとき、`notice` に次を出して `true` にする
  - `抽出すると、新しいメソッドの宣言と呼び出しの分だけ合計の行数は少し増えます。1つのメソッドが短くなり、読む範囲が絞れることが大事です`
- 同じタブを開いている間は2回目以降は出さない

## 見た目・動きの仕様

### 抽出前のプレビューの文(`describeExtractPreview`)

`describeExtractPreview(methodName: string, preview: ExtractPreview): string` を作り、今の文に合計の増減を足す。

- 増えるとき: `抽出すると: printMonthlyReport 39行 → 34行 / 新しい aggregateSales 10行(ファイルは +6行: 宣言と呼び出しの分)`
- 増えないとき(0以下): 今の文のまま(`(ファイルは …)` を付けない)
- `+N行` は `fileLinesAfter - fileLinesBefore`

### 「もし、この変更が来たら?」のカード(`ChangePainCard` の `ModifyBefore`)

`describePainTrend(pain: ChangePain): string | undefined` を `describePain.ts` に足し、`ModifyBefore` の数字の下に出す(`data-testid="pain-trend"`)。

- 直す場所が最初より増えた(`current.siteIds.length > initial.siteIds.length`):
  `途中の状態です。同じ変更に関わる処理が、今は N か所に分かれています。1か所にまとめると、直す場所も読む量も減ります`
- 直す場所は増えていないが、読む量が最初より増えた(`current.readLines > initial.readLines`):
  `途中の状態です。分けたメソッドの宣言と呼び出しの分、読む量が少し増えています。関係のない処理を外すと減ります`
- それ以外: `undefined`(出さない)
- 今ある「(最初は ○ か所でした)」「(最初は ○ 行でした)」は、減ったときだけ出す今の動きのまま

### 右パネルの細い帯(`App.tsx` の `RefactorView`)

- 次のすべてが成り立つとき、右パネルを細い帯(幅 48px、`data-testid="editor-rail"`)にする
  - 変更依頼に挑戦していない(`changeSession === null`)
  - 手で直すシミュレーション中でない(`manualFix === null`)
  - メソッドもフィールドも選んでいない(`selectedMethodId === null && selectedFieldId === null`)
  - 前回の変更依頼のメモ(`ChangeMemo`)を出していない(`lastChangeReport === null`)
- 帯の中身
  - 上に `👈` と、縦書き(`writing-mode: vertical-rl`)で `メソッドをクリック`
  - 帯全体はボタン(`aria-label="メソッドエディタの案内を開く"`)。押すと、今の空の案内(`method-editor-empty`)を今の幅で開く
  - 案内を開いたあと、メソッドを選ばずに閉じる(案内の右上の `»` ボタン)と帯に戻る
- 帯の間は、幅を変えるつまみ(`sidebar-resizable__handle`)を出さない
- メソッドかフィールドを選ぶと、前回の幅(`useResizableSidebarWidth` が覚えている幅)で右パネルが開く。選択を外すと帯に戻る
- 帯に畳む・開くときにキャンバスの `fitView` はやり直さない(図が勝手に動かないように)

## TDD対象の純粋関数

### `previewExtractMethod`(`application/RefactorUseCases.ts`)

- チュートリアル1の `printMonthlyReport` から1つの処理を抽出するプレビュー → `fileLinesAfter > fileLinesBefore`、その差が `METHOD_OVERHEAD_LINES + CALL_LINES` 以上
- 既存のテストはそのまま通る

### `describeExtractPreview`(`presentation/editor/describeExtractPreview.ts`)

- 増える → `(ファイルは +6行: 宣言と呼び出しの分)` が付く
- 増えない(差が0) → 今の文のまま

### `describePainTrend`(`presentation/stage/describePain.ts`)

- 最初 1か所 → 今 2か所 → 「今は 2 か所に分かれています」
- 最初 1か所・39行 → 今 1か所・42行 → 読む量が増えた文
- 最初 2か所・80行 → 今 1か所・20行 → `undefined`
- 変わらない → `undefined`

## 受け入れ基準

1. チュートリアル1で処理を選ぶと、抽出前のプレビューに `(ファイルは +N行: 宣言と呼び出しの分)` が出る
2. 最初の抽出をすると、行数が増える理由のお知らせが1回出る。2回目の抽出では出ない
3. チュートリアル1で集計の処理の一部だけを抽出すると、「もし、この変更が来たら?」のカードに「途中の状態です。…今は 2 か所に分かれています」が出る。集計の処理をまとめ終えると消える
4. ステージを開いた直後(何も選んでいない)は、右パネルが幅 48px の帯になり、キャンバスが広がる
5. メソッドをクリックすると右パネルが前回の幅で開き、選択を外すと帯に戻る。帯を押すと、空の案内が開く
6. 変更依頼に挑戦している間・手で直すシミュレーション中・前回の変更依頼のメモがあるときは、帯にならない
7. 帯はキーボードで押せる(Tab で届き、Enter / Space で開く)
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 行数の数え方(`METHOD_OVERHEAD_LINES` など)の変更
- ファイル・クラスの行数バッジ自体に増減を出すこと(プレビュー・お知らせ・カードで伝える)
- 左のサイドバーの畳み方の変更
- 白紙設計モード(`BlankDesignView`)の右パネル
