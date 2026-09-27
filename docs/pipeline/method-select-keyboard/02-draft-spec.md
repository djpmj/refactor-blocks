# 仕様草案: キーボードだけでメソッドを選び、メソッドエディタを開けるようにする

- slug: `method-select-keyboard`
- 元になった探索: `docs/pipeline/method-select-keyboard/01-discovered.md`

## 1. 背景・目的

- Extract Method・可視性の変更・呼び出し元へ戻す・統合・空実装の削除は、すべて**メソッドエディタ**(`MethodEditor.tsx`)から行う。
  メソッドエディタに中身を出す入口(`selectMethod`)は、キャンバスの**メソッドのチップのクリック**(`MethodChip.tsx` 85〜87行目)しか無い
- チップの `<button>` には dnd-kit の `listeners`(`KeyboardSensor` の `onKeyDown`)も展開されており、Enter/Space はドラッグの「掴む」に取られる
  (下の「前提の確認」)。そのため**キーボードだけのプレイヤーはチュートリアル1の最初の課題から先に進めない**
- あわせて、ズーム 60% 未満ではチップ自体が隠れる(`semanticZoom.ts`)ので、全体表示中はマウスでもメソッドを選べない

### 前提の確認(dnd-kit の `KeyboardSensor`)

この草案を書いたセッションにはブラウザを動かす手段が無く(`node_modules` も未インストール)、**Chromium での実機確認はできていない**。
代わりに、`package.json` の `@dnd-kit/core@^6.3.1` に対応するタグ `@dnd-kit/core@6.3.1` のソースを確認した:

- `packages/core/src/sensors/keyboard/defaults.ts`: `defaultKeyboardCodes.start = [Space, Enter]`、`end = [Space, Enter, Tab]`、`cancel = [Esc]`
- `packages/core/src/sensors/keyboard/KeyboardSensor.ts` の `static activators`: `onKeyDown` で `event.nativeEvent.code` が `start` に含まれ、
  `event.target` がアクティベーター(=チップの `<button>`)なら **`event.preventDefault()` してドラッグを開始**する
- `CodebaseCanvas.tsx` 133行目は `useSensor(KeyboardSensor)`(オプション無し=既定のキー)

`<button>` の Enter による `click` は keydown の既定動作、Space による `click` は keydown で押下状態になってからの keyup なので、
keydown を `preventDefault()` されると**どちらもクリック(=`selectMethod`)にならない**。01 の前提(チップで Enter を押しても選べない)はソース上は正しい。
実機での確認は受け入れ基準の 0 番目として実装者に残す(食い違ったら実装せずに止める)。

### 本当に新しい仕組みが要るか

- チップのキー操作を変える案(B・D)は、`drag-announcements-ja`(説明文「スペースキーか**Enterキー**で掴みます」)・`method-rename-keyboard`(同じ `onKeyDownCapture`)と衝突する
- ブラウザ標準の `<select>` + `<optgroup>` で「メソッドを選ぶ」欄を置けば、キー操作・読み上げ・型ぶん探し(先頭文字でのジャンプ)はブラウザが持っている。
  ストアの `selectMethod` と domain の `allClasses` をそのまま使えるので、**domain・application・ストアの変更は要らない**
- 一覧を組み立てる純粋関数も作らない。`allClasses(codebase).filter((codeClass) => codeClass.methods.length > 0)` の1行で済み、
  presentation 層でカバレッジの閾値もかかっていないため、E2Eで守る(4章)

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/editor/MethodPicker.tsx` | presentation | 全メソッドをクラスごとに並べたネイティブの `<select>`。選ぶと `selectMethod` |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | `MethodEditor`(250〜270行目)の `<aside>` の先頭に `<MethodPicker>` を置く。未選択時の案内文を1行直す。import 1行 |
| 変更 | `src/index.css` | presentation | `.method-editor__hint`(131行目)の**直後**に選択欄の余白・幅を1〜2行(末尾追記の件とずらす) |
| 新規 | `e2e/method-select-keyboard.spec.ts` | (E2E) | キーボードだけで選ぶ→抽出まで、ズーム縮小中でも選べる、白紙設計でも選べる |

`MethodPicker` を `MethodEditor.tsx` の中に書かず別ファイルにする理由: `method-call-references` が同じファイルの `FragmentFieldRefs`・`MethodEditorBody` と
`Codebase.ts` からの import(2〜14行目)を変更する。`allClasses` の import を新しいファイル側に持てば、`MethodEditor.tsx` の差分は
import 1行・JSX 1行・案内文1行だけになり、テキスト上の競合をほぼ無くせる。

変更しないもの(読むだけ): `MethodChip.tsx`・`CodebaseCanvas.tsx`(センサー設定を含む)・`useGameStore.ts`・`Codebase.ts`・`semanticZoom.ts`・
`StagePanel.tsx`・`BlankDesignView.tsx`・`App.tsx`。`src/domain/`・`src/application/`・`src/infrastructure/`・`CanvasContextMenu.tsx`・`ChangeRequestPanel.tsx`・
`e2e/refactor.spec.ts`・`e2e/blank.spec.ts` は触らない。

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの変更は無し。

### `MethodPicker`(`src/presentation/editor/MethodPicker.tsx`)

```tsx
/** キーボードだけでもメソッドを選べるように、全メソッドをクラスごとに並べた選択欄。キャンバスのズームにも左右されない。 */
export function MethodPicker({ selectedMethodId }: Readonly<{ selectedMethodId: string | undefined }>)
```

- `codebase` と `selectMethod` を `useGameStore` から読む。**一覧(`allClasses(...).filter(...)`)はセレクタの外で作る**
  (セレクタで毎回新しい配列を返すと購読が無限ループする。`MethodEditorBody` の `mergeCandidates` のコメントと同じ理由)
- 構造:
  ```tsx
  <label className="method-editor__picker">
    メソッドを選ぶ
    <select
      className="method-editor__picker-select"
      aria-label="メソッドを選ぶ"
      value={selectedMethodId ?? ''}
      onChange={(event) => { selectMethod(event.target.value); }}
    >
      <option value="" disabled>(一覧から選ぶ)</option>
      {/* メソッドが1つ以上あるクラスだけ。allClasses の順(ファイル順 → クラスの宣言順) */}
      <optgroup key={codeClass.id} label={codeClass.name}>
        {/* メソッドの宣言順 */}
        <option key={method.id} value={method.id}>{`${codeClass.name}.${method.name}()`}</option>
      </optgroup>
    </select>
  </label>
  ```
  - `aria-label` を明示する(`<label>` で包むだけだと、Chromium はアクセシブルネームに選択中の項目の文字も混ぜるため。`VisibilitySelect` と同じ書き方)
  - `<option>` の中身はテンプレートリテラルで1つの文字列にする(React は `<option>` の子に複数のテキストノードを並べると警告する)
  - 先頭の「(一覧から選ぶ)」は `disabled`。未選択のときだけ表示され、選び直して未選択に戻すことはできない(新しい「選択解除」の操作は作らない)
  - 中身の無い契約メソッド(`fragments: []`)・白紙設計の部品置き場(`TRAY_FILE_ID` のファイル)のメソッドも**並べる**。チップのクリックで選べるものと同じ集合にする
- `change` イベントのたびに `selectMethod` する。閉じた選択欄で矢印キーを押すと項目が1つずつ切り替わり、メソッドエディタもそのたびに切り替わる
  (`StageSelect`・可視性の選択欄と同じ振る舞い。選びかけの処理のチェックは、今もチップで選び直すと消えるので同じ)
- 選んだあとのフォーカスは**選択欄に残す**(何もしない)。`MethodEditorBody` は `key={method.id}` で作り直されるが、選択欄はその外にあるので
  フォーカスは失われない。Tab で次の処理のチェックボックスへ進める。読み上げは選択欄の値の変化(「ReportService.printMonthlyReport()」)で伝わる

### `MethodEditor`(`MethodEditor.tsx` 250〜270行目)

```tsx
<aside className="method-editor" aria-label="メソッドエディタ">
  <MethodPicker selectedMethodId={method?.id} />   {/* 追加。選択の有無にかかわらず常に出す(未決事項3) */}
  {method === undefined ? (
    <p className="method-editor__hint">メソッドをクリックするか上の一覧から選ぶと、中の処理がここに表示されます</p>  {/* 文言だけ変更 */}
  ) : (
    <MethodEditorBody key={method.id} method={method} />
  )}
  ...(以下そのまま)
```

- `value` には `selectedMethodId` ではなく、見つかった `method?.id` を渡す(Undo などでメソッドが消えたときに存在しない値を渡さないため。
  ストアの `commit` も消えたメソッドの選択を外すので二重の備え)
- 変更依頼の実装中(`ChangeRequestPanel` に差し替わる)は出ない。今のままでよい

### CSS(`src/index.css` 131行目の直後)

- `.method-editor__picker { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 12px; color: var(--muted); }`
- `.method-editor__picker-select` は `.method-editor__visibility-select` と同じ見た目 + `width: 100%`(既存の行は変えず、新しい1行として書く)

## 4. TDD対象の純粋関数

**無し**。domain / application 層に新しいロジックを足さない。一覧の組み立ては `allClasses` + `filter` の1行で、
presentation の表示なのでユニットテストの対象外とし、E2E(5章)で守る。
(`allClasses` の並び順は既存の `Codebase.ts` の定義どおりで、変更しない)

## 5. 受け入れ基準

- [ ] **0. 前提の確認(実装の前に)**: Chromium で、チュートリアル1のチップ `method-printMonthlyReport` に `focus()` → Enter を押しても
      メソッドエディタに中身が出ない(ドラッグが始まる)ことを確かめ、結果をPRの説明に1行書く。
      **Enter で選べた場合は実装せずに止め、呼び出し元へ報告する**(本件の前提が崩れるため)。この確認のためのテストはコミットしない
- [ ] リファクタリング画面・白紙設計の両方で、メソッドエディタの先頭に「メソッドを選ぶ」選択欄が出る。未選択時は「(一覧から選ぶ)」が表示される
- [ ] 選択欄は、メソッドを1つ以上持つクラスごとに `<optgroup>`(ラベルはクラス名)で分かれ、項目は `クラス名.メソッド名()`
- [ ] 選ぶとメソッドエディタにそのメソッドが出て、フォーカスは選択欄に残る。キャンバスのチップをクリックして選ぶと、選択欄の値もそのメソッドになる
- [ ] Extract Method のあと、選択欄に切り出したメソッドが増え、値は切り出したメソッドになる(ストアが `selectedMethodId` を新しいメソッドにするため)
- [ ] ズーム 60% 未満でチップが隠れていても、選択欄から選べる
- [ ] 既存のE2E(`refactor.spec.ts`・`blank.spec.ts`・`quiz.spec.ts`・`preview.spec.ts`・`critique.spec.ts`)が変更なしで通る
- [ ] 新しい `e2e/method-select-keyboard.spec.ts` に次を書き、通る(AAA のコメントを付ける)
  1. 「キーボードだけでメソッドを選び、処理を抽出できる」(チュートリアル1)
     - ステージを選ぶ(`getByLabel('ステージ').selectOption(...)` は準備として可)→ `getByLabel('メソッドを選ぶ')` に `focus()` → `press('ArrowDown')`
     - `getByRole('heading', { name: /ReportService\.printMonthlyReport\(\)/ })` が見える。選択欄が `toBeFocused()`
     - `keyboard.press('Tab')` → `getByLabel('今月の売上を集計する')` が `toBeFocused()` → `press('Space')` → `toBeChecked()`
     - 「選んだ処理をメソッドとして抽出」ボタンが `toBeFocused()` になるまで Tab を押す(上限10回。途中の要素数に依存しないため)→ `press('Enter')`
     - `getByTestId('class-ReportService').getByTestId('method-aggregateSales')` が見え、選択欄に `ReportService.aggregateSales()` の項目が1件ある
  2. 「ズームアウトでメソッドが隠れていても、一覧から選べる」(チュートリアル2)
     - 「Zoom Out」を4回 → `method-placeOrder` が `toHaveCount(0)` → 選択欄で `selectOption({ label: 'OrderService.placeOrder()' })`
       → `OrderService.placeOrder()` の見出しが見える
  3. 「白紙設計でも、部品置き場のメソッドを一覧から選べる」
     - `mode-blank` を押す → `blankView(page)` の中の `getByLabel('メソッドを選ぶ')` に `focus()` → `press('ArrowDown')`
       → 白紙設計の画面の中に `部品置き場.placeOrder()` の見出しが見える
     - **リファクタリング画面の選択欄も DOM に残る(`hidden` なだけ)ので、白紙設計側は必ず `blank-view` の中に絞る**
- [ ] `npm run check`(lint + typecheck + test)と `npm run test:e2e` が通る。`as`・`!`・`enum` を使わない

## 6. スコープ外

- **チップの上での Enter/Space の意味を変えること**(`KeyboardSensor` の開始キーの変更・`onKeyDownCapture` の追加): 未決事項1で B/D を選んだ場合を除く
- **右クリックメニューの「メソッドエディタで開く」**: 未決事項1で C を選んだ場合を除く
- **選んだメソッドのクラスへキャンバスを寄せる(`fitView` の対象を絞る)**: `CodebaseCanvas.tsx` に差分が出る。実機で「どこにあるか分からない」と分かってから
- **選択欄に行数・可視性の印を出すこと**: キャンバスとメソッドエディタの見出しに出ている。要望が出たら足す
- **選択欄での絞り込み検索(コンボボックス)**: ネイティブの型ぶん探しで足りない規模のステージが出てから
- **変更依頼の実装中の `inspectMethod` のキーボード対応**: 今もチップのフォーカスで効いている
- **`ChangeRequestPanel.tsx` のエラーメッセージに `role="alert"` を足すこと**(01 の見送り候補): 本件とは別の画面。別件で
- **メソッド名の変更をキーボードで行うこと**: `method-rename-keyboard` の担当
- **`score-deduction-locations`・`method-call-references` の一覧の名前から選ぶ入口**: それぞれのマージ後

## 未決事項

### 未決事項1: キーボードでメソッドを選ぶ入口をどこに置くか

- 選択肢A(推奨): メソッドエディタの先頭にネイティブの `<select>`(クラスごとの `<optgroup>`)を置く。ブラウザ標準で済み、ズーム縮小中でも選べ、進行中の他件と変更箇所が重ならない
- 選択肢B: `KeyboardSensor` の開始キーを Space だけにし、チップで Enter を押すと選択にする。チップの上で完結するが、`drag-announcements-ja` の説明文(Enterキーで掴みます)と矛盾し、フィールド・クラスの掴み方も変わる
- 選択肢C: 右クリックメニュー(Shift+F10)に「メソッドエディタで開く」を足す。`move-class-via-context-menu` が同じ `menuItemsFor` を書き換え中で、そのマージ後が前提
- 選択肢D: チップの `onKeyDownCapture` で別のキー(例: Enter を先に拾う)を足す。`method-rename-keyboard` が同じ場所に F2 を足すので、そのマージ後が前提

### 未決事項2: 選択欄の項目の書き方

- 選択肢A(推奨): `クラス名.メソッド名()`(例: `StripeGateway.charge()`)。上級2のように同名のメソッドが複数クラスにあっても、読み上げで区別できる(`<optgroup>` のラベルを読まないスクリーンリーダーがあるため)。見出し・`method-call-references` の表記とも揃う
- 選択肢B: `メソッド名()` だけ(クラスは `<optgroup>` のラベルで見せる)。先頭の文字を打つとメソッド名でジャンプできるが、同名メソッドは読み上げで区別しにくい

### 未決事項3: 選択欄をいつ出すか

- 選択肢A(推奨): 常に出す(選択中も)。選択欄から矢印キーで次々にメソッドを見比べられ、別のメソッドへ移るのにキャンバスへ戻らなくてよい
- 選択肢B: 未選択のときだけ(案内文の代わりに)出す。画面は広く使えるが、選んだあとに別のメソッドへ移るにはキャンバスのチップ(キーボードでは選べない)に戻る必要がある

### 未決事項4: `operation-guide` の「メソッドの中の処理を見る」行のキーボード列をどうするか

- 選択肢A(推奨): 本件の実装時点で `operation-guide` がマージ済みなら、本件のPRでその1行を「メソッドエディタの『メソッドを選ぶ』欄に Tab で移動 → 矢印キーで選ぶ」に直す。未マージなら何もしない(後から入る `operation-guide` が実装時点の操作を書く方針のため)
- 選択肢B: どちらが先でも本件ではガイドに触らない。ガイドの更新は別件にする
