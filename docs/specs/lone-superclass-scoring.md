# 子が1つしかない継承の減点と、上級5「使われない拡張ポイントを畳む」

## 背景・目的

今の採点は、分ける・抽象化する方向にしか点が動かない。そのため「継承やパターンを入れれば良い設計」という癖が
つきやすい。実務では、将来のために用意したのに1つしか使われていない基底クラスがよくある
(Fowler の Speculative Generality)。こうした基底クラスは、1つの概念を2クラスに散らし、変更のたびに両方を
触らせる。直し方は Collapse Hierarchy(階層の畳み込み)になる。

1. 採点ルール `lone-superclass` を足す: **extends している子クラスが1つだけのクラス**を1件10点で減点する
2. 上級5として、過剰な継承を畳むのが正解のステージを追加する
3. 設計くらべクイズ(`docs/specs/design-comparison-quiz.md`)に、上級5の初期コードと模範解答を比べる4問目を足す

### implements を対象にしない理由

実装が1つしかないインターフェースは、テストの差し替えや依存関係逆転(上級2で教えている形)のために実務でも
正当に使われる。一律に減点すると、上級2と矛盾したことを教えてしまう。extends は実装ごと継承するので、
子が1つなら畳んでも失うものがほとんどない。そのためこちらだけを対象にする。

**ponytail**: 「横流しするだけのメソッド(Middle Man)」の減点も候補にあった。しかし今のモデルでは、
呼び出し元を直接つなぎ替える操作がなく、ゲーム内で直せない。そのため作らない(スコープ外)。

前提: `docs/specs/design-comparison-quiz.md` が実装済みであること(4問目の追加だけに依存する)。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/scoring/loneSuperclass.ts` | domain | 新規 | `findLoneSuperclasses` |
| `src/domain/scoring/loneSuperclass.test.ts` | domain | 新規 | 上記のテスト |
| `src/domain/scoring/score.ts` | domain | 変更 | `ScoreRule` に `'lone-superclass'` を足し、`scoreCodebase` で数える |
| `src/domain/scoring/score.test.ts` | domain | 変更 | 減点されるケースを1つ足す |
| `src/domain/stage/sampleAnswer.ts` | domain | 変更 | `setSuperclass` ステップで継承の解除(`superclass: null`)を書けるようにし、上級5の模範解答を登録する |
| `src/domain/stage/sampleAnswer.test.ts` | domain | 変更 | 継承を解除するステップのテストを足す |
| `src/presentation/stage/describeSolutionStep.ts` | presentation | 変更 | 継承の解除をヒントの文にする(例:「CsvExporter の継承を外す」) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | `RULE_LABEL` に `'lone-superclass': '子が1つだけの継承'` を足す |
| `src/infrastructure/stages/advancedStages.ts` | infrastructure | 変更 | 上級5を末尾に追加する |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | `shortcuts` に1件足す(下記) |
| `src/infrastructure/quizzes/comparisonQuizzes.ts` | infrastructure | 変更 | 4問目を足す |

実装メモ: ファイルのエラーマーク(`domain/scoring/fileScores.ts` の `fileDeductions`)にも `findLoneSuperclasses` を足した
(減点されているのに、ファイルに印が出ないのを防ぐため)。`advancedStages.test.ts` に、上級5の狙い(初期は減点、
模範解答では継承がなくなり1クラスにまとまる)のテストを足した。

`ScoreRule` を網羅している箇所(`Record<ScoreRule, …>`)は、型チェックで漏れが分かる。AI講評
(`domain/critique/critiqueRequest.ts`)がルール名を扱っていれば、そこも合わせること。実装者が grep で確かめる。

## データ/型の変更

- `ScoreRule` に `'lone-superclass'` を追加する。`scoreCodebase` の減点の並びでは `unused` の後ろに置く
- `SolutionStep` の `setSuperclass.superclass` を `string | null` に広げる。`null` は継承の解除で、
  既存の `setSuperclass(codebase, classId, null)` をそのまま呼ぶ

## TDD対象の純粋関数

### `findLoneSuperclasses(codebase: Codebase): string[]`

`superclassId` で指されていて、`(superclassKind ?? 'extends') === 'extends'` の子がちょうど1つのクラスのIDを返す。

- 正常系: extends の子が1つの基底クラス → そのIDを返す
- 正常系: extends の子が2つの基底クラス → 返さない
- 正常系: implements の子が1つだけのクラス → 返さない
- 正常系: extends の子1つ + implements の子1つ → 返す(extends の子だけを数える)
- 正常系: 子が0のクラス → 返さない(上級1・上級2の初期状態がこの形。未使用の入れ物は `empty` など別のルールの担当)
- 境界: 親が削除されて `superclassId` が存在しないクラスを指している → 返さない(存在するクラスのIDだけを返す)

### `scoreCodebase`

- extends の子が1つだけの基底クラスがあると、`lone-superclass` の減点が10点になる

### `applySolutionSteps`

- `setSuperclass: { class: 'A', superclass: null }` で A の `superclassId` が消える

## 上級5のステージ

- id: `advanced-collapse-hierarchy`、title: `上級5: 子が1つしかない継承を畳む`
- description: 「いずれ Excel や PDF にも対応するかもしれない」と先輩が `BaseExporter` を用意したが、2年たっても
  子クラスは `CsvExporter` だけ。CSV の仕様を少し変えるたびに2クラスを行き来している、という状況にする。
  初期状態で出る循環依存の赤い印の理由(`BaseExporter` が子の `quoteChar` を呼び返している)も書く
- goal: 「使われない拡張ポイントは畳んで、1つのクラスにまとめよう」。上級1(共通処理を基底クラスへ集める)と
  逆向きの操作だと分かるように書く
- ファイル冒頭のコメントで、上級1との対比と、implements を対象外にした理由に一言触れる

### 初期コード

| ファイル | クラス | メソッド | 処理(行数, responsibility, uses) |
| --- | --- | --- | --- |
| `src/sales/SalesController.ts` | `SalesController` | `downloadSalesCsv`(public) | 検索条件を検証する(36, `http`)/ 売上データを取得する(40, `query`)/ CSVを出力する(8, `http`, uses: `prepareExport`・`writeRows`) |
| `src/export/BaseExporter.ts` | `BaseExporter` | `prepareExport`(public) | 文字コードとヘッダー行を決める(18, `csv-format`) |
| | | `escapeValue`(protected) | 値をエスケープする(14, `csv-format`, uses: `quoteChar`) |
| `src/export/CsvExporter.ts` | `CsvExporter`(extends `BaseExporter`) | `writeRows`(public) | 行をCSVに書き出す(26, `csv-format`, uses: `escapeValue`) |
| | | `quoteChar`(protected) | クォートに使う文字を返す(4, `csv-format`)。`BaseExporter` から呼ばれるフック |

`escapeValue` が子クラスのフック `quoteChar` を呼ぶ Template Method の形にしている。メソッドを一部だけ移して継承を外すと、
2クラスが互いを呼び合う循環依存が残るので、1クラスにまとめたときだけ100点になる(評価フェーズで、フックがないと
継承を畳まずに100点になる近道が3つ見つかったため)。

- `limits: { method: 90, class: 200, file: 300 }`、`dependencyLimit: 1`、`responsibilityLimit: 2`
- 初期の減点: `SalesController` の依存先が2つ(結合度 -10)、`BaseExporter` の子が1つ(`lone-superclass` -10)、
  `BaseExporter` と `CsvExporter` の循環依存(2本で -20)で60点
- `downloadSalesCsv` は 84 + 2 = 86行で「80行以上のメソッドがある」を満たす。メソッドの上限90には収まる

### 変更依頼

- 「区切り文字をタブにも切り替えられるようにして」(`csv-format`, `linesPerSite: 6`)
  - 初期: 変更箇所が2クラスに散らばり、`SalesController` にも波及する → 85点
  - 模範解答後: 1クラスで済み、波及だけが残る → 95点
- 「集計期間を会計年度で指定できるようにして」(`query`, `linesPerSite: 4`)
  - 初期も模範解答後も `SalesController` だけに変更が入る(悪化しない)

### 模範解答

1. `move: { method: 'prepareExport', toClass: 'CsvExporter' }`
2. `move: { method: 'escapeValue', toClass: 'CsvExporter' }`
3. `setSuperclass: { class: 'CsvExporter', superclass: null }`
4. `deleteFile: 'src/export/BaseExporter.ts'`

`BaseExporter` 側に寄せて `CsvExporter` を消す解き方でも100点になる。これは許容する
(どちらに寄せるかは名前の問題で、構造の良し悪しではないため)。

### `stageCatalog.test.ts` の `shortcuts` に足すもの

どれも `quoteChar` のフックによる循環依存か、`SalesController` の依存先2つが残り、100点にならない。

- 継承を外すだけで、メソッドを1クラスにまとめない
- `prepareExport` だけを `CsvExporter` へ移して継承を外す(`escapeValue` は `BaseExporter` に残る)
- `prepareExport` だけを `CsvExporter` へ移し、継承を implements に書き換える
- 「CSVを出力する」を抽出して `CsvExporter` へ移し、継承を外す

## 設計くらべクイズの4問目

- id: `quiz-collapse-hierarchy`
- 設計A: 上級5の初期コード(`BaseExporter` と `CsvExporter`)、設計B: 上級5の模範解答
- 変更依頼: 上級5の `csv-format` の依頼 → 正解はB
- explanation: 「子が1つしかない継承は、1つの概念を2クラスに分けてしまう。拡張ポイントは、2つ目が必要になってから作れば間に合う」という趣旨

## 受け入れ基準

- `npm run check` が通る
- 既存の全ステージについて、`stageCatalog.test.ts` の「模範解答どおりに操作すると100点になる」が引き続き通る
  (新しいルールが既存の模範解答を減点しないこと。上級1・3の基底クラスは子が2つ以上ある)
- 画面で上級5を開くと、採点の内訳に「子が1つだけの継承 -10」が出る。模範解答の手順どおりに操作すると100点になる
- ヒントの4手目までが日本語の文で表示される(継承の解除を含む)
- 設計くらべに4問目が追加され、`comparisonQuizzes.test.ts` が通る
- E2E: `refactor.spec.ts` に、上級5で `CsvExporter` の継承を右クリックメニューなどの既存UIから外せることを確かめるケースを1つ足す
  (継承を外す操作が画面から実際にできることの保証)

## スコープ外

- 実装が1つしかないインターフェース(implements)の減点(上の「implements を対象にしない理由」を参照)
- Middle Man(横流しするだけのメソッド)の減点
- 戦略が1つしかない Strategy のステージ(implements なので今回のルールでは扱えない)
- 新しいクラスを足して処理を一列の依存(SalesController → X → CsvExporter → BaseExporter)につなぐ近道。
  継承を畳まずに100点になるが、変更依頼の結果では点数が下がる(タブ区切りの依頼で75点)。採点ルールに「散らばり」を
  測る指標がないことによる採点の仕組みの限界で、このステージだけでは塞がない(評価フェーズで判明)

## 未決事項

- なし。継承を外す操作は、既存の右クリックメニュー「継承元を設定」で「(解除)」を選べばできる
  (`CanvasContextMenu.tsx`)。画面の追加は要らない
