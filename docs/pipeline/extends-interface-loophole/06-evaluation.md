# 評価: extends-interface-loophole

## 2026-10-03 — evaluate(対話セッション内、feature-harness)

- 仕様書: `docs/specs/extends-interface-loophole.md`
- 実装者: Codex CLI(`codex exec`、対話セッションのオーケストレーターが直接呼び出し)
- 評価者: Claude(`evaluator`サブエージェント、独立プロセス)
- 変更: `src/domain/scoring/interfaceContracts.ts`・`interfaceContracts.test.ts`・
  `src/infrastructure/stages/advancedStages.test.ts`
- 備考: Codexの実行環境では`npm`コマンドが見当たらず`npm run check`が未実施だったため、オーケストレーターが
  手元で実行し、lint・typecheck・test(968件)すべてpassすることを確認してから評価に回した。

### 実行結果

| コマンド | 結果 |
| --- | --- |
| `npm run check` | pass(64ファイル・968件) |
| `npm run test:coverage` | pass(`domain/scoring`はstatements/branches/lines全て100%) |

### 受け入れ基準(仕様書5章)

- `findMissingImplementations`がimplementsのインターフェース役 + (Cが非インターフェース役のときだけ)extends先祖の
  インターフェース役の両方を見るようになっている
- インターフェース役の先祖の契約メソッド名は「持っている」に数えない(`extendsChainMethodNames`の書き換え)
- extendsの途中のクラス(C extends B extends I のB)も実装漏れに数える
- 4.1のテストケース1〜11、4.2の上級6回帰テスト(11手でtotal: 50、`[{ rule: 'contract', count: 5, points: 50 }]`)を確認
- 既存12件は変更されず通過、`// ponytail:`コメントが残っている
- `src/application/`・`src/presentation/`・`e2e/`・ステージ定義本体に差分なし

### 指摘

**suggestion**

- `src/domain/scoring/interfaceContracts.test.ts` — 新規追加した10件に`// Arrange`/`// Act`/`// Assert`のコメントが
  無く、既存12件・同PRの`advancedStages.test.ts`側とAAAコメントの書き方が揃っていない。可読性・規約一貫性の観点で
  追記が望ましい(テストの正しさには影響なし)。
- `src/domain/scoring/interfaceContracts.ts` — `// ponytail:`コメントがループ内側に置かれており、ループのたびに
  同じコメントの下を通ることになる。関数のJSDocや定義直前へ1回だけ置く方が意図が伝わりやすい(機能に影響なし)。

blockerなし。

### 総合判定

**合格**。仕様書6章のスコープ外(`setSuperclass`側のガード、具象クラス借用=`concrete-superclass-loophole`、
`changeVisibility`関連)には手を出していない。
