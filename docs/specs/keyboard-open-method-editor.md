# keyboard-open-method-editor: キーボードだけではメソッドの中身(抽出エディタ)を開けない

小さな不具合修正。キーボードドラッグの開始キーを Space だけにし、Enter はボタンのクリック(=中身を開く)に戻す。

## 背景

- 2026-11-03 のプレイテストで、キーボードだけではメソッドの中身(右の抽出エディタ)を開けないことが再現された。CLAUDE.md の方針で、アクセシビリティ(キーボード操作を含む)は手を抜かない。
- `operation-guide-keyboard.md` は「`Enter` で選んだメソッドの中身を右側のエディタに開く」「`Space` → 矢印キー → `Space` で持ち上げて置く」の2つを前提にしていた。実装時に Enter が動かなかったので、ガイドから Enter の行が外され、`e2e/operation-guide.spec.ts` に「Enter を押すとエディタは開かず、キーボードドラッグが始まる」というテストが足された。この不具合を仕様として固定してしまっている。この仕様で、`operation-guide-keyboard.md` が最初に決めた分担に戻す。
- `dnd-announcements-ja.md` で決めたスクリーンリーダー向けの説明(`dndAnnouncements.ts` の `draggable`)は、もともと「スペースキーで持ち上げ…もう一度スペースキーで置き」と書かれている。Space だけで持ち上げる今回の修正は、この説明とも合う。
- `move-via-context-menu.md` / `context-menu-grouping.md`(Shift+F10 のメニュー)とは別の話。メニューに「中身を開く」を足す案は採らない(下の「修正」を参照)。

## 症状

1. ステージ1で冒頭の修正を済ませ、`printMonthlyReport()` のメソッドチップへ Tab で移る
2. `Enter` または `Space` を押す
3. メソッドが持ち上がり(キーボードドラッグ)、右のエディタは「中央の図から、直したいメソッドをクリックしてみよう」の空表示のまま
4. `Shift+F10` のメニューにも中身を開く項目は無い。操作ガイドの「処理を抽出する」には「メソッドをクリック」としか書かれていない

## 原因

`src/presentation/canvas/CodebaseCanvas.tsx` の `useSensor(KeyboardSensor)` を既定の設定で使っている。dnd-kit(`node_modules/@dnd-kit/core/dist/core.esm.js` の `defaultKeyboardCodes`)の既定値は
`start: [Space, Enter]` で、`KeyboardSensor` の `onKeyDown` は開始キーで `event.preventDefault()` を呼ぶ。そのため `<button>` 標準の「Enter でクリック」が起きず、`MethodChip` の `onClick`(→ `selectMethod`)が呼ばれない。

センサーを作っているのは `CodebaseCanvas.tsx` の1か所だけ(`grep KeyboardSensor src` で確認済み)。メソッド・フィールド・クラスヘッダーの3つのドラッグ元は、すべてこの `DndContext` を共有しているので、直すのはこの1か所で済む。

## 修正

**決定: キーボードドラッグの開始キーを `Space` だけにする。** `Enter` は `<button>` 標準のクリックとして働き、メソッドなら中身がエディタに開く。

```ts
// CodebaseCanvas.tsx(presentation)
/** Enter はボタンのクリック(メソッドの中身を開く)に残し、キーボードドラッグは Space で始める。 */
const KEYBOARD_DRAG = { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter', 'Tab'] } };
// ...
useSensor(KeyboardSensor, KEYBOARD_DRAG)
```

- `keyboardCodes` は丸ごと置き換わるので、`cancel` / `end` は既定値(`Escape` / `Space`・`Enter`・`Tab`)をそのまま書く。持ち上げた後に置く・取り消す操作は今と変わらない
- 型は `@dnd-kit/core` の `KeyboardSensorOptions` に合わせる(`as` は使えないので、必要なら `satisfies` か型注釈で付ける)

採らなかった案(なぜ要らないか):

- **右クリックメニューに「中身を開く」を足す**: Shift+F10 → ↓ → Enter の3手が要り、Tab で移って Enter を押すというボタンの普通の操作が使えないまま残る。`contextMenuGroups`・`CanvasContextMenu`・メニューのテストまで変更が広がる。開始キーの設定1か所で直る
- **`FieldChip` のように `onKeyDownCapture` で Enter のとき `selectMethod` も呼ぶ**: エディタは開くが、ドラッグも同時に始まってしまい、Esc で取り消さないと次へ進めない
- **別のキー(例: `O`)を割り当てる**: 覚えることが増え、ガイドにも足す必要がある。ボタンの Enter で足りる

ほかへの影響(確認済み、変更不要):

- `FieldChip`: `onKeyDownCapture` で Enter / Space のとき `selectField` を呼んでいる。Enter ではネイティブのクリックでも `selectField` が呼ばれるので2回呼ばれるが、同じ値を入れるだけなので害は無い。このままにする
- クラスヘッダー(`ClassNode.tsx`、`div role="button"`): Enter では持ち上がらなくなる。Space では今まで通り持ち上がる。ガイドもスクリーンリーダー向けの説明も、もともと Space だけを案内している
- `MethodChip` の手で直すシミュレーション中(`manualFixing`)は `onKeyDown` を外しているので、今と変わらない

操作ガイド(`src/presentation/guide/operationGuide.ts`、presentation):

- 「キーボードで操作する」の節で、`Tab / Shift+Tab` の次に `{ operation: 'Enter', description: '選んだメソッドの中身を右側のエディタに開きます。フィールドなら説明を出します。' }` を足す(`OperationGuideDialog` の `KEY_PATTERN` には `Enter` がすでにある)
- 「処理を抽出する」の行を `{ operation: 'メソッドをクリック / Enter', description: '右側のエディタで処理を選び、新しいメソッドとして抽出できます。キーボードでは、処理のチェックボックスを Space で選び、抽出ボタンで Enter を押します。' }` にする

`domain` / `application` / `infrastructure` は変更しない。データ・型の変更も無い。

## テスト

TDD対象の純粋関数: **なし**。変えるのは dnd-kit に渡す設定の値と、ガイドの文言だけで、`domain` / `application` に新しいロジックは無い。設定の値をそのまま確かめるだけのユニットテストは書かない(壊れたら下の E2E が落ちる)。先に書く「失敗するテスト」は次の E2E。

- `e2e/operation-guide.spec.ts` の「メソッドで Enter を押すとエディタは開かず、Space と同じくキーボードドラッグが始まる」を、**「メソッドで Enter を押すとエディタに中身が開き、ドラッグは始まらない」** に書き換える
  - Arrange: `/` を開き `completeOpeningFix`、`method-printMonthlyReport` にフォーカス
  - Act: `Enter`
  - Assert: `[data-testid="method-editor-empty"]` が消え、`.method-editor` に `printMonthlyReport` が出る。`.drag-overlay` と `.class-node--can-drop, .class-node--cannot-drop` が0件
- 新規 **「キーボードだけでメソッドを開いて Extract Method まで完了できる」**(同じファイルに足す)
  - Arrange: `/` を開き `completeOpeningFix`、`method-printMonthlyReport` にフォーカス(フォーカスの置き方は既存のテストに合わせる。ここから先はマウスを使わない)
  - Act: `Enter` → エディタの最初の処理のチェックボックスにフォーカスが来るまで `Tab`(上限30回のループ。来なければ失敗)→ `Space` でチェック → 抽出ボタン(`選んだ処理をメソッドとして抽出`)にフォーカスが来るまで `Tab`(上限30回)→ `Enter`
  - Assert: 名前は自動で入るので、そのまま抽出される。抽出元と同じクラスにメソッドチップが1つ増え、`printMonthlyReport` の行数が減る
- 新規 **「Space ではこれまで通りキーボードドラッグが始まる」**: 書き換え前のテストの Space 版(持ち上がること、`setTimeout(0)` を待ってから Esc で取り消せること)。`dnd-announcements-ja.spec.ts` などがすでに Space で持ち上げている場合は、新規に足さずそれで足りることを確認するだけでよい
- 操作ガイドの E2E で、「キーボードで操作する」の節に `Enter` の行が出ることを確かめる(既存の行の確認に1行足す)

## 受け入れ基準

1. 症状の手順で `Enter` を押すと、右のエディタに `printMonthlyReport()` の処理が並び、メソッドは持ち上がらない
2. `Space` → 矢印キー → `Space` でのキーボードドラッグ(メソッド・フィールド・クラスヘッダー)と、`Esc` での取り消しは今まで通り動く
3. マウスを使わずに、メソッドを開く → 処理を選ぶ → 抽出、まで終えられる(上の E2E)
4. 操作ガイドの「キーボードで操作する」に `Enter` の行があり、「処理を抽出する」にキーボードでの手順が書かれている
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 右クリックメニュー(Shift+F10)への「中身を開く」の追加
- Enter を押した後、フォーカスを自動でエディタへ移すことや、エディタへ飛ぶショートカット(今は Tab で順に進む。キャンバスのノードが多いステージで Tab の回数が問題になったら、別の仕様で扱う)
- エディタの空表示の文言(「メソッドをクリックしてみよう」)の書き換え
- `FieldChip` の `onKeyDownCapture` の整理、操作ガイドの `?` の行が2つの節に重なっていることの整理
- 白紙設計モード・クイズのキャンバスへの個別対応(同じ `CodebaseCanvas` を使うので、自動で同じ動きになる)
