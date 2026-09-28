# 評価: template-method-stage

## 2026-09-28 — evaluate(マージ後の最終評価)

- 仕様書: `docs/specs/template-method-stage.md`
- 対象: マージコミット `196deac`(PR #14、`pipeline/template-method-stage`)
- 変更: `overrides.ts`(新規)・`dependencies.ts`・`visibility.ts`・`mergeMethods.ts`・`Codebase.ts`(`isAbstractLike`)・
  `measurePlacement.ts`・`changeVisibility.ts`(仕様の一覧外)・`sampleAnswer.ts`・`advancedStages.ts`・
  `stageCatalog.test.ts`・`templateMethodStage.test.ts`(新規)・`MethodEditor.tsx`(ヒント文1行)・`e2e/refactor.spec.ts`

### 実行結果

| コマンド | 結果 |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass(63ファイル・942件) |
| `npm run test:coverage` | pass(閾値割れなし。`domain/codebase` 98.6% / `domain/scoring` 100% / `domain/change` 96.6%) |
| `npm run test:e2e` | **未確認**。評価環境にPlaywrightのChromiumが無く、83件すべて `browserType.launch: Executable doesn't exist` で起動前に失敗(前回の評価と同じ環境要因で、コードの不具合ではない)。05-review-notes.md の Codex自己レビューでは83件すべて成功と報告されている |

### 受け入れ基準

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| `npm run check` が通り、`domain` のカバレッジ閾値を割らない | ○ | 上記 |
| 上級8が上級の末尾に出て、模範解答で100点 | ○ | `templateMethodStage.test.ts` で「上級の末尾」「100点」「依存は Controller→OrderImporter の1本・循環なし・可視性違反なし」を確認 |
| 「XMLでも取り込めるようにして」で子クラスを1つ足すだけで置き方100点 | ○ | 既存クラスの修正0・`attachment: 'abstract'`・`scorePlacement` 100点をテストで確認 |
| 既存ステージの点数・模範解答・近道テストが変わらない | ○(1点注意) | 既存の `stageCatalog` テストはすべて通る。ただし全ステージ共通の不変条件を1つ緩めている(指摘2) |
| 上級8の2つの `importOrders` を「似た処理を持つメソッド」から統合するE2Eが1本ある | ○(実行は未確認) | `e2e/refactor.spec.ts:1586`。統合後に public のまま1つになり、OrderImporter へ移して100点になるところまで確認している |
| `visibility.ts` の ponytail コメントが書き換わっている | ○ | 「抽象宣言のない親→子の protected 呼び出しは違反のまま。デフォルト実装付きフックを扱うときに見直す」 |

4章の純粋関数について:

- 4.1 `resolvesToOwnDeclaration`: 正常系(protected/public)・private・宣言なし・継承なし・implementsのみ・孫・存在しないID をすべてテスト済み。
  仕様にない「自分自身」「具象フック」「private宣言」も否定ケースとしてカバーしている。`// ponytail:` コメントもある。
- 4.2 `mergeMethods`: `sameCalls` を足し、呼び出し行だけのメソッドは同じ可視性なら public/protected 同士も統合できる。
  本物の処理が混ざった public は `not-private` のまま(公開APIの誤統合を防ぐ安全策を残している)。`findMergeCandidates` も同じ条件。
- 4.3 `isAbstractLike` と `measureAttachment` の変更は仕様どおり。既存ステージで protected の空メソッドを持つのは上級8だけなので、既存の置き方の採点に影響しない。

### 指摘

1. **suggestion** — `src/domain/codebase/changeVisibility.ts:39-50`、`src/domain/stage/sampleAnswer.ts:598-602`
   - 仕様の変更対象ファイル一覧に無い `changeVisibility` を変更し、模範解答の順序も仕様(4:可視性 → 5:継承)から
     「継承 → 可視性」に入れ替えている。抽出直後の子の `parse` は自クラスからしか呼ばれないため、既存の
     「広げるには呼び出し元が必要」のルールでは protected にできず、仕様の手順どおりでは詰まる。これを
     「親の抽象宣言を実装しているなら広げてよい」で解決した判断は妥当で、goal 文(「継承させてから parse を protected に」)と
     ヒント文も合わせて直してあり、テストもある。
   - ただし仕様にない判断を実装者がしたことになる。
   - 推奨対応: コード修正は不要。仕様設計側の調査漏れ(次に活かす点1)として扱う。
2. **suggestion** — `src/infrastructure/stages/stageCatalog.test.ts:676-688`
   - 全ステージに共通の不変条件「ルール変更(modify)の依頼が2件以上ある」を、「依頼全体が2件以上、modify は1件以上」に緩めている。
     上級8の依頼は仕様で「extend 1件 + modify 1件」と決まっているので、緩めないと通らない。ただし今後のステージでも modify 1件で済んでしまう。
   - 推奨対応: 意図した変更なら問題なし。厳しく保ちたいなら「modify が2件以上、または extend を含み modify が1件以上」のように、
     上級8の形だけを許す条件にする。
3. **suggestion(shrink)** — `src/domain/codebase/Codebase.test.ts:1`
   - `import { isAbstractLike } from "./Codebase";` が既存の import ブロックとは別に、ダブルクォートで先頭に追加されている
     (同じファイルのすぐ下に `./Codebase` からの import がある)。
   - 推奨対応: 既存の import にまとめる。同じく `measurePlacement.test.ts:284`・`changeVisibility.test.ts:178-195`・
     `mergeMethods.test.ts:359` の追加テストが `describe` の外に置かれていたり、空行が2行続いていたりするので、周りのテストの形に揃える。
4. **suggestion** — `src/domain/codebase/dependencies.ts:274-276`、`src/domain/scoring/visibility.ts:33`
   - `resolvesToOwnDeclaration` は `uses` 1件ごとに `findMethod`・`findClassOfMethod`・`findClass`・`extendsChainIds` で全クラスを走査する。
     `classDependencies` はすでに `methodOwnerMap` を持っているのに使っていない。今のステージ規模では問題ない。
   - 推奨対応: 今は直さなくてよい。手抜きが増えた場所として `// ponytail:` コメントを1行足しておくと、`/ponytail-review debt` で追える。

blockerはありません。

#### DDDの層・ponytailの観点

- `overrides.ts` は `domain/codebase` にあり、フレームワークに依存していない。`dependencies.ts` と `visibility.ts` が同じ関数を
  共有し、判定を二重に持っていない。型に `abstract` フラグを足さず、既存の「protected かつ `fragments: []`」を読み替えるだけで済ませている(仕様どおりのYAGNI)。
- 新しい操作(Pull Up Method)を作らず、Merge Methods の条件を広げるだけで骨組みを引き上げられるようにしている。presentation の変更はヒント文1行だけ。
- 過剰設計は見当たらない。

#### キーボード操作

- 追加した操作(統合・可視性の変更・継承元の設定)はどれも、既存のボタン・`<select>`・右クリックメニュー(Shift+F10で開ける)から行える。
  D&Dでしかできない手順は増えていない。

### 総合判定

**受け入れ基準を満たしている(合格)**。ただしE2Eはこの環境では実行できず、Codex自己レビューでの報告(83件成功)を根拠にしている。

### 次に活かす点

1. **仕様設計で、模範解答の各手順が既存の前提条件を通るかを1手ずつ確かめる。** 今回は「抽出直後の private を protected に広げる」手順が
   `changeVisibility` の「呼び出し元が必要」に引っかかることを、仕様設計でも最終仕様でも見落としていた。
   実装者がうまく埋めたが、本来は仕様で決めるべき設計判断だった(`changeVisibility` を一覧に入れるか、手順を入れ替えるか)。
2. **ステージデータの形が全ステージ共通のカタログテストに合うかを、仕様の時点で確かめる。**
   依頼の種類と件数(今回は extend 1 + modify 1)は `stageCatalog.test.ts` の不変条件に直接効くので、緩めるなら仕様に明記する。
3. **E2Eを評価環境でも実行できるようにする。** 2回続けてChromium未インストールで未確認になっている。
   evaluate ジョブに `npx playwright install --with-deps chromium` を足せば、Codex側の報告に頼らずに済む。
