# 評価: concrete-superclass-loophole

## 2026-10-03 — evaluate(対話セッション内、feature-harness、2往復)

- 仕様書: `docs/specs/concrete-superclass-loophole.md`
- 実装者: Codex CLI(`codex exec`、対話セッションのオーケストレーターが直接呼び出し)
- 評価者: Claude(`evaluator`サブエージェント、独立プロセス)
- 変更: `src/domain/scoring/interfaceContracts.ts`・`interfaceContracts.test.ts`・
  `src/infrastructure/stages/advancedStages.test.ts`(直前に実装した`extends-interface-loophole`の上に実装)

### 相互作用によるテスト期待値の修正

`npm run check`を実行すると、`extends-interface-loophole`が追加した既存テスト「extends鎖の途中のクラスも契約をすべて
持つ必要がある」(I ← B extends I(aだけ) ← C extends B(bだけ))が1件失敗した。期待値は元`['class-b']`だったが、
今回追加した`findBorrowedContracts`の規則(仕様書108行目「先祖が具象ならCのIDを1件」)により、Cが自分で持たない
`a`をextendsの先祖で最初に持つ具象クラスBから借用していると正しく判定され、実際には`['class-b', 'class-c']`になる。

これは2つの機能の判定規則が組み合わさった結果の正しい動作であり、実装のバグではないと判断した。Codexにこの分析を
添えて差し戻し、テストの期待値を`['class-b', 'class-c']`に書き換えてもらった。評価者が仕様書4.1節の規則に沿って
この書き換えを独立に手計算で再検証し、正しいことを確認した。

### 実行結果

| コマンド | 結果 |
| --- | --- |
| `npm run check` | pass(64ファイル・976件) |
| `npm run test:coverage` | pass(`interfaceContracts.ts`はstatements/functions/lines 100%、branch 98.07%) |

### 受け入れ基準(仕様書5章)

- `findBorrowedContracts`・`nearestOwnerOf`が4.1節の規則通り(isInterfaceLike/isAbstractLikeな先祖は対象外、
  具象の先祖からの借用だけ1件、extendsの輪への耐性)
- 4.1のテストケース1〜7・11・12を確認(8〜10は既存コードパスで間接的に満たされる。次に活かす点を参照)
- 上級6の8手(`deleteMethod`×5→`setSuperclass`×3でChatworkClient継承)でtotal: 50、
  `[{ rule: 'contract', count: 5, points: 50 }]`
- 既存の抽象役テスト(89〜112行目相当)は期待値`[]`のまま通過
- `findContractViolations`のJSDocに「具象の先祖からの契約の借用」が追加、`// ponytail:`コメントが残っている
- `src/application/`・`src/presentation/`・`e2e/`・ステージ定義本体に差分なし

### 指摘

**suggestion**

- `docs/specs/concrete-superclass-loophole.md`57〜60行目 — 「既存テストへの影響」の分析が、`extends-interface-loophole`
  が追加した「extends鎖の途中のクラスも契約をすべて持つ必要がある」テストへの影響を見落としていた(両機能が同時期に
  未実装のまま並行して仕様設計されたため)。次回は、先に進んでいる関連機能が追加する予定のテストも分析対象に含めると
  見落としを減らせる。
- `interfaceContracts.test.ts` — 仕様書ケース8(先祖のどれもmを持たない境界)がextends鎖を持つ専用テストでは
  なく既存ケースで間接的にしか確認されていない。循環テストも契約(interfaceIds)を持たないクラス同士なので、
  `nearestOwnerOf`の循環防止ロジック自体は実際には踏まれていない。いずれもblockerではないが、専用テストを
  足すとより明確になる。

blockerなし。

### 総合判定

**合格**。仕様書6章のスコープ外(Refused Bequest一般・新ルール名の追加・操作側のガード等)に手を出していない。
