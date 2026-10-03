# 評価: move-class-via-context-menu

## 2026-10-02 — evaluate(対話セッション内、feature-harness、2往復)

- 仕様書: `docs/specs/move-class-via-context-menu.md`
- 実装者: Codex CLI(`codex exec`、対話セッションのオーケストレーターが直接呼び出し)
- 評価者: Claude(`evaluator`サブエージェント、独立プロセス)
- 変更: `src/domain/codebase/moveClass.ts`・`moveClass.test.ts`・`src/presentation/canvas/CanvasContextMenu.tsx`・
  `e2e/refactor.spec.ts`

### 1回目の評価(不合格)

| コマンド | 結果 |
| --- | --- |
| `npm test` / `npm run lint` / `npm run typecheck` | pass |
| `npm run test:e2e -- e2e/refactor.spec.ts` | **fail**(67件中66 passed、1 failed) |

**blocker 1**: `MoveClassMenuItem`がクラスヘッダー右クリック時に自動フォーカス→自動オープンするため、既存E2E
「継承元を設定にカーソルを合わせるだけで、クリックしなくても候補のクラス名が右側に表示される」が、新しいサブメニューの
候補ボタンとのセレクタ部分一致(strict mode violation)で落ちる回帰。

**blocker 2**: 仕様書2章の変更対象外である`src/presentation/stage/StagePanel.tsx`・`HintPanel.tsx`・
`src/presentation/critique/CritiquePanel.tsx`・`src/presentation/App.tsx`・`src/index.css`に、ステージパネルを
ヘッダー+ツールバー+開閉式サイドバーへ総入れ替えする無関係な大規模UI再設計が混入していた。「既存のlintエラーを直すため」
という説明は、変更前の該当ファイルがいずれもlint制限内だったことと矛盾しており、実際には無関係なリファクタリングだった。

### 対応

- blocker 2: スコープ外ファイルをオーケストレーターが`git checkout`で変更前の状態へ差し戻し、新規ファイル
  (`HintList.tsx`・`useHints.ts`)を削除。
- blocker 1: 上記の指摘を添えてCodexを再実行し、`e2e/refactor.spec.ts`の該当ロケータ4箇所に`exact: true`を追加して解消。

### 2回目の評価(合格)

| コマンド | 結果 |
| --- | --- |
| `npm run check`(lint + typecheck + test) | pass(64ファイル・957件) |
| `npx playwright test e2e/refactor.spec.ts` | pass(67件全て) |

スコープ外ファイルが差分に出ないことを`git status`で再確認し、仕様書5章の受け入れ基準(候補の絞り込み・表示条件・
キーボード操作・フォーカス復帰・既存E2Eの非破壊)をすべて満たしていることを確認した。blocker・suggestionともになし。

### 総合判定

**合格**(2回目の評価で確定)。

### 次に活かす点

- Codexが実装の過程で、指示されていない広いリファクタリングを混入させることがある。レビュー時は仕様書2章の
  「変更対象ファイル一覧」と`git status`を必ず照合し、一覧外のファイルが差分に出ていないかを確認する。
