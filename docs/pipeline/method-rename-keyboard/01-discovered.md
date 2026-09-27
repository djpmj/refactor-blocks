# 01 機能探索: メソッド名の変更をキーボードだけで始められるようにする(F2)

- slug: `method-rename-keyboard`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

既存仕様書 `docs/specs/inline-edit-and-hover-submenu.md` の「スコープ外」で、明示的に先送りされていたもの:

> メソッド名のその場編集をキーボードだけで開始する手段(ダブルクリックのみ。右クリックメニューに
> 「メソッドの名前を変更」は元々ないため、キーボード操作での代替経路は今回作らない)

過去の探索 `docs/pipeline/method-call-references/01-discovered.md` でも候補に挙がったが、「右クリックメニュー(`CanvasContextMenu.tsx`)に
項目を足すのが自然だが、`move-class-via-context-menu` が同じ `menuItemsFor` を書き換える予定で衝突が大きい」として見送られている。
今回は**右クリックメニューを使わない経路**(フォーカス中のメソッドチップで F2)に絞ることで、その衝突を避ける。

## 背景・目的

名前の変更の入口を、操作ごとに「マウス」と「キーボード」で並べると、メソッドだけが穴になっている。

| 対象 | マウス | キーボードだけ |
| --- | --- | --- |
| ファイルのパス | ダブルクリック(`InlineEditableLabel`) | Shift+F10 → 「ファイルの名前を変更」フォーム(`CanvasContextMenu.tsx` の `renameFile`) |
| クラス名 | ダブルクリック(`InlineEditableLabel`) | Shift+F10 → 「クラスの名前を変更」フォーム(`renameClass`) |
| **メソッド名** | ダブルクリック(`MethodChip.tsx` の `onDoubleClick` → `startEditing`) | **無し**(右クリックメニューに項目が無く、チップにキー操作も無い) |

- メソッドチップは `<button>` なので Tab でフォーカスでき、Shift+F10 で「別のクラスへ移動」のメニューも開ける
  (`move-via-context-menu` で対応済み)。移動・抽出・統合・可視性の変更はキーボードだけでできるのに、**名前の変更だけができない**。
- CLAUDE.md の ponytail 方針で「手を抜かないもの」に**アクセシビリティ(キーボード操作を含む)**が明記されている。
  実装済みの主要操作のうち、キーボードで一切届かないものが残っている状態。
- 対象プレイヤー(新卒〜4年目)にとって、メソッド名を付け直すことは Extract Method・Merge Methods・Move Method のあとの
  自然な仕上げ(抽出時の候補名 `suggestMethodName` が長すぎる、移した先の文脈に合わない等)で、
  「分けたら名前で意図を示す」はメソッド分けの学びの一部である。
- F2 は VSCode など主要IDEの「名前の変更」の標準キーで、実務の習慣とも一致する。dnd-kit の `KeyboardSensor` が使うキー
  (Space / Enter で掴む・置く、Escape で取り消し)とも重ならない。
- ponytail の階段では「このリポジトリにもうあるか?」で止まる: その場編集の状態管理(`useInlineEdit`)・確定の失敗時に入力欄に留まる挙動・
  ストアの `renameMethod` はすべて既にあり、足すのは「キーで `startEditing()` を呼ぶ入口」と、キーボード利用者のための
  「確定・取り消し後にフォーカスをチップへ戻す」だけの見込み。新しいドメイン操作・依存は要らない。

### 既存テーマとの重複確認

- `docs/specs/inline-edit-and-hover-submenu.md`: ダブルクリックでのその場編集を足した仕様。キーボードでの開始はスコープ外として先送り → 今回はその続き
- `move-via-context-menu`(完了)・`move-class-via-context-menu`(進行中): 右クリックメニューに**移動**の項目を足す。名前の変更は扱わない。
  今回は右クリックメニューを触らない
- `identifier-name-validation`(02作成済み): 名前の**中身**(書き方・長さ)の検証。入力を**始める手段**は扱わない。
  `useInlineEdit` の「失敗したら入力欄に留まる」挙動をそのまま使うと明記しており、今回もその挙動に乗る(補い合う関係)
- `operation-guide`(01のみ): 既存の操作を一覧で見せるガイド。操作そのものは作らない。今回の F2 はガイドに載せる操作が1つ増える関係(下記の衝突を参照)
- `color-contrast-a11y`: 配色と行数オーバーの印(`MethodChipView`)。キー操作は扱わない
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 19件に、F2 やキーボードでの名前の変更を主題にしたものは無い
  (`F2`・`キーボードだけで…名前` で `docs/` をgrepして該当なし)

### 検討して見送った候補

- **フィールドを余白へ落として新しいクラスを作る(`moveFieldToNewClass`)**: `fields-and-feature-envy.md`・`cohesion-value-object-anemic.md` の
  スコープ外に残り、`CodebaseCanvas.tsx` にも ponytail コメントがある。ただし `moveToNewHome.ts`(`identifier-name-validation` が触る可能性)・
  `RefactorUseCases.ts`(同)・`useGameStore.ts`(`stage-draft-persistence`・`critique-request-robustness`)・`CodebaseCanvas.tsx`
  (`class-dependency-focus`)と、進行中の件が触る4ファイルに同時に差分が出る。また中級8では「メソッドを余白へ落として新しいクラスを作る →
  フィールドを移す」で代わりが効くため、困りごとの切実さは今回の件より低い。進行中の件が落ち着いてからの候補
- **上級3(Strategy)に `extend` の変更依頼(「ゴールド会員を追加して」)を足す**: `implement-change-request.md` のスコープ外。ただし
  上級3の模範解答は `DiscountService` が3つの具象クラスを直接呼ぶ形で、`DiscountStrategy` が呼ばれていないため、新クラスを足すと
  `unwired` になる。ステージの設計そのものの見直しが要り、`advancedStages.ts`(`template-method-stage`・`duplicate-code-scoring`)とも重なる
- **`measurePlacement` の「呼ばれていない既存クラスに置く抜け道」**(ponytail コメント): `extend` の依頼が上級2の1件しか無く実害が小さい。
  `template-method-stage` が同じファイルを変更予定
- **メソッドエディタに「名前を変更」欄を置く**: キーボードで届くが、`MethodEditor.tsx` は `method-call-references` が変更予定。
  F2 のほうが IDE の習慣に合い、ファイルの衝突も無い
- **クラスのヘッダー・ファイルのパスでも F2 で名前の変更を始める**: 揃うと分かりやすいが、どちらも Shift+F10 のフォームでキーボードから届くため
  穴ではない。`ClassNode.tsx` は `class-dependency-focus`・`template-method-stage` が触る可能性がある。今回に含めるかは仕様設計者の論点にする

## 関連する既存コード

- `src/presentation/canvas/MethodChip.tsx` — **主な変更先**。`MethodChip`(`<button>`、`onDoubleClick` → `startEditing()`)。
  `{...attributes}` `{...listeners}` を最後に展開しているので、dnd-kit の `listeners.onKeyDown`(`KeyboardSensor` の起動)が
  後から書いた `onKeyDown` を上書きする。F2 の処理は dnd-kit のハンドラと**合成**する必要がある。
  編集中はボタンごと `<div>` + `<input>` に差し替わる(`ref={setNodeRef}` はボタン側だけ)ので、確定・取り消しでボタンに戻ったときに
  フォーカスが `body` へ落ちる。キーボードで始めた場合はチップへ戻す必要がある
- `src/presentation/canvas/useInlineEdit.ts` — その場編集の共通の状態管理(Enter で blur → 確定、Escape で取り消し、失敗時は入力欄に留まる)。
  「編集が終わったこと」を呼び出し側が知る手段は今は無い(`editing` の変化を見るか、コールバックを足すかは仕様設計で決める)
- `src/presentation/canvas/InlineEditableLabel.tsx` / `ClassNode.tsx` / `FileNode.tsx` — クラス名・ファイルのパスのその場編集(参照のみの見込み)
- `src/presentation/canvas/CanvasContextMenu.tsx` — `menuItemsFor`(「クラスの名前を変更」「ファイルの名前を変更」のフォーム)。**今回は変更しない**
- `src/presentation/store/useGameStore.ts` — `renameMethod(methodId, newName): boolean`(既存。変更不要の見込み)
- `src/domain/codebase/renameMethod.ts` — ドメインの名前の変更(変更不要)
- `src/presentation/blank/BlankDesignView.tsx` — 白紙設計も同じ `MethodChip` を使うので、F2 はそちらでも効くことになる
  (ダブルクリックでの名前の変更が既に白紙設計でも効いているのと同じ扱い)
- `e2e/refactor.spec.ts` 461〜505行目付近(ダブルクリックでの名前の変更のE2E)、1479行目付近(`chip.press('Shift+F10')` でキーボードだけで移動するE2E)
  — 書き方の前例。今回のE2Eは「Tab でチップにフォーカス → F2 → 入力 → Enter で名前が変わり、フォーカスがチップに戻る」「Escape で元に戻る」の形になる見込み
- `docs/specs/inline-edit-and-hover-submenu.md` — 先送りの経緯と、その場編集の仕様

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の1〜2ファイルとE2Eだけで、domain / application / infrastructure / ストアは変更しない見込み
(表示・入力の変更なのでユニットテストの対象外。プレイヤーの操作なので CLAUDE.md の方針どおりE2Eで守る)。

1. **今回やる**: キャンバスのメソッドチップにフォーカスして F2 を押すと、ダブルクリックと同じその場編集が始まる。
   Enter / Escape で編集が終わったら、フォーカスをそのチップへ戻す。E2E を足す
2. **後回し**:
   - クラスのヘッダー・ファイルのパスでも F2 で始められるようにする(Shift+F10 のフォームで代わりが効くので、揃えたい要望が出てから)
   - 右クリックメニューに「メソッドの名前を変更」を足す(`move-class-via-context-menu` のマージ後)
   - 操作ガイド(`operation-guide`)への記載(どちらが先にマージされるかによる。下記)

仕様設計者に決めてほしい論点(ここでは決めない):

- 開始キー: F2 だけか、Enter も使うか(Enter は dnd-kit の `KeyboardSensor` が「掴む」に使うので、F2 だけが安全という見立て)
- dnd-kit の `listeners.onKeyDown` との合成のしかた(F2 のときだけ横取りし、それ以外は dnd-kit へ渡す)。キーボードでドラッグ中(掴んでいる間)の F2 の扱い
- 編集後のフォーカス復帰の方法: `useInlineEdit` に「編集が終わった」ことを知らせる口を足すか、`MethodChip` 側で `editing` の変化を見て戻すか。
  ダブルクリックで始めた場合にも戻すか(マウス利用者には害が無いので揃えてよい、という見立て)。確定に失敗して入力欄に留まる間は戻さない
- 失敗時(空欄・重複・`identifier-name-validation` 後は書き方の違反)の文言は今どおり `state.message` に出るが、キーボード利用者が
  入力欄にいながら理由に気づけるか(`role="alert"` のメッセージが読み上げられるかの確認程度)
- 操作があることをどう知らせるか: チップの `title`/`aria-keyshortcuts="F2"` を付けるか、何も付けず操作ガイドに任せるか
- 変更依頼の実装中(部品置き場の部品を含む)・白紙設計でも F2 を効かせるか(ダブルクリックが効いているので揃えるのが自然という見立て)

### 既存パイプラインとの衝突可能性

- **`src/presentation/canvas/MethodChip.tsx`**: `color-contrast-a11y` の02が `MethodChipView`(ファイル前半の見た目だけの関数)に行数オーバーの印を足す予定。
  `identifier-name-validation` の02は未決10で選択肢Bの場合のみ、編集中の `<input>`(`MethodChip` の `if (editing)` の中)に `maxLength` を1つ足す。
  本件の差分は `MethodChip` の `<button>` の属性(キー操作)とフォーカス復帰で、どちらとも行が離れている。テキスト上の競合は小さい。
  `quiz-change-site-marks` の02は `MethodChip.tsx` を「変更しない」と明記
- **`src/presentation/canvas/useInlineEdit.ts`**: フォーカス復帰のためにコールバックを足す案を採る場合のみ触る。`identifier-name-validation` の02は
  「`useInlineEdit.ts` は触らない」と明記しており、他の19件も変更予定なし。競合なし
- **`src/presentation/canvas/CanvasContextMenu.tsx`・`ClassNode.tsx`・`FileNode.tsx`・`InlineEditableLabel.tsx`**: 触らない想定
  (クラス・ファイルの F2 を今回に含める場合のみ `ClassNode.tsx`/`FileNode.tsx`/`InlineEditableLabel.tsx` に差分が出る。その場合は
  `class-dependency-focus`・`template-method-stage` との軽い競合があり得るので、後回しを推奨)
- **`e2e/refactor.spec.ts`**: 多くのパイプラインが追記する。追記位置の競合はあり得る(小さい)。新しい spec ファイルに分ければ競合なし(置き場所は仕様設計で決める)
- **意味上の依存**: `operation-guide` がキーボードでの代わりの操作を一覧に載せる予定。本件が先にマージされれば、ガイド側で「F2 でメソッド名を変更」を1行足す。
  ガイドが先なら、本件で1行足す。どちらでもファイルの衝突ではなく記述の追従で済む
- `score.ts`・`fileScores.ts`・`sampleAnswer.ts`・ステージ定義(`src/infrastructure/stages/*.ts`)・`useGameStore.ts`・`CodebaseCanvas.tsx`・`MethodEditor.tsx`・
  `RefactorUseCases.ts`・`naming.ts`・`index.css`・`workers/critique/`・domain 層には触らない想定
