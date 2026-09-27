# 01 機能探索: 画面上部から開ける「操作ガイド」(隠れた操作とキーボードでの代わりの操作の一覧)

- slug: `operation-guide`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

## 背景・目的

リファクタリング画面の操作の多くは、**画面のどこにも書かれていない**。コードを追って、今ある操作と、それを知る手がかりの有無を並べた。

| 操作 | やり方 | 画面上の手がかり(リファクタリング画面) |
| --- | --- | --- |
| メソッドの中を見る・抽出する | メソッドをクリック → 処理を選んで抽出 | あり(`MethodEditor.tsx` の「メソッドをクリックすると…」、チュートリアル1の goal) |
| Move Method | メソッドを別クラスへドラッグ | チュートリアル2の goal だけ |
| 新しいクラス/ファイルを自動で作って移す | メソッド/クラスを**ファイルの枠外(余白)へ**ドロップ(`CodebaseCanvas.tsx` の `useDropHandler`) | **無し**(白紙設計 `BlankDesignPanel.tsx` と変更依頼 `ChangeRequestPanel.tsx` にだけ書いてある) |
| クラス・ファイルの追加、名前の変更、削除、継承元・インターフェースの設定、別クラスへ移動 | 右クリックメニュー(`CanvasContextMenu.tsx` の `menuItemsFor`) | **無し**。初級2の goal は「『クラスを追加』で受け皿を作ろう」、中級2は「『ファイルを追加』してクラスを移そう」とだけ書き、それが右クリックの中にあることは言っていない |
| 名前の変更(ファイル・クラス・メソッド) | ダブルクリックでその場編集(`useInlineEdit.ts`) | **無し** |
| キーボードで右クリックメニューを開く | フォーカスして Shift+F10(ブラウザ標準の `contextmenu`) | **無し** |
| キーボードでドラッグ | dnd-kit の `KeyboardSensor`(Space で掴む・矢印で動かす) | **無し** |
| 取り消し・やり直し | Ctrl+Z / Ctrl+Y | ボタンの `title` だけ(ホバーしないと見えない) |
| セマンティックズーム | 縮小(倍率 0.6 未満)するとメソッドと行数が隠れる(`semanticZoom.ts` の `DETAIL_ZOOM`) | **無し**。縮小しすぎて「メソッドが消えた」と戸惑いうる |

対象プレイヤー(新卒〜4年目)は、初級2の時点で「クラスを追加ってどこ?」と手が止まりうる。行き詰まりヒント(`describeSolutionStep.ts`)は
「継承元を設定」「ファイルを削除」には「右クリック」と書くが、ヒントを開くと模範解答の手順まで見えてしまうので、
**操作の仕方だけを知りたい**ときの逃げ場にならない。リポジトリ直下の `README.md` の「遊び方(プロトタイプ)」も、抽出・ドラッグ移動の3行と
古い採点の説明だけで、右クリック・ダブルクリック・余白へのドロップ・キーボード操作に触れていない。

CLAUDE.md の ponytail 方針で「手を抜かないもの」に挙がっている**アクセシビリティ(キーボード操作を含む)**の観点でも、
キーボードでの代わりの操作(Shift+F10・`KeyboardSensor`・Ctrl+Z)は**用意されているのに知る手段が無い**。
新しい操作を作るのではなく、既にある操作を1か所に書き出して見つけられるようにするだけなので、ponytail の階段の「もうあるか?」で
操作そのものは作らずに済む。ダイアログはネイティブの `<dialog>`(既存の `CodebasePreviewDialog.tsx` と同じ流儀。Esc・フォーカストラップはブラウザ任せ)で足りる見込み。

これまでの18件はステージ・採点・クイズ・右クリックメニュー・保存・AI講評・キャンバスの見え方・入力検証・配色に集中しており、
**初めて遊ぶ人が操作を見つけられるか(オンボーディング・発見しやすさ)**を主題にしたものは無い。

### 既存テーマとの重複確認

- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 18件に、操作ガイド・ヘルプ・遊び方の一覧を主題にしたものは無い
  (`操作ガイド`・`ヘルプ`・`help`・`遊び方`・`操作一覧`・`チートシート`・`オンボーディング` で `docs/` をgrepして該当なし)
- `docs/specs/stuck-player-hints.md`(`HintPanel.tsx`): 模範解答の**手順**を1手ずつ見せる。操作の**やり方**の一覧ではない → 別物。本件はヒントを変更しない
- `move-via-context-menu`(完了)・`move-class-via-context-menu`(進行中): 右クリックメニューに**操作を足す**。本件はメニューを変えず、メニューがあることを知らせるだけ
- `color-contrast-a11y`: 配色と行数オーバーの印。キーボード操作の案内は扱わない → 重複しない
- `identifier-name-validation`: 名前の入力の検証。名前の変更の**入口**(ダブルクリック)の案内は扱わない → 重複しない
- 18件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **変更依頼の実装中、メソッドの中身(`InspectedMethod`)がマウスのホバーでしか出ない**: キーボード利用者の穴らしいが、ホバーの起点が
  `MethodChip.tsx` 側で、`color-contrast-a11y` が同じ `MethodChipView` を触る予定のため見送り
- **部品置き場のファイルに出る ⚠️ を消す**(`blank-design-mode.md`・`implement-change-request.md` のスコープ外): `FileNode.tsx` だけで済みそうだが、
  両仕様とも「遊んでみて邪魔なら足す」としており、その声がまだ無い(YAGNI)
- **変更依頼の結果に「初期状態で一番良い置き方の点数」を出す**(`implement-change-request.md` のスコープ外): `extend` の依頼が上級2の1件しか無く、効く場面が少ない
- **設計くらべクイズの正解数の保存・自己ベストのステージ選択での表示**: 過去の探索と同じく学習の中身が増えず、`StagePanel.tsx`・`useGameStore.ts` の競合もある
- **新ステージ(デメテルの法則・Observer・Facade など)**: 過去の探索と同じく、ステージ定義ファイル3つと `sampleAnswer.ts` が他の3件で埋まっている
- **VSCode風ファイルツリー**: 過去の探索と同じ理由(1回のPRには大きい)

## 関連する既存コード

- `src/presentation/App.tsx` — 画面上部のモード切り替え(`<nav className="mode-switch">`)。ガイドを開くボタンを置く先の候補
  (ステージに関係なく、どのモードからも開けるため `StagePanel.tsx` より向いている)
- `src/presentation/preview/CodebasePreviewDialog.tsx` — ネイティブ `<dialog>` の `showModal()`・`onClose`・`aria-labelledby`・閉じるボタンの前例
- 書き出す操作の出どころ(**読むだけ・変更しない**):
  - `src/presentation/canvas/CodebaseCanvas.tsx` — `useDropHandler`(クラス・ファイルへのドロップと、枠外へのドロップで新しいクラス/ファイル)、
    `PointerSensor` + `KeyboardSensor`
  - `src/presentation/canvas/CanvasContextMenu.tsx` — `menuItemsFor`(右クリックメニューの項目の一覧)
  - `src/presentation/canvas/useInlineEdit.ts`・`InlineEditableLabel.tsx` — ダブルクリックでの名前の変更
  - `src/presentation/editor/MethodEditor.tsx` — 抽出・統合・可視性・呼び出し元へ戻す・空実装の削除
  - `src/presentation/useUndoRedoShortcut.ts` — Ctrl+Z / Ctrl+Y(入力欄では効かない)
  - `src/presentation/canvas/semanticZoom.ts` — `DETAIL_ZOOM`(縮小するとメソッドが隠れる)
  - `src/presentation/blank/BlankDesignPanel.tsx`・`src/presentation/change/ChangeRequestPanel.tsx` — モード内に操作の案内を書いている前例(文言の揃え先)
- `src/infrastructure/stages/beginnerStages.ts`(初級2)・`intermediateStages.ts`(中級2)の goal — 操作の場所を言わずに操作名だけを出している例(参照のみ)
- `README.md` の「遊び方(プロトタイプ)」— 古くなっている操作説明(直すかは仕様設計で決める)
- `e2e/` — ガイドの開閉を確かめるE2Eの追加先(既存ファイルとの競合を避けるなら新しいspecファイル)

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の新しいコンポーネント1つと `App.tsx` の数行、CSSの数行、E2E1本が中心で、
domain / application / infrastructure は変更しない見込み(表示のみのコンポーネントなのでユニットテストは対象外。開閉はプレイヤーの操作なのでE2Eで守る)。

1. **今回やる**: 画面上部のボタンから操作ガイドを開き、今ある操作(マウスでのやり方と、キーボードでの代わりのやり方)を一覧で見せる。
   Esc・閉じるボタンで閉じ、閉じたらボタンにフォーカスが戻る
2. **後回し**:
   - 初回訪問時に自動で開く(localStorage で既読を覚える。`stage-draft-persistence` と保存キーの設計が絡むので分ける)
   - 初級2・中級2の goal 文言に「右クリック」を書き足す(ステージ定義ファイルは他の3件が触るので、落ち着いてから)
   - 設計くらべ・白紙設計のモードごとの案内をガイドに含める(今回含めるかは仕様設計で決める)

仕様設計者に決めてほしい論点(ここでは決めない):

- 載せる操作の範囲と並べ方(「メソッド分け・クラス分け・ファイル分け」の3本柱ごとか、マウス/キーボードの対応表か)。
  リファクタリング画面だけにするか、設計くらべ・白紙設計・変更依頼の実装中の操作も載せるか
- ガイドの内容をデータ(配列)で持つか、JSXに直書きするか(ponytail 的には直書きで足りる見込み)
- `KeyboardSensor` のキー操作(Space で掴む・矢印・Space で置く・Esc で取り消し)を、実際にこのキャンバスで使える形で書けるか。
  ズーム・パン次第で目的の場所に届かない既知の弱点(`move-class-via-context-menu/01-discovered.md`)があるので、右クリックメニューの移動を先に案内するか
- ボタンの置き場所・文言(「操作ガイド」「?」など)と、`aria-haspopup="dialog"` などの付け方
- `README.md` の「遊び方」も同じ内容に直すか、ガイドへの案内に置き換えるか
- E2Eで何を確かめるか(開く・主要な操作名が載っている・Esc で閉じてフォーカスが戻る、程度か)

### 既存パイプラインとの衝突可能性

- **`src/presentation/App.tsx`**: 18件のどのパイプラインも変更予定なし(`stage-draft-persistence` は参照のみ、`identifier-name-validation` は見送り候補の説明で名前を出しただけ)。競合なし
- **新しいコンポーネント(例: `src/presentation/guide/` 配下)**: 新規ファイルなので競合なし
- **`src/index.css`**: 多くのパイプラインが追記する。ガイド用のスタイルを数行足すなら末尾への追記で、競合は小さい。
  `color-contrast-a11y` が `.mode-switch button[aria-pressed="true"]` の色を変える予定なので、ボタンを `.mode-switch` の中に置く場合は
  見た目がそちらの変更に引きずられる(`aria-pressed` を付けないボタンなら影響は無い見込み)。既存の `.codebase-preview` のダイアログのスタイルを流用できれば追記自体が減る
- **`e2e/`**: `refactor.spec.ts` は多くのパイプラインが追記するので、**新しいspecファイルに置く**のを推奨(そうすれば競合なし)
- **意味上の依存**: `move-class-via-context-menu`(右クリックメニューに「別のファイルへ移動」を足す)など、後から操作が増えるとガイドの記述が古くなる。
  ガイドは「今マージ済みの操作」だけを書き、後からマージされる側で1行足す運用にするか、仕様設計で決めてほしい
  (ガイドの文言をE2Eで厳密に固定しすぎると、操作を足すたびにE2Eの修正が要る点にも注意)
- `score.ts`・`fileScores.ts`・`sampleAnswer.ts`・ステージ定義(`src/infrastructure/stages/*.ts`)・`useGameStore.ts`・`CodebaseCanvas.tsx`・
  `CanvasContextMenu.tsx`・`MethodEditor.tsx`・`MethodChip.tsx`・`StagePanel.tsx`・`naming.ts`・`workers/critique/` には触らない想定
