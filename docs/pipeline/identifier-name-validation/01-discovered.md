# 01 機能探索: クラス名・メソッド名・ファイルのパスを「識別子として書ける名前」に限る

- slug: `identifier-name-validation`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

## 背景・目的

プレイヤーは名前を5つの経路で入力する。Extract Method の新しいメソッド名、Merge Methods の統合後の名前、
名前の変更(ファイル・クラス・メソッドのダブルクリック編集)、右クリックメニューからのクラス追加・ファイル追加である。
どの経路も、弾くのは**空欄と重複だけ**になっている。

- `src/domain/codebase/naming.ts` の `validateClassName`・`validateFilePath`: 前後の空白を除いたあと、空と重複だけを弾く
- メソッド名には共通の検証関数が無い。`extractMethod.ts`(36〜37行目)・`mergeMethods.ts`(56〜57行目)・`renameMethod.ts`(13〜14行目)が
  同じ「空・同じクラス内で重複」のチェックをそれぞれ書いている(3か所に同じ処理がある)

そのため、次のような名前がそのまま通り、キャンバス・採点・AI講評にそのまま出る。

- 空白や記号が入った名前: `calc tax`、`Order-Service`、`save()`、`1stStep`
- クラス名とメソッド名の書き方の取り違え: クラス `orderValidator`、メソッド `CalculateTax`
- 拡張子やディレクトリの形が崩れたパス: `src//Tax`、`Tax.ts/`、`../x.ts`
- 長さに上限が無い(`maxLength` はリポジトリに無い)。1000文字の名前でもノードの幅が伸びるだけで通る。
  `critique-worker-hardening` の01(24行目)も、この「長さの上限が無い名前がAI講評のプロンプトに入る」ことを指摘している

対象プレイヤー(新卒〜4年目)にとって、名前の付け方(クラスは名詞でPascalCase、メソッドは動詞で始まるcamelCase)は
メソッド分け・クラス分けと切り離せない基本である。ゲームの題材・模範解答・名前候補(`suggestMethodName.ts`)・E2E はすでに
すべてこの書き方に沿っており(grepで確認。例外はプレイヤーが名前を変えられない白紙設計の部品置き場 `部品置き場` だけ)、
**プレイヤーが入力した名前だけが規則の外に出られる**状態になっている。
入力の時点で「TypeScriptの識別子として書けない名前」をやさしい文言で弾けば、学習の土台がそろい、表示崩れやAI講評への長い文字列の流入も
元から断てる。CLAUDE.md の ponytail 方針の「手を抜かないもの: 信頼境界での入力検証」にも当たる(ここでの信頼境界はプレイヤーの入力欄)。

### 既存テーマとの重複確認

- `docs/specs/inline-edit-and-hover-submenu.md`: 名前の変更を足した仕様。検証は「空欄・重複(メソッドは所属クラス内のみ)」と決めており、
  書き方・長さの規則は扱っていない。今回はその検証を広げる位置付けで、重複しない
- `critique-worker-hardening`(02作成中): Workers側で受け取った文字列の長さを詰め直す。今回はアプリ側の入力の時点の話で、
  両方そろえば二重の守りになる(どちらか片方だけでも成り立つ)。`workers/critique/` は触らない
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 16件に、名前の書き方・長さの検証を主題にしたものは無い
  (`命名規則`・`識別子`・`camelCase`・`PascalCase` でgrep。`implement-change-request.md` に題材の `partName` を
  「動詞で始まるcamelCaseにする」という題材データ側の約束があるだけ)
- 過去に見送られた「フィールドの名前の変更(Rename Field)」は新しい操作の追加で、今回とは別物(今回は既存の5経路の検証だけ)

### 検討して見送った候補

- **名前の付け方を採点する(「動詞で始まらないメソッド名」を減点など)**: `score.ts`・`RULE_LABEL`・`fileScores.ts` が複数件から触られる予定で、
  呼び出し元の「これ以上大きく手を入れない」に当たる。まず入力で弾くのが先で、採点は要望が出てから(YAGNI)
- **dnd-kit の `KeyboardSensor` でメソッドをキーボードだけで移す**: `CodebaseCanvas.tsx` のセンサー設定を触る。右クリックメニューからの移動
  (`move-via-context-menu`)でキーボード操作の代わりはすでにある
- **VSCode風のファイルツリー(CLAUDE.md の「予定」)**: `App.tsx`・`CodebaseCanvas.tsx` の `DndContext` をまたぐ規模で、1回のPRには大きい
- **AI講評の文章を段落・箇条書きで表示する**: `CritiquePanel.tsx` は `critique-request-robustness` が触る予定
- **ステージ選択での自己ベスト点・次のステージへ/新ステージ(デメテルの法則など)**: 過去の探索と同じ理由(`StagePanel.tsx` の競合、`sampleAnswer.ts` への模範解答の追加が必須)

## 関連する既存コード

- `src/domain/codebase/naming.ts` — `validateClassName`・`validateFilePath`・`ClassNameError`・`FilePathError`。主な変更先
  (メソッド名の検証を置くならここが自然)
- `src/domain/codebase/extractMethod.ts`・`mergeMethods.ts`・`renameMethod.ts` — メソッド名の「空・重複」チェックがそれぞれ直書き。
  共通の検証に寄せるかどうかは仕様設計で決める
- `src/domain/codebase/addClass.ts`・`renameClass.ts`・`addFile.ts`・`renameFile.ts` — `naming.ts` を呼んでいる側。エラー型が広がるだけで本体の変更は小さい見込み
- `src/domain/codebase/*.test.ts` — 上記それぞれに「空白だけ」「重複」の `it.each` の表があり、行を足す形でテストを先に書ける
  (`renameClass.test.ts` 43〜44行目、`renameFile.test.ts` 42〜43行目、`addClass.test.ts`・`addFile.test.ts`・`extractMethod.test.ts` 93〜94行目・
  `mergeMethods.test.ts` 182〜183行目・`renameMethod.test.ts` 77行目)
- `src/application/RefactorUseCases.ts` 193〜251行目 — エラーごとの文言の `Record`。エラー型を足すと型チェックで文言の追加漏れが分かる。
  `RefactorUseCases.test.ts` 423〜438行目に文言の網羅テストがある
- `src/presentation/store/useGameStore.ts` — `apply(result, describeXError)` で文言を `message` に出すだけ。エラー型が増えても**変更は不要な見込み**
- `src/presentation/canvas/useInlineEdit.ts` — 確定に失敗したら入力欄に留まる。今回もこの挙動のまま使える
- `src/domain/codebase/suggestMethodName.ts` — 抽出時の名前候補。処理を多く選ぶと `validateItemsAndCheckStockAndReserve...` のように長くなるので、
  長さの上限はこの候補を弾かない値にする必要がある
- `src/domain/stage/sampleAnswer.ts`・`src/infrastructure/stages/*.ts`・`blankDesigns/blankDesignProblems.ts` — 模範解答・題材の名前。読むだけ。
  `stageCatalog.test.ts` が模範解答を実際に適用しているので、規則が題材と食い違えばテストで分かる
- `src/domain/blank/tray.ts` — 部品置き場(`部品置き場` という日本語のクラス名・パス)。プレイヤーは名前を変えられないが、規則の例外として意識しておく
- `e2e/refactor.spec.ts` — 名前の入力を扱う既存E2E(`fill('calculateTax')`・`fill('src/tax/TaxPolicy.ts')` など。すべて規則に沿った名前)

## スコープの見立て

小さい。1回のPRに十分収まる。domain(検証関数とそのテスト)+ application(文言)が中心で、presentation は変更なし〜数行の見込み。

1. **必須**: クラス名・メソッド名・ファイルのパスに、書き方の規則と長さの上限を足す(追加・名前の変更・抽出・統合のすべての経路で同じ規則)。
   テストを先に書く(既存の `it.each` の表に行を足す)
2. **必須**: 新しいエラーごとに、何がいけないか・どう直せばよいかが分かる文言を `RefactorUseCases.ts` に足す
3. **任意**: 入力欄に `maxLength` を付ける、E2Eで「不正な名前は弾かれて入力欄に留まる」を1本守る(膨らむなら後回し)

仕様設計者に委ねる論点(ここでは決めない):

- 書き方の規則をどこまで厳しくするか。例えば「識別子として書ける(英字か `_`・`$` で始まり英数字と `_`・`$` だけ)」までに留めるか、
  「クラスは大文字始まり・メソッドは小文字始まり」まで求めるか。日本語など非ASCIIの識別子(TypeScriptでは書ける)を許すか
- 予約語(`class`・`new`・`delete` など)を弾くか(ponytail的には弾かなくても実害は小さい)
- ファイルのパスの規則(`/` 区切り・空の区間や `..` を弾く・拡張子 `.ts` を必須にするか)。題材のパスの形(`src/...ts`)と合わせる
- 長さの上限の値(`suggestMethodName` の候補と題材の最長の名前を弾かない値)
- メソッド名の検証を `naming.ts` に共通化して3か所の直書きを寄せるか(寄せると `mergeMethods.ts` にも差分が出る。下の衝突を参照)
- 規則に合わないときに弾くだけか、直した候補(例: `calc tax` → `calcTax`)を文言で示すか(示すなら短く)
- 不正な名前の検出を1つのエラー(例: 「書き方が正しくない」)にまとめるか、原因ごとに分けるか

### 既存パイプラインとの衝突の可能性

- **`src/domain/codebase/mergeMethods.ts`**: `template-method-stage` の02が「呼び出し行だけの骨組み同士を統合できるようにする」変更を予定している。
  本件で触るのは名前の検証の2行(56〜57行目)付近だけで、形の比較(`shape-mismatch`)の処理とは離れているため、テキスト上の競合は小さい。
  メソッド名の検証を共通化しない案を採れば、`mergeMethods.ts` の差分は数行に収まる
- `src/domain/codebase/extractMethod.ts`: `inline-method-stage` の02は「変更しない」と明記。`method-call-references` は読むだけ。競合は無い見込み
- `src/application/RefactorUseCases.ts`・`.test.ts`: 16件のパイプラインのうち、これを変更すると書いているものは見当たらない(`docs/pipeline/` をgrepして該当なし)
- `src/domain/codebase/naming.ts`・`renameMethod.ts`・`renameClass.ts`・`renameFile.ts`・`addClass.ts`・`addFile.ts`: 他のパイプラインからの変更予定は見当たらない
- 意味上の依存: `template-method-stage`・`inline-method-stage`・`utils-class-split-stage` などが追加する題材・模範解答の名前が新しい規則に合わない場合、
  後からマージした側で `stageCatalog.test.ts`(模範解答の適用)が落ちる。題材は既存の書き方に沿っている見込みなので、影響は小さい
- `critique-worker-hardening` とは意味上補い合う関係(アプリ側で長さを制限すれば、Workers側の上限を超えにくくなる)。ファイルの競合は無い
- `score.ts`・`RULE_LABEL`・`fileScores.ts`・`sampleAnswer.ts`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`CodebaseCanvas.tsx`・`useGameStore.ts`・
  `layoutCodebase.ts`・`index.css`・`workers/critique/` には触らない想定(入力欄の `maxLength` を足す任意項目を採る場合のみ、
  `CanvasContextMenu.tsx`・`MethodEditor.tsx` の `<input>` に属性を1つずつ足す差分が出る。その場合は後回しを推奨)
