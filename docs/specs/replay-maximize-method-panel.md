# 解答の再生に最大化ボタンを付け、メソッドをクリックすると右にメソッド・コードを出す

## 背景・目的

「解答を再生」(`SampleAnswerReplayDialog`、`sample-answer-replay` 仕様)のダイアログは、`.codebase-preview` の
`width: 90vw; height: 85vh; max-width: 1100px` で固定されており、クラスが多いステージでは図が小さくなり、
メソッドの名前や行数が読みにくい。また、図の中のメソッドをクリックしても何も起きないため、
「この手で `placeOrder()` の中身(処理・コード)がどう変わったか」を、本画面のように右側のパネルで確かめられない。

再生ダイアログに、

1. **最大化ボタン**(画面いっぱいに広げる/元のサイズに戻す)
2. **メソッドをクリックしたら、本画面と同じように右側にメソッドの中身(「編集」タブ)と「コード」タブを出す**

を足す。再生は引き続きプレイヤーのキャンバス・ストアには一切触れない読み取り専用のままにする。

## 変更対象ファイル一覧

### 変更

- `src/presentation/stage/SampleAnswerReplayDialog.tsx`(presentation)
  - ヘッダーの「✕」の左に最大化ボタンを足す(`data-testid="sample-replay-maximize"`)。
    押すたびに「最大化」⇔「元のサイズに戻す」を切り替え、`aria-pressed` と `aria-label`(`最大化` / `元のサイズに戻す`)で状態を伝える
  - 最大化中は、`dialog` に修飾クラス `sample-replay--maximized` を付ける。ダイアログを開くたびに最大化は解除された状態から始める
  - 選択中のメソッドIDを、このダイアログの `useState` に持つ(ストアの `selectedMethodId` は使わない・変えない)。
    図とパネルを横に並べる(下記「レイアウト」)
- `src/presentation/preview/CodebasePreviewContext.ts`(presentation): コンテキストに任意の
  `selectedMethodId?: string | null` と `onSelectMethod?: (methodId: string) => void` を足す
- `src/presentation/preview/PreviewClassNode.tsx`(presentation): `onSelectMethod` が渡されているときだけ、
  `MethodChipView` を `<button type="button" className="method-chip-button nodrag nopan">`(本画面の `MethodChip` と同じクラス)で包み、
  クリックで `onSelectMethod(method.id)` を呼ぶ。`selected` は `selectedMethodId` と一致するメソッドに付ける。
  渡されていないとき(「解答例の図を見る」・設計くらべ)は、今までどおり押せない見た目のまま
- `src/presentation/preview/CodebasePreviewCanvas.tsx`(presentation): 任意のプロップ
  `selectedMethodId` / `onSelectMethod` を受け取り、`CodebasePreviewProvider` の値に渡す
- `src/presentation/editor/MethodEditor.tsx`(presentation): 読み取り専用パネルと共有するため、
  `FragmentFieldRefs`(処理が読む・書くフィールドの表示)を `export` する。必要ならタブの見出し(「編集」「コード」)の
  マークアップを、本画面とパネルの両方から使う小さなコンポーネントに切り出す(新しい抽象は、重複を避ける最小限にとどめる)
- `src/index.css`: `.sample-replay--maximized`(`width: 100vw; height: 100vh; max-width: none; border-radius: 0` と
  `max-height: none`)、図とパネルを並べる `.sample-replay__body`(`display: flex; flex: 1; min-height: 0`)、
  右パネル `.sample-replay__panel`(`width: 360px; flex: none; overflow-y: auto; border-left: 1px solid var(--border)`)
  のスタイルを足す。狭い画面(`max-width: 800px`)では、パネルを図の下に積んでよい
- `e2e/sample-replay.spec.ts`: 既存ケースに追記(新規ファイルは作らない)

### 新規

- `src/presentation/stage/ReplayMethodPanel.tsx`(presentation): 再生中の `codebase` と `methodId` を受け取り、
  読み取り専用でメソッドの中身を表示するパネル(下記)

## レイアウト

- ダイアログ本体は、今の `ヘッダー → 状態(n / m 手・点数) → 説明 → 図 → 操作ボタン` の縦並びを保つ。
  「図」の部分を `.sample-replay__body` にして、左に図、メソッドを選んでいるときだけ右に `ReplayMethodPanel` を並べる
- パネルは、メソッドを選ぶまでは出さない(図を広く使う)。選んでいるメソッドが、手を進めた・戻した先の `codebase` に
  存在しないとき(まだ抽出されていない新メソッドなど)は、パネルに「このメソッドはこの手の時点では存在しません」と出す
  (選択は残し、存在する手に戻ると中身がまた見える)
- 最大化しても、操作ボタン・説明・点数の表示は見える位置に保つ(ダイアログ内で `flex` の縦並びを崩さない)
- 最大化ボタンの有無にかかわらず、Esc・「✕」で閉じる動作と、← → キーで前後に動く動作は変えない

## ReplayMethodPanel の中身

本画面の `MethodEditor`(`MethodEditorBody`)の読み取り専用版。ストア(`useGameStore`)は使わず、props の `codebase` から描く。

- 見出し: `クラス名.メソッド名()` と行数バッジ(`methodLines(method)`)。本画面と同じ書式
- タブ: 「編集」「コード」(本画面と同じ `role="tablist"` / `method-editor__tab` の見た目)。メソッドを選び直したときは「編集」タブから始める
- 「編集」タブ: メソッド内の処理(`Fragment`)を一覧にする。各行は処理のラベルと行数(`fragmentLines`。#94 マージ前は `fragment.lines`)で、
  読む・書くフィールド(`FragmentFieldRefs`)も本画面と同じ文面で出す。**チェックボックス・名前入力・抽出ボタン・統合・可視性・
  「呼び出し元へ戻す」・削除は出さない**(再生は読み取り専用)。可視性は文字(`public` / `private` など)で見出しの下に出す
- 「コード」タブ: `ClassCodePreview`(既存)に、その手の `codebase` と、メソッドを持つクラスのIDを渡す(本画面と同じ表示)
- 手を進める・戻すと、パネルの中身もその手の `codebase` に合わせて更新される(同じメソッドIDを見続ける)

## データ・型の変更

なし(ドメインの型は変えない。`CodebasePreviewValue` に任意の2項目を足すのみ)。

## TDD対象の純粋関数

なし(表示とイベントの組み立てのみで、`domain`/`application` のロジックは増えない)。
操作に関わる変更なので、PlaywrightのE2Eで守る。

## 受け入れ基準

- `npm run check` と `npm run test:e2e` が通る。既存の `e2e/sample-replay.spec.ts`・解答例の図・設計くらべのE2Eが壊れない
- 「解答を再生」を開き、`sample-replay-maximize` を押すと、ダイアログが画面いっぱい(幅・高さが `window.innerWidth` / `innerHeight` と同じ)になり、
  もう一度押すと元のサイズ(最大 1100px 幅)に戻る。`aria-pressed` が切り替わる。閉じて開き直すと元のサイズから始まる
- 最大化中でも、`次へ` / `前へ` / ← → キー / Esc が従来どおり動く
- 再生の図でメソッド(例: `OrderController.placeOrder()`)をクリックすると、ダイアログの右側にパネルが出て、
  見出しに `OrderController.placeOrder()` と行数が出る。「編集」タブにはその手の時点のそのメソッドの処理が並び、
  チェックボックスや「抽出」ボタンは出ない
- 「コード」タブを押すと、そのクラスのC#コードが表示される。`次へ` で手を進めてメソッドが抽出されると、
  パネルのコードも新しい手の `codebase` に合わせて変わる(抽出された新しいメソッドの行が現れる)
- 選択中のメソッドがその手に存在しないとき、パネルは「存在しません」と出し、エラー・白画面にならない
- 再生中にメソッドをクリックしても、本画面(ダイアログの外)のキャンバス・メソッドエディタの選択状態・プレイヤーの `codebase` は変わらない
  (閉じたあとの本画面が、開く前と同じ状態)
- 「解答例の図を見る」・設計くらべのプレビュー内のメソッドは、今までどおりクリックしても何も起きない

## スコープ外

- 本画面の `MethodEditor` の「編集」タブそのもの(抽出・統合・可視性の操作)を再生の中で使えるようにすること
- フィールドをクリックしてフィールド情報を出すこと(`FieldInfo` の読み取り専用版)
- 「解答例の図を見る」・設計くらべのプレビューにも最大化・メソッドクリックを付けること(同じ仕組みを後から使い回せる形にはしておく)
- ブラウザのFullscreen API(`requestFullscreen`)の利用。ダイアログをページ内で画面いっぱいに広げるだけにする
- 最大化の状態の保存(次に開いたときに記憶すること)
- パネルの幅をドラッグで変える機能
