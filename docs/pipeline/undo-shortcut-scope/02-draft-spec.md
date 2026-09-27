# 仕様草案: Ctrl+Z / Ctrl+Y の効く範囲を正す(選択欄・チェックボックスでは効かせ、開いているダイアログの裏では効かせない)

- slug: `undo-shortcut-scope`
- 元になった探索: `docs/pipeline/undo-shortcut-scope/01-discovered.md`
- 変更の中心: `src/presentation/useUndoRedoShortcut.ts`(`isEditingText` と `keydown` の処理)

## 1. 背景・目的

`useUndoRedoShortcut` は document の `keydown` を見て、Ctrl(Mac は Cmd)+Z で `undo`、Ctrl+Y / Ctrl+Shift+Z で `redo` を呼ぶ。
今の除外判定 `isEditingText`(5〜7行目)は `INPUT`・`TEXTAREA`・`SELECT` を**すべて**「ブラウザの文字の取り消しに任せる場所」として扱っており、次の2つがずれている。

1. **効くべきときに効かない**
   - メソッドエディタの可視性の選択欄(`MethodEditor.tsx` 148行目の `<select>`)で public / private を変えると、フォーカスは選択欄に残る。
     可視性の変更はコードベースを変える1手(`changeVisibility` → `commit` で履歴に積まれる)なのに、直後の Ctrl+Z は無視される
     (`docs/specs/cohesion-value-object-anemic.md` 42行目に「制約」として記録済み。`e2e/refactor.spec.ts` 1153行目は、わざわざフォーカスを外してから Ctrl+Z している)
   - 処理のチェックボックス(`MethodEditor.tsx` 74行目、`type="checkbox"`)も同じ。抽出のあと次の処理を選び始めてから Ctrl+Z を押しても黙って無視される
   - `<select>` にもチェックボックスにもブラウザ標準の「文字の取り消し」は無いので、判定から外しても失うものは無い
2. **効くべきでないときに効く**
   - 「変更前の図」「解答例の図」(`CodebasePreviewDialog.tsx` の `<dialog>` を `showModal()`)を開いたまま Ctrl+Z を押すと、
     モーダルの裏で自分の作業が1手戻り、閉じるまで何が戻ったのか見えない。白紙設計の「模範解答の図を見る」も同じダイアログを使う。
     `operation-guide` が足すガイドのダイアログ(同件02で `<dialog>` + `showModal()` と決まっている)でも同じことが起きる

対象プレイヤーは Ctrl+Z を「直前の1手を戻す」道具として体に覚えている。試行錯誤(移す→点数を見る→戻す)を気軽に回せることが学びの前提なので、
「押したのに戻らない」「見えないところで戻った」をなくす。

**本当に新しい仕組みが要るか**: 要らない。判定関数1つの中身を直し、「開いているダイアログがあるか」の1行を足すだけ。
ストア(`undo`/`redo`)・履歴(`history.ts`)・domain / application / infrastructure は変更しない。新しい依存も足さない。
「どの `<select>` で効かせるか」を個別に指定する仕組み(data属性でのオプトアウトなど)も、下の調査で全部の選択欄で害が無いと分かったので作らない。

### 調査で確かめたこと(判定を変えても既存の画面に害が無いか)

| 要素 | 場所 | 判定変更後 | 害が無い理由 |
| --- | --- | --- | --- |
| 可視性の `<select>` | `MethodEditor.tsx` 148行目 | Ctrl+Z / Y が効く | 直したい本命 |
| 処理のチェックボックス | `MethodEditor.tsx` 74行目 | Ctrl+Z / Y が効く | 直したい本命。チェック状態はコンポーネントの state なので、戻しても選択は消えない |
| ステージの `<select>` | `StagePanel.tsx` 26行目 | Ctrl+Z / Y が効く | `selectStageState` が `history: emptyHistory()` にするので、切り替え直後の Ctrl+Z は何もしない。Tab で戻ってきて押したときは作業が1手戻る(期待どおり) |
| クイズの `<select>` | `ComparisonQuizView.tsx` 128行目 | 変化なし | 設計くらべの間は `App.tsx` 17行目・`BlankDesignView.tsx` 21行目の両方のフックが `enabled=false` |
| 名前の入力欄(text の `INPUT`) | `MethodEditor.tsx` 99・232行目、`CanvasContextMenu.tsx` 30行目、`InlineEditableLabel.tsx` 15行目、`MethodChip.tsx` 60行目 | 今までどおりブラウザに任せる | `type` 未指定 = `text` |
| モードの切り替え | `App.tsx` 40行目 | 変化なし | `<button>`。もともと除外されていない |
| `<dialog>` | `CodebasePreviewDialog.tsx` 23行目 | 開いている間は Ctrl+Z / Y を無視 | 閉じている間は `open` 属性が無い(条件付きマウントなので要素自体も無い) |

既存のE2E(`e2e/refactor.spec.ts` 697・724〜727・950〜959・1155・1282・1318・1475行目、`e2e/blank.spec.ts` 134・141行目、`e2e/quiz.spec.ts` 96・109行目)は、
押す直前のフォーカスがボタン・メソッドのチップ・body のいずれかで、`<select>`・チェックボックス・ダイアログには無い。判定を変えても結果は変わらない見込み
(1155行目は選択欄からフォーカスを外してから押しているので、そのまま通る)。

## 2. 変更対象ファイル一覧

未決事項3が推奨案(選択肢A)の場合の一覧。選択肢Bなら判定関数は `useUndoRedoShortcut.ts` に置いたまま `export` し、テストは `useUndoRedoShortcut.test.ts` にする。
選択肢Cなら新規の2ファイルは作らない。

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/useUndoRedoShortcut.ts` | presentation | 今の `isEditingText` を消し、`undoShortcutGuard.ts` の判定2つを `keydown` の除外条件に使う |
| 新規 | `src/presentation/undoShortcutGuard.ts` | presentation | `isEditingText`(文字を打てる入力欄だけ)・`hasOpenDialog`(開いているダイアログがあるか)の2関数 |
| 新規 | `src/presentation/undoShortcutGuard.test.ts` | presentation(テスト) | 上の2関数のユニットテスト(jsdom) |
| 新規 | `e2e/undo-shortcut.spec.ts` | (E2E) | 選択欄・チェックボックス・ダイアログ・文字の入力欄での Ctrl+Z の挙動を守る(`refactor.spec.ts` との競合を避けるため新しいファイル) |
| 変更 | `docs/specs/cohesion-value-object-anemic.md` 42行目 | (文書) | **未決事項4の結果次第**。注記を足す場合のみ |
| 変更 | `e2e/refactor.spec.ts` 1153行目のコメント | (E2E) | **未決事項4の結果次第**。コメント1行だけ。テストの手順は変えない |

変更しないもの(読むだけ): `App.tsx`・`BlankDesignView.tsx`(フックの呼び方は変えない)・`MethodEditor.tsx`・`StagePanel.tsx`・`ComparisonQuizView.tsx`・
`CodebasePreviewDialog.tsx`・`CanvasContextMenu.tsx`・`useInlineEdit.ts`・`InlineEditableLabel.tsx`・`MethodChip.tsx`・`useGameStore.ts`・`history.ts`・
`e2e/blank.spec.ts`・`e2e/quiz.spec.ts`・`e2e/preview.spec.ts`・`src/domain/`・`src/application/`・`src/infrastructure/` のすべて。

## 3. データ/型の変更

無し。ドメインモデル・ストア・永続化スキーマ・ステージ定義は変更しない。新しい型も作らない。

### 判定の形(推奨案。未決事項1〜3で変わる部分あり)

```ts
/** 文字を打たない input。ブラウザ標準の文字の取り消しが無いので、ゲームの1手戻しを効かせる。 */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** 文字を打てる入力欄(text 系の input・textarea・contentEditable)では、ブラウザ標準の文字の取り消しを優先する。 */
export function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type);
}

/** 開いているダイアログがあれば、その裏の作業は戻さない。 */
export function hasOpenDialog(root: ParentNode): boolean {
  return root.querySelector('dialog[open]') !== null;
}
```

`keydown` の除外条件は次の形にする(`enabled` が false の間は何もしない、という既存の約束はそのまま)。

```ts
if (!(event.ctrlKey || event.metaKey) || isEditingText(event.target) || hasOpenDialog(document)) return;
```

- `SELECT` は除外リストから外す(=効かせる)。`<select>` に文字の取り消しは無い
- `HTMLInputElement.type` はブラウザが小文字に正規化し、知らない値は `'text'` になる。除外リスト方式なので、将来知らない `type` が来ても「今までどおりブラウザに任せる」側に倒れる(安全側)
- ダイアログが開いている間は `preventDefault()` もしない(ブラウザ標準の挙動をそのまま残す)。ダイアログの中の入力欄で文字の取り消しが効くのも今までどおり
- `hasOpenDialog` を `document` 全体で見る理由: ダイアログの中の余白(図のキャンバスなど、フォーカスできない所)をクリックすると
  フォーカスが `body` に落ち、`event.target.closest('dialog[open]')` では見逃すため(未決事項2)
- ESLint: 複雑度・引数の数・`as` 禁止・`no-unnecessary-condition` に触れない形にする(`instanceof` で絞り込む)

## 4. TDD対象の純粋関数

presentation 層なのでカバレッジの閾値の対象外だが、場合分けが増えるので**テストを先に書いてから**判定を直す(Red→Green)。
Vitest(`vite.config.ts` の `environment: 'jsdom'`)で `document.createElement` した要素を渡し、AAA パターンで書く(前例: `src/presentation/canvas/clampMenuPosition.test.ts`)。

### `isEditingText(target: EventTarget | null): boolean`

| ケース | 入力 | 期待 |
| --- | --- | --- |
| 正常系 | `type` 未指定の `<input>` | `true` |
| 正常系 | `type="search"` / `type="number"` の `<input>`(代表で1〜2個) | `true` |
| 正常系 | `<textarea>` | `true` |
| 正常系(今回の修正) | `type="checkbox"` の `<input>` | `false` |
| 正常系(今回の修正) | `type="radio"` の `<input>` | `false` |
| 正常系(今回の修正) | `<select>` | `false` |
| 正常系 | `<button>`・`<div>` | `false` |
| 異常系 | `null` | `false` |
| 異常系 | `HTMLElement` でない `EventTarget`(`document` や `window`) | `false` |

- contentEditable のケースは**ユニットテストに入れない**。jsdom は `isContentEditable` を実装していない(常に `undefined`)ため、テストが実際のブラウザと食い違う。
  判定は今までどおり残す(今の画面に contentEditable の要素は無い)

### `hasOpenDialog(root: ParentNode): boolean`

| ケース | 入力 | 期待 |
| --- | --- | --- |
| 正常系 | `open` 属性付きの `<dialog>` を子に持つ `div` | `true` |
| 正常系 | 深い入れ子(`div > section > dialog[open]`) | `true` |
| 正常系 | `open` 属性の無い `<dialog>` だけを持つ `div`(閉じているガイドのダイアログを想定) | `false` |
| 異常系 | 子を持たない `div` | `false` |

- jsdom の `showModal()` の対応に頼らないよう、テストでは `dialog.setAttribute('open', '')` で開いた状態を作る

## 5. 受け入れ基準

- [ ] `npm run check`(lint + typecheck + test)が通る
- [ ] 4章のユニットテストがすべて通り、実装より先に書かれている(未決事項3が選択肢Cの場合を除く)
- [ ] 新しい `e2e/undo-shortcut.spec.ts` に次のテストがあり、`npm run test:e2e` で通る(既存の `e2e/*.spec.ts` もすべてそのまま通る)
  1. **可視性の選択欄**: 中級3(`page.getByLabel('ステージ').selectOption({ label: '中級3: 越境する private メソッド' })`)で `method-renderTemplate` をクリックし、
     `メソッド renderTemplate の可視性` の選択欄に `focus()` → `press('ArrowUp')` で public にする。選択欄に**フォーカスが残っていること**(`toBeFocused()`)を確かめてから
     `Control+z` を押すと、選択欄の値が `private` に戻り、点数に `アクセス制御 -10` が戻る。続けて `Control+y` で `public` に戻る
  2. **処理のチェックボックス**: チュートリアル2で `placeOrder` から「消費税を計算する(軽減税率あり)」を `calculateTax` として抽出したあと、
     メソッドエディタに残っている処理のチェックボックスのどれかをクリック(チェック)し、**フォーカスがそのチェックボックスにあること**を確かめてから
     `Control+z` を押すと `method-calculateTax` が消える(抽出が戻る)
  3. **ダイアログ**: チュートリアル2で `calculateTax` を抽出したあと「変更前の図を見る」を押し、ダイアログ(`codebase-preview`)が見えている状態で
     `Control+z` を押す。「閉じる」で閉じたあと、`method-calculateTax` が**まだ見えている**(作業が戻っていない)。
     未決事項2が選択肢Aなら、ダイアログの中の図(フォーカスできない余白)をクリックしてから押す場合も同じく戻らないことを確かめる
  4. **文字の入力欄は今までどおり**: チュートリアル2で抽出を1回したあと、「新しいメソッド名」の入力欄に文字を打ち、その入力欄にフォーカスがある状態で
     `Control+z` を押しても `method-calculateTax` は消えない(ゲームの1手戻しは起きない)
- [ ] 設計くらべの間は Ctrl+Z が効かない・白紙設計とリファクタリングの履歴が混ざらない、という既存の約束が既存のE2E(`e2e/quiz.spec.ts`・`e2e/blank.spec.ts`)で守られたまま
- [ ] `src/domain/`・`src/application/`・`src/infrastructure/`・`useGameStore.ts`・`history.ts` に差分が無い
- [ ] ブラウザで手で確かめる: 可視性の選択欄で private → public に変え、そのまま Ctrl+Z で private に戻る/「解答例の図を見る」を開いて Ctrl+Z を押し、閉じたあと作業が変わっていない

## 6. スコープ外

- **キーボードでドラッグしている間(dnd-kit の `KeyboardSensor` で掴んでいる間)の Ctrl+Z**: 掴んでいるメソッドが戻しで消えうるが、落としても既存の操作が
  「見つからない」で失敗するだけでデータは壊れない。`drag-announcements-ja` がドラッグ中の読み上げを決めたあとに見る
- **右クリックメニューを開いている間の Ctrl+Z**: メニューの中身はストアから作り直されるので、今のところ実害が見えない(困る声が出たら同じ判定に足す)
- **ボタンの `title="Ctrl+Z"` を Mac で「⌘Z」と出し分ける・`aria-keyshortcuts` を付ける**: `operation-guide` の一覧と文言を揃えたいので、あちらのマージ後
- **Undo の1手ごとに何を戻すかをボタンに出す**(履歴に操作の説明を積む): 別テーマ。`history.ts`・`useGameStore.ts` に差分が出る
- **`<select>` ごとに Ctrl+Z を効かせる/効かせないを切り替える仕組み**(data属性など): 今ある選択欄はすべて効かせて害が無い(1章の表)。要る選択欄が出てから足す
- **ダイアログを `dialog:modal` で見分ける(非モーダルの `show()` のダイアログを除く)**: 今の画面・進行中の件のダイアログはすべて `showModal()`。非モーダルのダイアログが出てから考える
- **IME 変換中(`event.isComposing`)の扱い**: 文字の入力欄はもともとブラウザに任せているので、今回の変更で新しく問題になる場面が無い
- `operation-guide` の一覧の文言(「選択欄・チェックボックスでも効く」と書くか)は、あちらの件の判断。本件では触らない

## 7. 意味上の依存(他の進行中の件との関係)

- `operation-guide`: ガイドのダイアログは `<dialog>` + `showModal()` なので、本件の `hasOpenDialog` がそのまま裏での1手戻しを止める。追加の変更は要らない(どちらが先にマージされても動く)。
  同件02の154〜156行目でスコープ外に回した穴を本件で拾う
- `method-select-keyboard`・`blank-design-second-problem`: 新しく足す `<select>` にフォーカスが残っていても、本件のマージ後は Ctrl+Z が効く。
  `blank-design-second-problem` の問題の選択欄は、問題を切り替えると白紙設計の履歴が空になる前提(同件の実装で空にならない場合は、切り替え直後の Ctrl+Z で前の問題の作業が戻らないか、あちらで確かめる)
- `method-rename-keyboard`・`identifier-name-validation`: 名前の入力欄(text の `INPUT`)は今までどおりブラウザの取り消しに任せる側なので影響なし
- `drag-announcements-ja`: キーボードでのドラッグ中の Ctrl+Z は本件のスコープ外(6章)。あちらの読み上げが決まったあとに決める
- `render-error-fallback`: 代わりの表示の間はフックごとアンマウントされるので、本件の判定とは関係しない

## 8. 未決事項

### 未決事項1: 「文字を打てる入力欄」(ブラウザの取り消しに任せる `INPUT`)をどう線引きするか

- 選択肢A(推奨): 文字を打たない `type` の除外リスト(checkbox・radio・button・submit・reset・range・color・file・image)に入っていない `INPUT` を「文字を打てる」とみなす。知らない `type` はブラウザが `text` 扱いにするので、将来の型でも今までどおりブラウザに任せる安全側に倒れる
- 選択肢B: 文字を打つ `type` の許可リスト(text・search・url・tel・email・password・number)に入っている `INPUT` だけを「文字を打てる」とみなす。リストに無い `type`(date など)では Ctrl+Z がゲームの1手戻しになる
- 選択肢C: 今の画面にある `type="checkbox"` だけを例外にする(最小限)。radio などが増えたらそのとき足す

### 未決事項2: 「ダイアログが開いている」をどう判定するか

- 選択肢A(推奨): `document.querySelector('dialog[open]') !== null`(画面のどこかで開いているダイアログがあれば効かせない)。ダイアログの中の余白をクリックしてフォーカスが `body` に落ちた場合も止められる。非モーダルのダイアログが増えたら、それも止めてしまう(今は無い)
- 選択肢B: `event.target.closest('dialog[open]')`(フォーカスがダイアログの中にあるときだけ効かせない。`operation-guide` の02が書いた案)。ダイアログの中の余白をクリックしたあとは裏で1手戻る穴が残る
- 選択肢C: `document.querySelector('dialog:modal')`(モーダルだけを見る)。最も正確だが、jsdom が `:modal` に対応しているか怪しく、ユニットテストが書きにくい

### 未決事項3: 判定関数をどこに置き、どうテストするか

- 選択肢A(推奨): 新しいファイル `src/presentation/undoShortcutGuard.ts` に `isEditingText`・`hasOpenDialog` を置き、`undoShortcutGuard.test.ts` でテストする(`clampMenuPosition.ts` と同じ形)。テストがストアを読み込まずに済む(`useUndoRedoShortcut.ts` を読み込むと `useGameStore.ts` がモジュールの読み込み時にストアを作る)
- 選択肢B: `useUndoRedoShortcut.ts` の中に置いたまま `export` し、`useUndoRedoShortcut.test.ts` でテストする。ファイルは増えないが、テストがストアの生成(`localStorage` の読み込み)も巻き込む
- 選択肢C: ユニットテストは書かず、E2E(`e2e/undo-shortcut.spec.ts`)だけで守る。関数は `useUndoRedoShortcut.ts` の中で非公開のまま

### 未決事項4: 「選択欄では Ctrl+Z が効かない」と書いてある既存の記述をどうするか

- 選択肢A(推奨): `docs/specs/cohesion-value-object-anemic.md` 42行目の末尾に「(`undo-shortcut-scope` で解消)」と注記し、`e2e/refactor.spec.ts` 1153行目のコメントも実態に合わせて直す(手順は変えない)。どちらも1行
- 選択肢B: 仕様書に注記だけ足し、`e2e/refactor.spec.ts` は触らない(進行中の件との競合を避ける。コメントは古いまま残る)
- 選択肢C: どちらも触らない(仕様書は過去の記録として残す)
