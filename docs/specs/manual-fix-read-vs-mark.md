# manual-fix-read-vs-mark: 手で直す最中の「読む」クリックと「直した」印を別の操作に分ける

## 背景・目的

学習者の目線で「実際に直してみる」(手で直すシミュレーション。`ManualFixPanel` / `ManualFixMethodViewer`)を実機で遊んで、次の不足を見つけた。

- 手で直している間、メソッドのチップ(`MethodChip`)の `title` は「クリックで『直した』印を付け外し」で、クリックすると
  `toggleFixed` が呼ばれ、**印の付け外しと、右サイドバーへの中身の表示(`viewedMethodId`)が同時に起きる**
  (`manual-fix-method-viewer` で中身の表示を同じクリックに相乗りさせたため)。
- 再現手順: 中級9「コピペされた消費税計算を1か所にまとめる」で「実際に直してみる」→ 中身を読むつもりで `QuoteService.create` を1回クリック
  (気づかないうちに「✔ 直した」が付く)→ もう一度読み直そうとしてクリック(印が外れる)→ 残り2か所に印を付けてリリース →
  「⚠ 直し忘れ 1 か所」と判定された。
- このシミュレーションで学ばせたいのは「どこを直す必要があるかを判断する」ことなのに、**読もうとしただけのクリックで印が付き外れし、判断とは無関係な原因で不正解になる**。
  中身を読めば読むほど誤操作が増えるので、「読んでから判断する」という望ましい行動が罰せられている。

そこで、チップのクリックは「選んで読む」だけにし、「直した」印はチップの横の専用のチェックボックスで付け外しするように分ける。

## 設計判断(確定)

1. **印はチップの右隣のチェックボックス(`<input type="checkbox">`)で付ける。右サイドバーのボタンにはしない。**
   - キャンバス上で、読んだメソッドのすぐ隣で印を付けられる。キーボードでもチップの次の Tab で届く(右サイドバーのボタンだと、
     キャンバスの残りのブロックをすべて Tab で通り過ぎないと届かない)
   - 幅 700px 以下の画面では右サイドバーの見え方が別扱いなので、印の操作を右サイドバーに頼ると狭い画面で印が付けられなくなる恐れがある
   - ponytail の階段4: ブラウザ標準のチェックボックスを使う。オン/オフの読み上げ・Space での切り替えがそのまま手に入り、
     React Flow のキー操作も `input` の上では反応しない。独自のトグルボタン(`aria-pressed`)は作らない
2. **チップのクリック(Enter/Space を含む)は、手で直す間は「選んで読む」だけ**にする。新しいアクション `viewManualFixMethod` を呼び、
   `viewedMethodId` だけを変える。`fixedIds` は変えない。
3. **チェックボックスで印を付け外ししたときも `viewedMethodId` をそのメソッドにする**(今の `toggleFixed` の振る舞いを残す)。
   読まずに印を付けた場合でも右に中身が出るので、読む機会を増やす方向に働く。既存のストアのテストもそのまま使える。
4. **見ているメソッドはチップを「選択中」の見た目(`.method-chip--selected`)と `aria-pressed="true"` で示す。**
   クリックの意味が「選ぶ」になるので、通常時(`selectedMethodId`)と同じ見た目・読み上げにそろえる。
   (`manual-fix-method-viewer` のスコープ外だった「見ているメソッドのキャンバス上での強調」は、この仕様で入れる)
5. **リリース後はチェックボックスを出さない。** 結果は確定しているので付け外しさせない。チップの「✔ 直した」はそのまま残り、
   チップのクリックで中身を読むことは今どおりできる。リリース後の `toggleFixed` は何もしない。
6. チップの中の「✔ 直した」(`data-testid="fixed-mark"`)と、読み上げ名の「「直した」印あり」(`methodChipLabel`)は残す。
   チェックボックスの状態とは重複するが、リリース後の結果を見るときに必要で、既存の表示・テストを変えずに済む。

本当にチェックボックスが要るか(「ダブルクリックで印」「右クリックメニューで印」では足りないか): ダブルクリックは名前の変更、
右クリックは移動メニューに使っており、どちらも見つけにくい。目に見える専用の操作が要るので、チェックボックスを足す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | アクション `viewManualFixMethod` を足す。`toggleFixed` はリリース後に何もしないようにする |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 上のテスト(TDD。先に書く) |
| 変更 | `src/presentation/canvas/MethodChip.tsx` | presentation | 手で直す間のチップのクリックを `viewManualFixMethod` に変え、選択中の見た目・`aria-pressed` を `viewedMethodId` から出す。チェックボックスのコンポーネント `ManualFixCheck` をここに足して export する |
| 変更 | `src/presentation/canvas/ClassNode.tsx` | presentation | `ClassBody` の `.method-chip-row` の中、`MethodChip` の後ろに `ManualFixCheck` を置く |
| 変更 | `src/presentation/guide/operationGuide.ts` | presentation | `BLOCK_OPERATION_TITLES.manualFix` の文言を変え、`manualFixCheck` を足す |
| 変更 | `src/presentation/stage/ManualFixPanel.tsx` | presentation | `FixInput` の案内文を変える |
| 変更 | `src/presentation/tour/tourSteps.ts` | presentation | 初回ツアーの3つ目の手順の文言を変える |
| 変更 | `src/index.css` | presentation | 手で直す間の `.method-chip-row` を横並びにし、チェックボックスの当たり判定を広げる |
| 変更 | `e2e/manual-fix.spec.ts` ほか(下の「E2Eの更新範囲」) | E2E | 印をチェックボックスで付ける形に直し、読むクリックで印が付かないことを足す |

`domain` / `application` / `infrastructure` は変更しない(採点 `checkManualFix` は `fixedIds` を受け取るだけで、付け方は関係しない)。
`ManualFixMethodViewer`・`methodChipLabel` は変更しない。新しい依存は足さない。新しいファイルも作らない。

## データ・型の変更

`src/presentation/store/useGameStore.ts`:

```ts
// GameState に足す
viewManualFixMethod: (methodId: string) => void;
```

- `ManualFix` 型(`fixedIds` / `released` / `viewedMethodId` / `step`)は変えない
- `manualFixActions` の戻り値の `Pick` に `'viewManualFixMethod'` を足す
- `viewManualFixMethod(methodId)`: `manualFix === null` なら何もしない。それ以外は `released` にかかわらず `viewedMethodId: methodId` にする。`fixedIds`・`selectedMethodId` は変えない
- `toggleFixed(methodId)`: `manualFix === null` または `released === true` なら何もしない。それ以外は今どおり `fixedIds` を切り替え、`viewedMethodId: methodId` にする

`src/presentation/guide/operationGuide.ts`:

```ts
manualFix: 'クリックで中身を右に表示',
manualFixCheck: 'チェックで「直した」印を付け外し',
```

## 動きの仕様

### チップ(`MethodChip`)

- 手で直す間(`manualFix !== null`)のクリック、および Enter / Space(今どおりキーボードドラッグの開始ではなくクリックとして扱う)は
  `viewManualFixMethod(method.id)` を呼ぶ。何度クリックしても「✔ 直した」は増えも減りもしない
- 選択中の見た目: 手で直す間は `manualFix.viewedMethodId === method.id` のとき `.method-chip--selected`、それ以外は今どおり `selectedMethodId === method.id`
- `aria-pressed`: 上の「選択中」と同じ値(手で直す間も印の有無ではなく「読んでいるか」を表す)
- `title`: 手で直す間は `BLOCK_OPERATION_TITLES.manualFix`(「クリックで中身を右に表示」)
- 読み上げ名(`aria-label`)は今どおり `methodChipLabel`(印があれば「「直した」印あり」が付く)
- ドラッグ・ダブルクリック(名前の変更)は変えない

### チェックボックス(`ManualFixCheck`)

- 出す条件: `manualFix !== null` かつ `manualFix.released === false`。それ以外(通常時・リリース後)は何も描かない
- 置き場所: `ClassBody` の各 `.method-chip-row` の中、`MethodChip` の**後ろ**(画面ではチップの右、Tab 順ではチップの次)
- マークアップ: `<label className="manual-fix-check nodrag nopan" title={BLOCK_OPERATION_TITLES.manualFixCheck}><input type="checkbox" checked={fixed} onChange={() => toggleFixed(method.id)} aria-label={`${クラス名}.${メソッド名}() を直した`} /></label>`
  - `nodrag nopan` で React Flow のノードドラッグ・パンに奪われないようにする。dnd-kit のドラッグ対象にはしない
  - 読み上げ例: 「OrderService.confirm() を直した、チェックボックス、チェックなし」。同じ名前のメソッドが別クラスにあっても区別できるようクラス名を含める
  - キーボード: Tab でチップの次に止まり、Space で付け外し(ブラウザ標準どおり。Enter では切り替わらない)
- 当たり判定: `label` を 24px × 24px 以上にする(誤って隣のチップを押さないため)
- `ClassBody` は `showDetails` のときだけ描かれるので、ズームアウトして詳細を隠すとチェックボックスもチップと一緒に隠れる(今のチップと同じ)

### 見た目(`index.css`)

- 手で直す間だけ、行を横並びにする(例: 行に `method-chip-row--manual-fix` を付けて `display: flex; align-items: center; gap: 4px;`、
  チップのボタンは `flex: 1; min-width: 0;`)。通常時の `.method-chip-row { display: contents; }` は変えない
- クラスノードの幅は変えない(チップが少し縮む)。`e2e/extract-preview.spec.ts` の「行数のバッジは一行で表示する」が引き続き通ること

### 案内文

- `FixInput`(`ManualFixPanel.tsx`): 「メソッドをクリックすると中身が右に出ます。直す必要があると判断したメソッドの右のチェックボックスで『直した』印を付けてください。付け終えたらリリースします」
- ツアー3つ目(`tourSteps.ts`): 「メソッドをクリックすると中身が右に出ます。直す必要があるメソッドの右のチェックボックスで「直した」印を付け、左の「リリースする」を押そう。結果を読んだら「組み替えを始める」へ。」
  (対象 `.app__body`・進め方 `manual-fix-released` は変えない)

## TDD対象

`domain` の純粋関数の追加は無い。ストアの振る舞いを `useGameStore.test.ts` の `describe('manual fix method viewer state')` に先に書く(AAA)。

### `viewManualFixMethod`(presentation / ストア)

- 手で直している最中に `viewManualFixMethod('method-a')` → `viewedMethodId` が `'method-a'`、`fixedIds` は `[]` のまま
- 同じメソッドを2回 `viewManualFixMethod` → `fixedIds` は `[]` のまま(今回の不具合の再発防止)
- `toggleFixed('method-a')` の後に `viewManualFixMethod('method-a')` → `fixedIds` は `['method-a']` のまま(読み直しで印が外れない)
- `selectMethod('method-place-order')` してから手で直し始め、`viewManualFixMethod('method-confirm-order')` → `selectedMethodId` は `'method-place-order'` のまま
- `releaseManualFix` の後に `viewManualFixMethod('method-b')` → `viewedMethodId` が `'method-b'`、`fixedIds` は変わらない
- `manualFix === null` のときの `viewManualFixMethod` → `manualFix` は `null` のまま

### `toggleFixed`(presentation / ストア)

- 既存のテスト(印が付く・外れる、`viewedMethodId` がそのメソッドになる、`restartManualFix` で `null` に戻る、`manualFix === null` で何もしない)は今どおり通る
- 既存の「`releaseManualFix` の後に `toggleFixed` すると `viewedMethodId` だけ変わる」テストは、次の2つに置き換える
  - `releaseManualFix` の後に `toggleFixed('method-b')` → `fixedIds` も `viewedMethodId` も変わらない
  - (`viewedMethodId` を変える側は上の `viewManualFixMethod` のテストで確かめる)

チップ・チェックボックスの表示と操作は E2E で確かめる。

## E2Eの更新範囲

手で直す間にチップをクリックして印を付けている箇所を、チェックボックスに置き換える(`page.getByRole('checkbox', { name: '<クラス名>.<メソッド名>() を直した' }).check()`)。

| ファイル | 箇所 | 直し方 |
| --- | --- | --- |
| `e2e/selectStage.ts` | `releaseAllManualFixSites` の印付け(`method.click()` と、ツアー中の `aria-pressed` の確認)、「もう一度やる」後の印付け | チェックボックスを `check()`。ツアー中の確認は `toBeChecked()` に変える |
| `e2e/manual-fix.spec.ts` | 1つ目のテスト: `method-confirm` / `method-issue` のクリックで印を付けている所、`.method-chip--selected` が 0 件の確認 | チェックボックスで印を付ける。選択中の確認は「最後にクリックした1件だけ」に変える(クリックで読んでいない場合は 0 件のまま)。リリース後の `method-create` クリックで印が増えないことに加え、チェックボックスが 0 件になることを確かめる |
| `e2e/manual-fix.spec.ts` | 2つ目のテスト(キーボードで付け外し) | チップで Enter → 中身が出て印は 0 件 → Tab でチェックボックスへ → Space で印 1 件 → Space で 0 件。3か所の印付けのループもチェックボックスにする。テスト名を「印はキーボードでも付け外しでき」のまま中身を合わせる |
| `e2e/manual-fix.spec.ts` | 3つ目のテスト(読み取り専用の表示)の、`method-create` で Enter した後の `aria-pressed="true"` の確認・リリース後の `fixed-mark` の数 | `aria-pressed` は「読んでいる」の意味で今どおり `true` になる。チップのクリックだけでは印が付かないので、`fixed-mark` の数の確認は 0 件で変わらないことに直す |
| `e2e/manual-fix-clarity.spec.ts` | `method-checkout` / `method-calculateOrderTotal` / `method-getLines`、`method-placeOrder` のクリック | チェックボックスに置き換える |
| `e2e/change-impact-review.spec.ts` | `reachImpactReview` の `method-printMonthlyReport` / `method-aggregateSales`、100点後の `method-aggregateSales` のクリック | 同上 |
| `e2e/change-pain.spec.ts` | 「冒頭の手直し結果に読み行数を示し…」の `method-printMonthlyReport` のクリック | 同上 |
| `e2e/stage-flow.spec.ts` | 仕上げの手直しの `method-placeOrder` のクリック | 同上 |
| `e2e/first-visit-tour.spec.ts` | 3/6 の `markedMethod.click()` と `aria-pressed` の確認、2つ目のテストの `method.click()`、`method-printMonthlyReport`(リリース前)・`method-aggregateSales` のクリック | 同上。`aria-pressed` の確認は `toBeChecked()` に変える。「組み替えを始める」後の `method-printMonthlyReport` のクリック(4/6 → 5/6 の選択)は変えない |
| `e2e/extract-preview.spec.ts` | 「手直し中もメソッド行数のバッジは一行で表示する」の `method.click()` | チェックボックスで印を付けてから、`fixed-mark` が見え、行数のバッジが一行のままであることを確かめる(チェックボックスでチップが縮んでも折り返さないことの確認を兼ねる) |
| `e2e/action-affordance.spec.ts` | 手で直す間の `method-confirm` の `title` の確認 | 「クリックで中身を右に表示」に変え、チェックボックスの `label` の `title` が「チェックで「直した」印を付け外し」であることを足す |

新しく足すテスト(`e2e/manual-fix.spec.ts`):

- 中級9で「実際に直してみる」→ `method-create` を2回クリック → `fixed-mark` は 0 件、右サイドバーに `QuoteService.create()` が出ている、
  `method-create` が `aria-pressed="true"`・`.method-chip--selected` →
  `QuoteService.create() を直した` のチェックボックスを `check()` → `fixed-mark` 1 件、「直した印: 1 個」 →
  もう一度 `method-create` をクリック → 印は 1 件のまま

上の表にないファイル(`next-stage-after-clear`・`sidebar-flow-visibility`・`toast-clears-when-stale`・`canvas-refit-on-resize`・
`extract-lines-and-editor-rail`・`button-style`・`sidebar-structure` など)は、手で直す間にチップで印を付けていないか、
`releaseAllManualFixSites` 経由なので、ヘルパーを直せば変更は要らない。実装者は `grep -n "getByTestId('method-" e2e` で
「実際に直してみる」の後・「リリースする」の前にあるクリックを洗い出し、漏れがないか確かめる。

## 受け入れ基準

1. 中級9で「実際に直してみる」を押し、`QuoteService.create()` のチップを2回クリックしても、チップに「✔ 直した」は付かず、パネルは「直した印: 0 個」のまま。右サイドバーには `QuoteService.create()` の処理の一覧が出て、そのチップが選択中の見た目になる
2. 同じ状態で、`create()` の右のチェックボックスを押すと「✔ 直した」が付き「直した印: 1 個」になる。もう一度押すと外れる。その後チップを何度クリックしても印は変わらない
3. `confirm()`・`issue()`・`create()` の3つのチェックボックスに印を付けてリリースすると「✅ 直し忘れなし。3 か所すべてを直せました」になる。リリース後はチェックボックスが消え、チップをクリックすると中身は読めるが印は変わらない
4. キーボードだけで操作できる: チップにフォーカスして Enter(または Space)で右に中身が出て印は付かない。Tab で隣のチェックボックスへ移り、Space で印が付く・外れる
5. スクリーンリーダー(またはアクセシビリティツリー)で、チェックボックスが「OrderService.confirm() を直した」という名前と、チェック状態で読まれる。チップは読んでいる1件だけが押された状態(`aria-pressed="true"`)になる
6. 通常時(手で直していないとき)はチェックボックスが出ず、チップのクリック・ドラッグ・ダブルクリックの動きは変わらない
7. 初回ツアーの3/6で、チェックボックスで `printMonthlyReport()` に印を付けて「リリースする」→「組み替えを始める」で4/6へ進む。ツアーの文言にチェックボックスのことが書かれている
8. チュートリアル1の手直し中も、`printMonthlyReport()` の行数のバッジは一行で表示される
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 右サイドバー(`ManualFixMethodViewer`)からの印の付け外し(印はキャンバスのチェックボックスだけで付ける。`manual-fix-method-viewer` のスコープ外を引き継ぐ)
- 印の一括操作(すべて外す、など)。「もう一度やる」で足りる
- 手で直している間のチップのキーボードドラッグの扱いの変更(今どおり Enter/Space はクリックとして扱う)
- 幅 700px 以下の画面での右サイドバー(処理一覧)の出し方の見直し。印はキャンバス上で付けられるので、この仕様では扱わない
- 採点(`checkManualFix`)・結果の文言(`describeManualFix`、`manual-fix-clarity`)・冒頭/仕上げの手直しの流れ(`post-perfect-flow`)の変更
- 変更依頼に挑戦中(`changeSession`)のチップの動き
