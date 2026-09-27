# 01 機能探索: キーボードだけでメソッドを選んで、メソッドエディタを開けるようにする

- slug: `method-select-keyboard`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

CLAUDE.md の「手を抜かないもの: … アクセシビリティ(キーボード操作を含む)」に当たる穴。
`operation-guide` の02が、ガイドを書くために確かめる項目として**「メソッドのチップにフォーカスして Enter/Space で選択(メソッドエディタに出る)できるか。
dnd-kit の `KeyboardSensor` が Space/Enter をドラッグ開始として先に取る可能性があり、効かない見込みが高い」**と挙げ(108〜109行目)、
スコープ外に「キーボードでメソッドを選べない…などが分かっても直さない。PRの説明に書くだけ」(149行目)と書いたまま、
**直す側のパイプラインがどこにも無い**。本件はそれを独立した1件として拾う。

### 既存テーマとの重複確認

- `method-rename-keyboard`: チップ上の **F2 で名前の変更**を始める。メソッドを**選ぶ**(メソッドエディタを開く)ことは扱わない。
  02 は `MethodChip.tsx` の `<button>` に `onKeyDownCapture`(F2)を足し、`CodebaseCanvas.tsx` のセンサー設定は「変更しない」と明記している
- `operation-guide`: 操作の**一覧**を見せるだけで、既存操作は直さない(上記)。本件が入れば、ガイドの「メソッドの中を見る・抽出する」行のキーボード列を埋められる
- `drag-announcements-ja`・`flow-aria-labels-ja`: 読み上げ・ボタン名の**日本語化**。キー操作そのものは変えない
- `move-via-context-menu`(実装済み)・`move-class-via-context-menu`: 右クリックメニューからの**移動**。メニューに「開く」項目は無い
- `method-call-references`: メソッドエディタに呼ぶ先・呼び出し元を**表示**する。02の未決事項4の選択肢B(呼び出し元を押すと `selectMethod`)は
  「表示は文字だけ」を推奨しており、メソッドを選ぶ入口にはならない見込み
- `score-deduction-locations`: 02の後回し欄に「内訳の名前を押してメソッドエディタを開く」がある(未着手)
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 27件を `selectMethod|キーボード|メソッドエディタを開|選べない` でgrepし、
  キーボードでメソッドを選ぶことを主題にしたものは無い。`docs/specs/blank-design-mode.md` 309行目・`implement-change-request.md` 499行目は
  「キャンバス操作のキーボード対応は別タスクで全モードまとめて直す」と先送りしている。`cohesion-value-object-anemic.md` 572行目のE2Eも
  「`debit` を**クリック** → 可視性の select をキーボードで」と、選ぶところはマウスのまま
- 呼び出し元が列挙した27件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **新ステージ(Middle Man を外す・Push Down Method / 継承より委譲・Observer・Decorator など)**: 過去の探索と同じ理由。ステージ追加が4件並走
  (`template-method-stage`・`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`)し、`sampleAnswer.ts`・`stageCatalog.test.ts`・
  ステージ定義への同時追記が増える。Push Down / 継承より委譲は新しい採点ルールが要り、`score.ts` は `duplicate-code-scoring`・`inline-method-stage` が追記予定
- **元に戻す/やり直しのボタンに「何を戻すか」(例: 「元に戻す: calculateTax を TaxCalculator へ移す」)を出す**: 学びにもなるが、履歴に操作の説明を積む必要があり
  `history.ts`(`stage-draft-persistence` が履歴を保存の対象として読む)・`useGameStore.ts`(`commit` を通る全操作)・`StagePanel.tsx`・`BlankDesignPanel.tsx` に差分が広がる
- **設計くらべの正解済みを保存して選択欄に ✅ を付ける**: `ComparisonQuizView.tsx` は `quiz-change-site-marks`・`data-placement-quizzes` が触る
- **変更依頼パネルのエラーメッセージに `role="alert"` が無い(`ChangeRequestPanel.tsx` 186行目。`MethodEditor.tsx` 264行目は付いている)**: 1属性の差で、単独の1件にするには小さすぎる。
  本件か別件のついでに直す候補として仕様設計者に委ねる(本件では触らない想定)
- **Rename Field・フィールドの可視性の変更**: `docs/specs/fields-and-feature-envy.md`・`cohesion-value-object-anemic.md` が意図して作らないと決めている
- **フィールドを余白へ落として新しいクラスを作る**: `drag-announcements-ja` の02が「余白に置いても移動しません」の読み上げを決めており、今やると意味上の衝突になる(`flow-aria-labels-ja` の01と同じ判断)

## 背景・目的

- このゲームの中心の操作である **Extract Method**(処理を選んで抽出)と、可視性の変更・呼び出し元へ戻す(Inline)・統合(Merge)・空実装の削除は、
  すべて**メソッドエディタ**(`MethodEditor.tsx`)から行う。メソッドエディタは `selectedMethodId` が入ったときだけ中身を出し、
  それを入れる入口は**メソッドのチップのクリック**(`MethodChip.tsx` の `onClick` → `selectMethod`)しか無い
- チップは `<button>` だが、同じ要素に dnd-kit の `listeners`(`KeyboardSensor` の `onKeyDown`)を展開している。dnd-kit の `KeyboardSensor` は
  既定で Space/Enter を「掴む」に使い、`keydown` で `preventDefault()` してドラッグを始める(記憶ベース。node_modules 未インストールのため実物は要確認)。
  そのため **Tab でチップにフォーカスして Enter を押しても、クリック(選択)にならずドラッグが始まる**見込みが高い。
  既存E2Eにもキーボードでメソッドを選ぶテストは無い(`e2e/` を `press('Enter'|'Space')` でgrepして確認。メソッドの選択はすべて `.click()`)
- 結果として、キーボードだけのプレイヤーは**チュートリアル1の最初の課題(長いメソッドを分ける)から先に進めない**。移動(Shift+F10)・名前の変更(F2、進行中)・
  取り消し(Ctrl+Z)はキーボードで届くのに、いちばん基本の操作の入口だけが欠けている
- 付随して、ズーム倍率が 60% 未満だとメソッドのチップ自体が隠れる(`semanticZoom.ts`)ので、上級の大きいコードベースを全体表示にしているときは
  マウスでもメソッドを選べない。キャンバスの座標に依らない選び方があれば、こちらも解ける

ponytail の階段では「ブラウザの標準機能でできるか?」で止まる見込み: たとえばメソッドエディタに、ネイティブの `<select>`(クラスごとの `<optgroup>`)で
「メソッドを選ぶ」欄を置けば、キーボード操作・読み上げはブラウザ標準で揃い、dnd-kit の `KeyboardSensor` の既定キーも React Flow のキー操作も変えずに済む。
ストアの `selectMethod` はそのまま使える。新しい依存・domain・application・ストアの変更は要らない見込み。
ただし入口の置き方には他の選択肢もあり、どれを採るかは仕様設計で決める(下の論点)。

## 関連する既存コード

- `src/presentation/editor/MethodEditor.tsx` 250〜270行目 — `MethodEditor`(未選択なら「メソッドをクリックすると…」の案内、選択中なら `MethodEditorBody`)。
  **変更先の第一候補**。`method-call-references` が触るのは `MethodEditorBody`・`FragmentFieldRefs`(と新しい呼び出し元の欄)で、こことは離れている
- `src/presentation/canvas/MethodChip.tsx` 85〜93行目 — クリックでの選択と、dnd-kit の `attributes`・`listeners` の展開(**読むだけ**の想定。下の選択肢C/Dを採る場合のみ変更)
- `src/presentation/canvas/CodebaseCanvas.tsx` 133行目 — `useSensor(KeyboardSensor)`(既定のキー)。**読むだけ**の想定(下の選択肢Bを採る場合のみ変更)
- `src/presentation/store/useGameStore.ts` — `selectMethod`・`selectedMethodId`(**読むだけ**。ストアの変更は要らない見込み)
- `src/domain/codebase/Codebase.ts` — `allClasses`・`findMethod`・`findClassOfMethod`(一覧の組み立てに使う。**読むだけ**)
- `src/presentation/stage/StagePanel.tsx` 18〜48行目 `StageSelect`・`src/presentation/quiz/ComparisonQuizView.tsx` 128〜141行目 — ネイティブ `<select>` + `<optgroup>` で
  選ばせる既存の前例(**読むだけ**)
- `src/presentation/canvas/semanticZoom.ts` — 60% 未満でメソッドを隠す(**読むだけ**)
- `src/presentation/blank/BlankDesignView.tsx` — 白紙設計も同じ `MethodEditor` を使う(自動で効く。**読むだけ**)。変更依頼の実装中は `ChangeRequestPanel` に差し替わるので対象外
- `docs/pipeline/operation-guide/02-draft-spec.md` 79行目(「メソッドの中を見る・抽出する」の行)・108〜109行目・149行目 — 本件が埋める穴の記述
- `docs/pipeline/method-rename-keyboard/02-draft-spec.md` 51〜63行目 — `MethodChip` の `onKeyDownCapture` と dnd-kit の `listeners` の関係の整理(選択肢Dを採る場合の前提)

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の1ファイル(`MethodEditor.tsx`)に小さなコンポーネント1つ、必要なら一覧を組み立てる純粋関数1つ(+Vitest)、
E2E 1〜2本(新しい spec ファイル)。domain / application / infrastructure・ストア・ステージデータ・採点は変更しない見込み。

1. **今回やる**:
   - キーボードだけで、メソッドを選んでメソッドエディタに出せるようにする(リファクタリング画面と白紙設計)
   - E2E: マウスを使わず(Tab・矢印キー・Enter などだけで)メソッドを選び → メソッドエディタに中身が出る → 処理にチェックして抽出まで届く、を確かめる。
     あわせて、今の「チップにフォーカスして Enter」が選択にならないことを、実装前に実機(Chromium)で確かめる(仕様の前提の確認)
2. **後回し**:
   - 変更依頼の実装中の「どのメソッドか調べる」(`inspectMethod`)のキーボード対応(今もフォーカスで効いている)
   - メソッドを選んだとき、キャンバスをそのメソッドのクラスへ寄せる(`fitView` の対象を絞る)。選択肢A(一覧から選ぶ)を採る場合にあると親切だが、
     `CodebaseCanvas.tsx` に差分が出るので、実機で「どこにあるか分からない」と分かってから
   - `score-deduction-locations`・`method-call-references` の一覧の名前から選ぶ入口(それぞれのマージ後)

仕様設計者に決めてほしい論点(ここでは決めない):

- **入口の置き方**:
  - A: メソッドエディタにネイティブの `<select>`(クラスごとの `<optgroup>`、「クラス名.メソッド名()」)を置く。ブラウザ標準で済み、他件の変更箇所と重ならない。
    上級では30件前後になるが、`<optgroup>` と型ぶん探しで選べる見立て。ズーム60%未満でも選べる
  - B: `KeyboardSensor` の開始キーを Space だけにして、Enter はボタンのクリック(選択)に戻す。チップの上で完結して自然だが、
    `drag-announcements-ja` の02が決めた説明文「スペースキーか**Enterキー**で掴みます」と**意味上の衝突**になり、`method-rename-keyboard`・`drag-announcements-ja` が
    「変更しない」とした `CodebaseCanvas.tsx` のセンサー設定に触る。フィールドのチップ・クラスの見出しの掴み方も同時に変わる
  - C: 右クリックメニュー(Shift+F10)に「メソッドエディタで開く」を足す。`CanvasContextMenu.tsx` の `menuItemsFor` は `move-class-via-context-menu` が書き換え中
  - D: チップに別のキー(例: Enter を `onKeyDownCapture` で先に拾う)を足す。`method-rename-keyboard` が同じ要素の同じ `onKeyDownCapture` に F2 を足すので、そのマージ後が前提
- **Aを採る場合の細部**: 置き場所(メソッドエディタの先頭に常に出すか、未選択のときだけか)、既定の「(選んでください)」の項目、
  変わるのは `change` イベントのたびか(矢印キーで次々に切り替わる。`StageSelect`・クイズの選択欄と同じ振る舞いでよいか)、
  白紙設計の部品置き場(`TRAY_FILE_ID` のファイル)のメソッドも並べるか、中身の無い契約メソッド(`fragments: []`)も並べるか
- **選んだあとのフォーカス**: 選択欄に残すか(Tab で処理のチェックボックスへ進める)、メソッドエディタの見出しへ移すか。読み上げで「何が開いたか」をどう伝えるか
- **一覧の組み立て**: `allClasses` の順(ファイル順 → クラスの宣言順)→ メソッドの宣言順でよいか。組み立てを presentation 層の純粋関数に切り出してテストを先に書くか、
  コンポーネント内の数行で済ませてE2Eで守るか(`layoutCodebase.ts` のように presentation 層の純粋関数を Vitest で守る前例はある)
- **E2Eの置き場所**: 新しい spec ファイル(例: `e2e/method-select-keyboard.spec.ts`)。題材は変更の予定が無いチュートリアル1・2で確かめれば、新ステージの件のマージ順に左右されない

### 既存パイプラインとの衝突可能性

選択肢Aを採る前提の見立て(B〜Dを採る場合は上の論点のとおり、衝突が大きくなる)。

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| `src/presentation/editor/MethodEditor.tsx` | `MethodEditor`(250〜270行目)に小さなコンポーネントを1つ差し込む。import 1〜2行 | `method-call-references`(`FragmentFieldRefs` に「呼ぶ:」の行、`MethodEditorBody` の見出し直下に呼び出し元の欄。`Codebase.ts` からの import が増える) | 差分の位置は数十行離れている。**`Codebase.ts` からの import 文(2〜14行目)が隣り合う・同じ行に名前が足されるテキスト上の競合はありうる(小さい。手で直せる)**。本件の追加部品を別の小さなコンポーネントにすれば、`MethodEditorBody` の「1関数60行」の枠も食わない |
| 新規 `src/presentation/editor/<名前>.ts`(+`.test.ts`)※切り出す場合のみ | 一覧を組み立てる純粋関数 | なし | なし |
| `src/index.css` | 選択欄の余白など数行(既存の `.stage-panel__select` などを流用できれば0行) | 多数(`class-dependency-focus`・`implements-arrow-style`・`color-contrast-a11y`・`stage-rules-summary`・`operation-guide`・`method-call-references` など) | 追記位置の競合はありうる(小さい)。`.method-editor` の定義の近くに置けば末尾追記の件とずれる |
| 新規 `e2e/<名前>.spec.ts` | E2E | なし | なし(`refactor.spec.ts` には追記しない) |

- **読むだけで変更しないファイル**: `MethodChip.tsx`・`CodebaseCanvas.tsx`(センサー設定を含む)・`useGameStore.ts`・`Codebase.ts`・`semanticZoom.ts`・`StagePanel.tsx`・
  `ComparisonQuizView.tsx`・`BlankDesignView.tsx`
- **触らないファイル**: `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts` を含む)・`score.ts`・
  `CanvasContextMenu.tsx`・`ClassNode.tsx`・`FieldChip.tsx`・`FileNode.tsx`・`useInlineEdit.ts`・`layoutCodebase.ts`・`ChangeRequestPanel.tsx`・`App.tsx`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `operation-guide`: ガイドの「メソッドの中を見る・抽出する」行のキーボード列が、本件のマージ後に書けるようになる(どちらが先でも、後の件で合わせる。
    ガイドは「実装時点でマージ済みの操作だけを書く」方針なので、本件が後なら本件のPRでガイドの1行を直すかを仕様設計で決める)
  - `drag-announcements-ja`: 選択肢Aなら影響なし。選択肢Bを採るなら、説明文の「Enterキーで掴みます」を直す必要がある(上の論点)
  - `method-rename-keyboard`: 選択肢Aなら影響なし。選択肢Dを採るなら、同じ `onKeyDownCapture` を共有する
  - `method-call-references`: 呼び出し元の欄をボタンにする(向こうの未決事項4の選択肢B)なら、本件と同じく「キーボードでメソッドを選ぶ」入口が増える。
    どちらも `selectMethod` を呼ぶだけなので矛盾はしない
  - `identifier-name-validation`: 選択欄にはメソッド名をそのまま出すので、あちらのマージ前後どちらでも動く
  - 新ステージ(`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`)は同じ `MethodEditor` を通るので自動で効く
