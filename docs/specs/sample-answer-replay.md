# 模範解答を1手ずつ再生する

## 背景・目的

模範解答は、いま2つの形でしか見られない。

- **ヒント**(`useHints`): 手順を1手ずつ文章で開く。図が無いので、その手でコードがどう変わったかは自分で想像するしかない
- **解答例の図**(`PreviewButtons` の「解答例の図を見る」): 最終形の図だけ。途中の手順が無いので、どの順に何をすればそこへ着くかが分からない

クリアしたあとに「自分の手順と比べて、どうすればもっと良かったか」を振り返る手段も、詰まったときに「次の一手で何が起きるか」を見る手段も無い。
そこで、模範解答の手順を**図で1手ずつ再生する**ダイアログを足す。各手の説明(ヒントと同じ文章)と、その手の後の点数を並べ、構造と点数が良くなっていく過程を見せる。

再生はプレイヤーのキャンバス(`codebase`)には**一切触らない**。読み取り専用のプレビューの中だけで行う。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/sampleAnswer.ts` + `.test.ts`(または `stageCatalog.test.ts`) | domain | 変更 | `solutionSnapshots(codebase, steps)` を追加し、`applySolutionSteps` をその最後の要素で実装し直す(TDD、下記) |
| `src/presentation/stage/SampleAnswerReplayDialog.tsx` | presentation | 新規 | 再生のダイアログ(下記)。`CodebasePreviewCanvas` を再利用する |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | `PreviewButtons` に「解答を再生」ボタンを足す |
| `src/index.css` | presentation | 変更 | `.sample-replay` のスタイル(`.codebase-preview` に合わせる) |
| `e2e/sample-replay.spec.ts` | E2E | 新規 | 再生を開いて1手ずつ進め、点数と説明が変わる・キャンバスは変わらない(下記) |

`application` 層・`infrastructure` 層・採点の変更は無い。

## 見た目・内容の仕様

### 開き方

- ツールバーの「解答例の図を見る」の隣に `解答を再生` ボタン(`data-testid="sample-replay-open"`)
  - `title="模範解答の手順を1手ずつ見ます(答えが分かります)"`
  - 解答が未登録のステージ(`sampleAnswerSteps[stage.id] === undefined`)・変更依頼の調査中は `disabled`(「解答例の図を見る」と同じ条件)
- ダイアログはネイティブ `<dialog>`(`CodebasePreviewDialog` と同じ作り)。`✕`・Esc で閉じる
- 開くたびに、手順の0手目(初期状態)から始める

### ダイアログの中身

- タイトル: `解答の再生`
- 上部に、現在の位置 `3 / 8 手` と、その手の後の点数 `72点`(`scoreCodebase(snapshot, stage)` の `total`)
- その手の説明: `describeSolutionStep(stage.codebase, step)`(ヒントと同じ文章)。0手目は「最初の状態です。『次へ』で1手ずつ進めます」
- 中央に `CodebasePreviewCanvas`(読み取り専用)で、その時点のコードを描く
- 下部のボタン: `最初へ` / `◀ 前へ` / `次へ ▶` / `最後へ`。端ではそれぞれ `disabled`
- キーボード: ダイアログ内で ← / → キーでも前後に動く(ボタンにフォーカスが無くても)。入力欄は無いので、`isEditingText` の判定は不要
- 最後の手(100点)では、説明の下に「ここまでで100点です」と出す(`total >= 100` のときだけ。模範解答が100点にならないことは `stageCatalog.test.ts` が許さない)
- 点数の変化は色だけに頼らず、数字で出す。前の手から点数が上がったら `(+10)` を添える

### 図の更新

- 手を進めるたびに、`CodebasePreviewCanvas` に新しい `codebase` を渡す。レイアウト(`layoutCodebase`)が手ごとに組み直されてよい
- 拡大率は、ダイアログを開いたときの `fitView` のまま(手ごとに `fitView` し直さない。図が飛び回らないように)。プレイヤーが手動でズーム・パンするのは自由

## データ・型の変更

```ts
// src/domain/stage/sampleAnswer.ts
/**
 * 手順を順番に適用し、各手の後のコードを返す。先頭(添字0)は適用前の codebase そのもの。長さは steps.length + 1。
 * 新しく振るIDは applySolutionSteps と同じ(`solution-<添字>`)。
 */
export function solutionSnapshots(codebase: Codebase, steps: readonly SolutionStep[]): readonly Codebase[];

/** 既存。solutionSnapshots の最後の要素を返すように実装し直す(挙動は変えない)。 */
export function applySolutionSteps(codebase: Codebase, steps: readonly SolutionStep[]): Codebase;
```

再生のダイアログは、開いたときに `solutionSnapshots(stage.codebase, steps)` を1回だけ計算し(`useMemo`)、手の位置は `useState` の添字で持つ。ストアには何も足さない。

## TDD対象の純粋関数

### `solutionSnapshots`

1. 手順が空なら、`[codebase]`(長さ1、元の参照そのもの)
2. 長さは `steps.length + 1`。先頭は元の `codebase`(同じ参照)
3. 添字 `i` の要素は、先頭から `i` 手を `applySolutionSteps` で適用した結果と同じ内容(新しいIDの振り方も同じ)
4. 最後の要素は `applySolutionSteps(codebase, steps)` と同じ内容
5. 元の `codebase` を変更しない

### ステージカタログ(`stageCatalog.test.ts` に追加)

1. 模範解答があるすべてのステージで、`solutionSnapshots` の最後の要素の点数が100点(既存の「模範解答で100点」の確認を、この関数経由でも満たす)
2. 各ステージで、`solutionSnapshots` の要素数が手順の数 + 1

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- ツールバーの「解答を再生」を押すと、0手目(初期状態の図・点数)が出る
- 「次へ」で1手ずつ進み、図・説明・点数・`n / N 手` が変わる。「前へ」で戻れる。「最初へ」「最後へ」で端へ飛ぶ。端のボタンは押せない
- ← / → キーでも前後に動く
- 最後の手で100点と「ここまでで100点です」が出る
- 再生を閉じたあと、プレイヤーのキャンバス・点数・取り消し履歴・下書きは、開く前とまったく同じ
- 解答が未登録のステージ・変更依頼の調査中は、ボタンが押せない
- 「解答例の図を見る」「変更前の図を見る」・ヒントの挙動が変わらない
- `applySolutionSteps` を使う既存のテスト・機能(解答例の図・`stageCatalog.test.ts`)が変わらず通る

## スコープ外

- 自動再生(一定間隔で進む)・再生速度の調整
- プレイヤー自身の操作手順の記録と再生、模範解答との手数の比較(最小手数「パー」の仕様で扱う)
- 手ごとに変わったブロックの強調(差分のハイライト)
- 再生の途中の状態をプレイヤーのキャンバスに読み込むこと(「ここから自分でやる」)
- クリアするまで再生を隠すなどの出し惜しみ(ヒントと同じく、いつでも見られる)
- 白紙設計モード・設計くらべクイズへの適用
