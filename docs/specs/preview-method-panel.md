# 「変更前の図」「解答例の図」でもメソッドをクリックするとメソッド・コードを出し、最大化できるようにする

## 背景・目的

「解答の再生」ダイアログ(`src/presentation/stage/SampleAnswerReplayDialog.tsx`)では、図のメソッドをクリックすると右に
読み取り専用のメソッドパネル(`src/presentation/stage/ReplayMethodPanel.tsx`、「編集」タブの処理の一覧と「コード」タブ)が出て、
最大化もできる(`replay-maximize-method-panel.md`)。

一方、ツールバーの「変更前の図を見る」「解答例の図を見る」で開く図(`src/presentation/preview/CodebasePreviewDialog.tsx`)は、
図を見るだけで、メソッドの中身もコードも確かめられず、大きくもできない。変更前と解答例の**中身**を比べたいときに使えない。

`CodebasePreviewDialog` にも、解答の再生と同じメソッドパネルと最大化ボタンを付ける。

## 前提

- Issue #131 `replay-window-controls`(解答の再生の右上に「□(最大化)」「✕(閉じる)」を並べる)の**マージ後に実装する**。
  最大化ボタンの見た目・振る舞いは #131 と同じにする

## 振る舞い

- 図の中のメソッドをクリックすると、図の右にメソッドパネル(`ReplayMethodPanel` と同じもの)が出る。別のメソッドをクリックすると切り替わる。
  読み取り専用で、抽出・移動などの操作はできない(解答の再生と同じ)
- 右上に「□ ✕」を並べ、□で画面いっぱいに広げる/元のサイズに戻す(#131 と同じアイコン・`aria-pressed`・`aria-label`・`title`)
- ダイアログを開くたびに、メソッドは未選択・最大化は解除された状態から始める
- `CodebasePreviewDialog` を使っている**すべての画面**に付く: ツールバーの「変更前の図」「解答例の図」、変更依頼の画面の「解答例の図」
  (`ChangeRequestPanel.tsx`)、白紙設計の結果(`BlankDesignResultPanel.tsx`)
- Esc・✕で閉じる動作は変えない

## 変更対象ファイル一覧

### 新規

- `src/presentation/preview/WindowControls.tsx`(presentation): #131 で `SampleAnswerReplayDialog` に書いた右上の「□ ✕」を部品として切り出す。
  `maximized`・`onToggleMaximize`・`onClose` を受け取り、最大化ボタン(`data-testid` は呼び出し側から渡す)と閉じるボタンを `.window-controls` で並べる

### 変更

- `src/presentation/preview/CodebasePreviewDialog.tsx`(presentation)
  - `maximized` と `selectedMethodId` の状態を持つ。開くたびに初期化する(`codebase` が `null` から変わったとき)
  - 本体を `SampleAnswerReplayDialog` と同じく「図(`.codebase-preview__canvas`)+ 右のメソッドパネル」の横並びにする。
    `CodebasePreviewCanvas` に `selectedMethodId` と `onSelectMethod` を渡す(どちらも解答の再生で使っている既存の props)
  - ヘッダーの✕ボタンを `WindowControls` に置き換える。最大化ボタンの `data-testid` は `codebase-preview-maximize`
  - 最大化中は `dialog` に `codebase-preview--maximized` を付ける
- `src/presentation/stage/SampleAnswerReplayDialog.tsx`(presentation): 右上を `WindowControls` に置き換える(見た目・`data-testid="sample-replay-maximize"` は変えない)
- `src/presentation/stage/ReplayMethodPanel.tsx`: 2つのダイアログで使うので `src/presentation/preview/` へ移す(名前は `PreviewMethodPanel` に変える)。中身は変えない
- `src/index.css`
  - `.sample-replay--maximized` を `.codebase-preview--maximized` として共通化する(解答の再生も同じクラスを付ける)
  - `.sample-replay__body` / `.sample-replay__panel` の横並び・パネル幅のスタイルを、`.codebase-preview__body` / `.codebase-preview__panel` として共通化する
    (解答の再生も新しいクラス名に寄せ、古い名前は消す)
- `e2e/preview.spec.ts`: 下の受け入れ基準のケースを足す(新しいファイルは作らない)
- `e2e/sample-replay.spec.ts`: クラス名の変更に合わせて直す(振る舞いは変えない)

## データ・型の変更

なし。

## TDD対象の純粋関数

なし(既存の部品の組み合わせと表示の変更で、`domain`/`application` のロジックは増えない)。振る舞いはE2Eで守る。

## 受け入れ基準

- `npm run check` と `npm run test:e2e` がすべて通る
- ツールバーの「変更前の図を見る」で開いた図で、メソッドをクリックすると右にメソッドパネルが出て、「編集」タブに処理の一覧、
  「コード」タブにそのクラスのコードが出る。別のメソッドをクリックすると切り替わる
- 「解答例の図を見る」でも同じように動き、解答例のメソッド(例: チュートリアル1の `aggregateSales`)の中身が見られる
- 右上の□で、ダイアログが画面いっぱいになり(`boundingBox` がビューポートと同じ大きさ)、もう一度押すと元の大きさに戻る。
  ボタンは✕のすぐ左にあり、`aria-pressed` と `aria-label`(`最大化` / `元のサイズに戻す`)が切り替わる
- 閉じて開き直すと、メソッドは未選択・最大化は解除された状態から始まる
- 図の中で抽出・移動などの操作はできず、メインのキャンバスのコードベースは変わらない
- 変更依頼の画面の「解答例の図」と、白紙設計の結果の図でも、メソッドパネルと最大化が使える
- 解答の再生の見た目・振る舞い(最大化・メソッドパネル・← → キー)は変わらない
- Tab で□・✕とメソッドにフォーカスでき、Enter / Space で押せる

## スコープ外

- 「変更前の図」と「解答例の図」を左右に並べて比べる表示
- メソッドパネルから図の該当箇所へのハイライト連動
- 設計くらべ(`ComparisonQuizView`)のプレビューへの追加
- 最小化ボタンの追加、ダイアログのドラッグ移動・リサイズ
