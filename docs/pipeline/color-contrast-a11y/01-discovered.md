# 01 機能探索: 文字色のコントラスト不足を直し、「行数オーバー」を色以外でも伝える

- slug: `color-contrast-a11y`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

## 背景・目的

画面の色はすべて `src/index.css` 冒頭のCSS変数(`:root` と `@media (prefers-color-scheme: dark)`)で決まっている。
リポジトリには「色だけに頼らない」という方針が既にある(`FileNode.tsx` の `FileMark`、`ClassNode.tsx` の `CyclicMark`、
`docs/specs/cyclic-dependency-class-highlight.md`、`MethodEditor.tsx` の「読む/書く」の文字表示)。ただし、次の2点は
これまでどの仕様書・パイプラインでも扱われていない(`コントラスト`・`contrast`・`WCAG` でgrepして該当なし)。

### 1. 文字色のコントラスト不足(WCAG 2.x AA の 4.5:1 に届かない)

CSS変数の値から手計算した概算(相対輝度の式で計算。最終的な数値は仕様設計・実装で確かめ直してほしい):

| 使われ方 | 前景 / 背景 | 概算比 | 該当するCSS |
| --- | --- | --- | --- |
| 可視性の記号 `+`(ライト) | `--public` #2e9e6a / `--bg` #f6f7fb | 約3.2 | `.method-chip--public .method-chip__visibility` ほか `field-chip` |
| 可視性の記号 `-`(ライト) | `--private` #8a8fa3 / `--bg` | 約3.0 | 同上 |
| 可視性の記号 `#`(ライト) | `--protected` #c9861c / `--bg` | 約2.8 | 同上 |
| エラー文言(ライト) | `--danger` #d64545 / `--surface` #fff | 約4.4 | `.method-editor__message`・`.critique-panel__error`・`.line-badge--over` |
| エラー文言(ダーク) | `--danger` #d64545 / `--surface` #1f222c | 約3.6 | 同上(`--danger` はダーク用の上書きが無い) |
| 選択中のモードボタン(ダーク) | 白 #fff / `--accent` #7c93ff | 約2.8 | `.mode-switch button[aria-pressed="true"]`(文字色が `#fff` 固定) |
| 変更バッジ(ライト) | `--accent` #4f6bed / `--bg` | 約4.2 | `.method-chip__badge`(11px) |
| 空のファイルの案内(ライト) | `--muted` #6b7285 / `--file-bg` #eef1fa | 約4.3 | `.file-node__empty` |

`--public`・`--private`・`--protected`・`--danger` はダークモードで上書きされておらず、ライト用の値がそのまま使われている。

### 2. 行数オーバーのメソッドが「赤い枠線」だけで示されている

`MethodChip.tsx` の `MethodChipView` は、行数の上限を超えたメソッドに `method-chip--over` を付けるだけで、CSSは
`border-color: var(--danger)` の1行(`index.css` 119行目)。行数の文字(`.method-chip__lines`)は上限内と同じ `--muted` のまま。
赤緑の色覚特性があるプレイヤーや、ダークモードの暗い背景では「どのメソッドが長すぎるのか」がほぼ見分けられない。
行数オーバーは全ステージで最初に直す減点(チュートリアル1からの主題)なので、ここが見えないとゲームの入り口でつまずく。
クラス・ファイルの行数バッジ(`.line-badge--over`)は赤+太字で、メソッドだけが枠線の色のみになっている。
なお選択中のメソッド(`method-chip--selected`)も枠線の色だけだが、選択はサイドパネルのメソッドエディタにも表れるので優先度は低い。

呼び出し元が挙げた「アクセシビリティの色コントラスト」の切り口で、これまでのサイクルが扱っていない
「見た目の土台(CSS変数)」を対象にする。CLAUDE.md の ponytail 方針で手を抜かないものに挙がっている「アクセシビリティ」に当たる。

### 既存テーマとの重複確認

- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 14件に、コントラスト・配色を主題にしたものは無い
- `class-dependency-focus`(02作成中)は矢印の太さ・不透明度を足すが、色の値は変えないと明記している → 重複しない
- `score-deduction-locations`(02完了)は `StagePanel.tsx` に減点原因の一覧を足し、`index.css` にクラスを1つ足すだけ → 重複しない
- 呼び出し元が列挙した14件のどれとも主題が重ならない

### 検討して見送った候補

- **ステージ選択画面のUX(自己ベスト点の表示・「次のステージへ」)**: `StagePanel.tsx` が `score-deduction-locations` と
  `stage-draft-persistence` の両方から触られる予定で、同じ箇所の競合が起きやすい
- **ステージURLでの直接リンク(`?stage=...`)**: 初期ステージの決め方が `useGameStore.ts` にあり、`stage-draft-persistence` の
  「続きから再開」と挙動が絡む
- **タブレット対応(狭い画面のレイアウト+タッチ操作)**: `index.css` に `@media` が1つも無く需要はありそうだが、タッチでのD&Dは
  `CodebaseCanvas.tsx` のセンサー設定に触れる可能性が高く、PlaywrightのタッチE2Eも新たに要る。1回のPRには大きい
- **デメテルの法則(Hide Delegate)の中級ステージ**: 題材としては足りていないが、ステージ追加は必ず `sampleAnswer.ts` に
  模範解答を足す必要がある(`stageCatalog.test.ts` 583行目)ため、今回は避ける
- **変更依頼の種類の追加(`ChangeKind` に「削除」など)**: `domain/change/` 一式・`ChangeRequestPanel.tsx`・`describeChange.ts`・
  題材データまで広がり、1回のPRには大きい
- **多言語対応**: 文言がコンポーネント・ドメインに直書きされており規模が大きすぎる

## 関連する既存コード

- `src/index.css`
  - 1〜28行目: `:root` の色変数とダークモードの上書き(主な変更先)
  - 41行目: `.mode-switch button[aria-pressed="true"]`(文字色 `#fff` 固定)
  - 107〜110・116〜121行目: 可視性の色(`--public`/`--private`/`--protected`)と `.method-chip--over`
  - 123・125〜126行目: `.method-chip__lines`・`.line-badge`・`.line-badge--over`
  - 132・154・169・192行目: `.method-editor__message`・`.critique-panel__error`・`.file-node__empty`・`.method-chip__badge`
- `src/presentation/canvas/MethodChip.tsx` — `MethodChipView`(`overLimit` で `method-chip--over` を付ける)。
  `CodebaseCanvas.tsx` の `DragOverlay` と `PreviewClassNode.tsx`(変更前・解答例の図、設計くらべ)からも使われるので、
  ここを直すと3か所すべてに効く
- `src/presentation/canvas/visibilityMark.ts` — 可視性は記号(`+`/`-`/`#`)でも伝えている(色だけには頼っていない。コントラストだけの問題)
- `src/presentation/canvas/FileNode.tsx`・`ClassNode.tsx` — `line-badge--over` と、色だけに頼らない印(`FileMark`・`CyclicMark`)の既存パターン
- `docs/specs/cyclic-dependency-class-highlight.md` — 「色だけに頼らない」を必須にした前例の仕様書
- `e2e/refactor.spec.ts` — 行数オーバーのメソッドを扱う既存E2E(ステージ初期状態のチップ)

テストの前例: CSSを読むテスト・`getComputedStyle`/`toHaveCSS` を使うE2E・axe などのa11y検査は、リポジトリにまだ無い(grepで確認済み。
`package.json` にも a11y 検査の依存は無い)。

## スコープの見立て

小さい。1回のPRに十分収まる。domain / application / infrastructure は触らない見込み。

1. **必須**: `index.css` の色変数を、上の表の組み合わせが 4.5:1 以上になる値に調整する(ライト・ダークとも)。
   必要ならダークモードに `--public`/`--private`/`--protected`/`--danger` の上書きを足し、選択中モードボタンの `#fff` 固定を見直す
2. **必須**: 行数オーバーのメソッドを、枠線の色以外でも分かるようにする(`MethodChipView` の1か所)
3. **任意**: 色の組み合わせのコントラスト比を、テストで守る(新しい依存を足さない方法で)。膨らむなら後回しにする

仕様設計者に委ねる論点(ここでは決めない):

- 目標の基準(本文・記号は一律 4.5:1 か、太字の記号は 3:1 の「大きな文字」扱いにするか。ponytail 的には一律 4.5:1 が単純)
- 色味をどこまで保つか(可視性の緑・灰・橙、危険の赤、アクセントの青の色相は変えず明度だけ下げる、など)
- 行数オーバーの表し方(行数の文字を `.line-badge--over` と同じ赤+太字にする/記号を足す/`aria-label`・`title` を足す)。
  スクリーンリーダー向けの文言を足すかどうか
- 選択中メソッド(`method-chip--selected`)も色以外で示すか(スコープを広げすぎない)
- コントラストの検査をどう守るか(例: `index.css` を読んでCSS変数の値からコントラスト比を計算するVitestのテストを presentation に置く/
  Playwright で `prefers-color-scheme` を切り替えて計算済みの色を確かめる/手動確認のみ)。新しい依存(axe など)は足さない方向
- 見た目の変更だけなのでE2Eを足すか(行数オーバーの印を足すなら、`e2e/refactor.spec.ts` で印の有無を確かめる程度は検討の価値あり)

### 既存パイプラインとの衝突の可能性

- **`src/index.css`**: `score-deduction-locations`・`class-dependency-focus`・`method-call-references` がそれぞれ末尾付近や
  既存ルールの直後にクラスを追記する予定。本件の主な変更は**冒頭の色変数(1〜28行目)と既存ルールの値の書き換え**なので、
  追記とは行が離れていてテキスト上の競合は小さい。ただし `--danger`・`--accent`・`--muted` の値を変えると、他のパイプラインが
  足すスタイル(循環依存の矢印・減点一覧の文字など)の見た目も一緒に変わる(意図どおり。コントラストが上がる方向なので悪影響は無い見込み)
- **`src/presentation/canvas/MethodChip.tsx`**: 変更は `MethodChipView` の中の数行の想定。完了済みの `move-via-context-menu` が
  `data-method-id` を足した以外、進行中のパイプラインは「変更しない」または「後回し」としている(`method-call-references` の
  「キャンバス上でチップを強調」は後回し扱い)。衝突の可能性は小さい
- `score.ts`・`fileScores.ts`・`sampleAnswer.ts`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`CodebaseCanvas.tsx`・
  `useGameStore.ts`・`layoutCodebase.ts`・`StagePanel.tsx` には触らない
- `e2e/refactor.spec.ts` に追記する場合は、他パイプラインの追記と位置が競合する可能性がある(小さい)
