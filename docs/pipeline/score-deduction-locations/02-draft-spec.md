# 仕様草案: 採点の減点ごとに、原因のクラス・メソッド名を見せる

- slug: `score-deduction-locations`
- 元: `docs/pipeline/score-deduction-locations/01-discovered.md`

## 1. 背景・目的

- リファクタリング画面の採点は、`StagePanel.tsx` の `data-testid="score"` に出る1行(`70点(行数 -10 / 結合度 -10 / 責務の混在 -10)`)だけである。
  **どのクラス・メソッドが減点の原因か**は画面のどこにも出ていない。キャンバスで分かるのは、行数超過(赤い行数)と循環依存(`cyclic-mark`)の2ルールだけ。
  残りの11ルールは、プレイヤーがクラスを1つずつ見て推理するしかない。中級・上級ステージでは依存の矢印が十数本あり、見当が付かずにヒントを開くことになる。
- この穴は、既存の仕様書で先送りされたまま残っている。
  - `docs/specs/fields-and-feature-envy.md` のスコープ外: 「Feature Envy のメソッドは、ファイルの ⚠ と点数の内訳で伝える」とあるが、内訳にメソッド名が出ないので伝わっていない
  - `docs/specs/interface-segregation-stage.md` の未決事項: `contract` の3種類が1つのルール名で、どれに当たったか分からない
- 今回やること: 減点のあるルールごとに、原因のクラス・メソッド名を採点の1行の下に並べる。
  例: `行数: OrderService.placeOrder()`、`責務の混在: OrderService`
- あわせて、13ルールの一覧が2か所に重複している問題を解消する。今は `score.ts` の `scoreCodebase`(件数)と
  `fileScores.ts` の `fileDeductions`(対象ID)が、同じ `find*` 関数を別々に並べている。
  「ルールごとの違反対象ID」を1か所で求め、件数とファイルごとの減点の両方をそこから出す。

### 調査で分かったこと

- **対象IDの決め方は `fileDeductions` がすでに持っている。** 全ファイルの減点の合計 = `scoreCodebase` の減点の合計、という約束が
  `fileScores.test.ts` にある。つまり、各ルールの「件数」と「帰属先ID」の個数はすでに一致している。
  これをルールごとの配列に分けて持てば、件数は `.length`、ファイルの減点は全配列を平らにしたものになる。
  既存の `find*` 関数は変えずに済む。
- ルールごとの帰属先(今の `fileDeductions` の実装そのまま):

  | ルール | 対象ID | 出る種類 |
  |---|---|---|
  | `line-limit` | `LineLimitViolation.targetId` | メソッド・クラス・ファイル |
  | `coupling` | `findCouplingViolations` の戻り値(依存元クラス) | クラス |
  | `cycle` | 循環している依存の `from` | クラス(循環する依存1本につき1件) |
  | `responsibility` | `ResponsibilityViolation.classId` | クラス |
  | `visibility` | `countedVisibilityViolations` の `callerClassId`(呼んでいる側) | クラス |
  | `empty` | `findEmptyContainers` | クラス・ファイル |
  | `unused` | `findUnusedPrivateMethods` | メソッド |
  | `lone-superclass` | `findLoneSuperclasses` | クラス |
  | `stub` | `findStubMethods` | メソッド |
  | `contract` | `findContractViolations`(実装漏れ・宣言漏れはクラス、インターフェースの外の契約メソッドはメソッド) | クラス・メソッド |
  | `feature-envy` | `FeatureEnvy.methodId`(相手の `enviedClassId` は使わない) | メソッド |
  | `encapsulation` | `EncapsulationViolation.accessorClassId` と `findOpenSetters` | クラス・メソッド |
  | `cohesion` | `LowCohesion.classId` | クラス |

- **`ScoreDeduction` 型は変えない。** 次の理由から、対象IDは `Score` とは別の関数・別の値で渡す。
  - `CritiqueRequest.score` は `Score` をそのまま持つ(`critiqueRequest.ts`)。`workers/critique/src/index.ts` の入力検証は、
    `score.deductions` について `Array.isArray` しか見ていない。要素の未知のキーは弾かれず、`buildPrompt` で
    `JSON.stringify` されてそのままプロンプトに入る。`deductions` に `targetIds` を足すと、次の2つが黙って起きる。
    - 生のID(`method-place-order` など)がAI講評に流れる
    - 本文が長くなり、上級ステージで `MAX_BODY_LENGTH`(20,000文字)の413に近づく
  - `score.test.ts` の多くのケースは `deductions` を `toEqual` で比べている。`reviewBlankDesign.test.ts` や、白紙設計・進捗記録(`useGameStore.ts`)も `Score` を使う。
    型を変えると、これらをすべて直すことになる
  - そのため `workers/critique/` と `critiqueRequest.ts` は**変更しない**
- **変更依頼の実装中(`changeSession` あり)の扱いは、新しい判断が要らない。** `StagePanel` は、点数を `changeSession.base ?? codebase` で数えている。
  「変更依頼に挑戦」は100点のときしか押せないので、実装中の `base` には減点が無く、内訳の一覧は空になる。一覧も同じ `codebase` から出せば足りる。
- E2E は `getByTestId('score')` に `toContainText` / `not.toContainText('責務の混在')` を多用している(`refactor.spec.ts`)。
  名前の一覧を `score` の要素の**中**に入れると、`not.toContainText` の意味が変わるおそれがある。
  そのため、一覧は**別の要素**(`data-testid="score-locations"`)に出す。`score` の1行表示(`describeScore`)の書式も変えない。
  白紙設計の結果画面も `describeScore` を使っているため。

### 本当に新しい仕組みが要るか(ponytail)

- 新しい判定ロジックは要らない。`fileDeductions` の対象IDの並びを、ルールごとに分けて返すだけで足りる。
- 新しいファイルは作らない。関数は `score.ts` に置く。`findCouplingViolations` が `score.ts` にあり、別ファイルにすると `score.ts` との循環importになるため。
- IDから名前を引く処理は、`Codebase.ts` の `findClass`・`findMethod`・`findClassOfMethod` で足りる。
- 名前をクリックしてキャンバスへ移動する機能・ツールチップ・AI講評への連携は作らない(スコープ外)。まず名前が読めれば足りるか、実機で確かめてから足す。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 変更 | `src/domain/scoring/score.ts` | domain | `findViolationTargets` を新設する(4.1)。`scoreCodebase` の `counts` をこれの `.length` から出すよう書き換える。並び順の配列はそのまま |
| 変更 | `src/domain/scoring/score.test.ts` | domain(test) | 4.1 のケースを足す。既存ケースは**変更しない**(回帰の確認) |
| 変更 | `src/domain/scoring/fileScores.ts` | domain | `violatingTargetIds` を `Object.values(findViolationTargets(codebase, stage)).flat()` にする。13個の `find*` の import を消す |
| 変更 | `src/domain/scoring/fileScores.test.ts` | domain(test) | **変更しない**(既存の全ケースがそのまま通ることで、帰属先が変わっていないことを確かめる) |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | `describeScoreLocations` を足す(4.2)。`RULE_LABEL`・`describeScore` は変えない |
| 新規 | `src/presentation/stage/describeScore.test.ts` | presentation(test) | 4.2 のAAAテスト |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `score` の要素の直後に、名前の一覧を出す(5章)。JSDocの「責務の中身は見せない」の方針に、「原因のクラス・メソッド名は見せる」を足す |
| 変更 | `src/index.css` | presentation | 一覧のクラスを1つ足す(`.stage-panel__hint-list` と同じ程度の小さな文字) |
| 変更 | `e2e/refactor.spec.ts` | E2E | 既存の2つのテストに確認を足す(6章) |

次のファイルは**変更しない**。

- `critiqueRequest.ts`・`workers/critique/`
- `FileNode.tsx`・`ClassNode.tsx`
- 各 `find*` のファイル(`lineLimits.ts` など)
- ステージ定義・`sampleAnswer.ts`

点数の値はどのステージでも変わらない。

## 3. データ/型の変更

永続化スキーマの変更は無い。`ScoreRule`・`ScoreDeduction`・`Score` も変えない。

```ts
// src/domain/scoring/score.ts
/**
 * ルールごとの違反の対象ID(メソッド・クラス・ファイルのいずれか)。1要素 = 1件(10点)で、同じIDが複数件なら重複して入る。
 * 件数(scoreCodebase)とファイルごとの減点(fileDeductions)は、どちらもここから出す。
 */
export function findViolationTargets(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced'>,
): Record<ScoreRule, readonly string[]>;
```

- 戻り値は `Record<ScoreRule, …>` にする。`ScoreRule` にルールを足してここに足し忘れると、型エラーになる(3.1)。
- `scoreCodebase` は `const targets = findViolationTargets(codebase, stage)` とし、並び順の配列の各ルールについて `count: targets[rule].length` にする。
- `fileDeductions` は `Object.values(targets).flat()` の各IDを持ち主のファイルに数える(今の `fileIdByTargetId` 以降はそのまま)。
- `Stage` の `Pick<…>` は、`scoreCodebase`・`fileDeductions` と同じものをそのまま書く。型の別名は作らない。
- `StagePanel` では、`scoreCodebase` と `findViolationTargets` の両方を呼ぶので、判定が2回走る。
  `useMemo` の中なので許容する。`FileNode` はファイルごとに `fileDeductions` を呼んでおり、そちらの方が重い。

### 3.1 `duplicate-code-scoring`・`inline-method-stage` との関係

2つのパイプライン(どちらも `02-draft-spec.md` まで完了、`src/` には未反映)は、どちらも `ScoreRule` の末尾に1ルールを足す。
足す場所は次の5か所。

- `ScoreRule` のユニオン
- `counts`
- 並び順の配列
- `RULE_LABEL`
- `fileDeductions` の `violatingTargetIds`

本機能を入れると、このうち `counts` と `violatingTargetIds` が `findViolationTargets` の1か所にまとまる。足す場所は4か所に減る。

- どちらの新ルールも `string[]`(メソッドIDの並び)を返す。そのため `findViolationTargets` には `'duplicate-code': findDuplicateCopies(codebase)` の形で1行足すだけで入る。
  帰属先(2つ目以降のコピーのメソッド、分けすぎたメソッド)は、2つの仕様のとおりに変わらない。
- 本機能のテストは、ルールの数や位置に依存しない形で書く(4.1)。そのため、どちらが先に入っても本機能のテストは書き換え不要。
- **実装順序は未決事項1で決める**(推奨: 2件のマージ後に実装に入る)。
  - 推奨案で進める場合、実装者は実装開始時点の `main` の `ScoreRule` を**すべて** `findViolationTargets` に入れる
    (`Record` 型なので、足し忘れは型チェックで分かる)。
  - 2件の追加ルールの名前の出方も、4.2 のテストに1ケースずつ足す(メソッド名で出ること)。

### 3.2 IDから表示名への変換(presentation)

| 対象IDの種類 | 表示 | 例 |
|---|---|---|
| ファイル | `file.path` | `src/tax/TaxCalculator.ts` |
| クラス | `codeClass.name` | `OrderService` |
| メソッド | `<クラス名>.<メソッド名>()` | `OrderService.placeOrder()` |
| 見つからないID | 出さない | — |

- 1ルールの中で同じ名前が複数回出る場合は、1回だけ出す(`[...new Set(names)]`)。
  例: 循環する依存を2本持つクラス、実装漏れが2つあるクラス。件数は1行表示の `-20` で分かる。
- 並びは、そのルールの対象IDの出現順(= コードベースの走査順)にする。並べ替えない。
- 見せないもの(未決事項3の推奨案):
  - Feature Envy の相手クラス名(移し先の答えそのもの)
  - 責務の混在の責務の種類(`StagePanel` の既存方針)
  - カプセル化の破れのフィールド名
  - `contract` の3種類の区別

## 4. TDD対象の純粋関数

### 4.1 `findViolationTargets`(`score.test.ts` に `describe('findViolationTargets')` を足す)

テストは AAA で書く。フィクスチャは、`score.test.ts` の `codebaseOf` と `sampleCodebase` を使う。
`fileScores.test.ts` の小さなコードベースを写して使ってもよい。

1. 正常系: 違反が無ければ、全ルールが空配列。
   `Object.values(targets).every((ids) => ids.length === 0)` で確かめ、**ルールの数を書かない**
   (他パイプラインで増えても書き換えなくてよいように)
2. 正常系(行数): `sampleCodebase` をメソッドの上限20で採点すると、`line-limit` は `placeOrder` のメソッドIDを含む。
   クラス・ファイルの上限を小さくすると、クラスIDとファイルIDも含む
3. 正常系(結合度・循環依存): `codebaseOf({ A: ['method-B'], B: ['method-A'] })` を `dependencyLimit: 0` で採点すると、
   `coupling` と `cycle` がそれぞれ `['class-A', 'class-B']`(依存元のクラス)
4. 正常系(同じIDの重複): A↔B と A↔C の2つの循環では、`cycle` に `class-A` が2回入る(件数を正しく数えるため、重複を除かない)
5. 正常系(Feature Envy): 対象はメソッドID。相手のクラスIDは含まない
6. 正常系(カプセル化): 他クラスのフィールドを書き換えたクラスのIDと、公開された setter のメソッドIDの両方が `encapsulation` に入る
7. 正常系(約束違反): 実装漏れはクラスIDになる。インターフェース役でないクラスの、public で `fragments: []` のメソッドはメソッドIDになる
8. 正常系(アクセス制御): 呼んでいる側のクラスIDになる。`visibilityEnforced` が無いときは、private の越境を含まない
9. **件数の一致(本機能の約束)**: 違反が多いコードベースと厳しい stage で採点する。
   ここで `sampleCodebase` に上限0・`dependencyLimit: 0`・`responsibilityLimit: 0` を与える。
   すべての `deduction` について `targets[deduction.rule].length === deduction.count` が成り立つ。
   `scoreCodebase(...).deductions` をループして確かめ、ルール名を列挙しない

`空`・`未使用`・`子が1つだけの継承`・`空実装`・`凝集度`・`責務の混在` は、`find*` の戻り値をそのまま(または `classId` を)入れるだけである。
そのため、個別のケースは必須にしない。9 の一致テストと、`fileScores.test.ts` の既存ケース(ファイルへの帰属)で守る。

既存の `score.test.ts` と `fileScores.test.ts` は**一切変えずに通ること**。これは書き換え前後で結果が同じことの回帰テストになる。

### 4.2 `describeScoreLocations`(`src/presentation/stage/describeScore.ts`、テストは新規 `describeScore.test.ts`)

```ts
/** 減点のあるルールごとに「<ルール名>: <名前>、<名前>」の1行を、score.deductions の並びで返す。減点が無ければ []。 */
export function describeScoreLocations(
  codebase: Codebase,
  score: Score,
  targets: Readonly<Record<ScoreRule, readonly string[]>>,
): string[];
```

- `score.deductions` のうち `points > 0` のものについて、`targets[rule]` の各IDを 3.2 の表で名前にする。
  名前は `、` でつなぎ、`${RULE_LABEL[rule]}: ${names}` にする。
- 名前が1つも引けなかったルールは、行ごと出さない。
- IDを名前にする小さな関数(3.2 の表)は、同じファイルの非公開関数にする。

テストケース(AAA、`sampleCodebase` と `scoreCodebase`・`findViolationTargets` を実際に呼ぶ):

1. 正常系: `sampleCodebase` をメソッドの上限20・責務の上限2で採点すると、次の3行をこの順で返す
   - `行数: OrderService.placeOrder()`
   - `責務の混在: OrderService`
   - `空のクラス・ファイル: TaxCalculator`
2. 正常系: 違反が無ければ `[]`
3. 正常系(ファイル): クラスが1つも無いファイルは、`空のクラス・ファイル: <path>` になる
4. 正常系(重複の除去): 同じクラスが2件あるルール(4.1 の4の循環)は、名前を1回だけ出す(`循環依存: A、B、C` のように)
5. 除外: `points` が0のルールは出さない。`targets` に無いIDが入っていても例外にせず、その名前を出さない

## 5. 画面(`StagePanel.tsx`)

- `score` を出す `<div data-testid="score" aria-live="polite">` の**直後**に、一覧を出す(未決事項2の推奨案)。
  - 要素は `<ul className="stage-panel__locations" data-testid="score-locations" aria-label="減点の原因">`
  - `describeScoreLocations` の各行を `<li>` で出す
  - 一覧が空(満点)のときは、要素ごと出さない
- 一覧は `aria-live` の**外**に置く。操作のたびに一覧まで読み上げると長いため。読み上げは今の1行のまま。
  スクリーンリーダーの利用者は、`aria-label="減点の原因"` のリストとしてたどれる。
- 表示に使う `codebase` は、点数と同じ `changeSession?.base ?? codebase` にする(1章「調査で分かったこと」)。
- `CritiquePanel`・`HintPanel` の呼び出し行は動かさない。
  `critique-request-robustness`・`stage-draft-persistence` との競合を、`score` の要素の直後に数行足すだけに抑えるため。
- `.stage-panel__status` は `white-space: nowrap` なので、一覧は別のクラスにする。
  文字の大きさ・色は `.stage-panel__hint-list` に合わせる(`font-size: 12px; color: var(--muted)`、`margin`・`padding-left` は控えめ)。

## 6. 受け入れ基準

1. `findViolationTargets` に 4.1 のケースがあり、AAAのユニットテストが通る。特に「全ルールで `targets[rule].length === count`」を確かめる
2. `scoreCodebase` と `fileDeductions` が `findViolationTargets` から件数・対象IDを出している。
   `fileScores.ts` から13個の `find*` の直接呼び出しが無くなり、ルールの一覧は `findViolationTargets` の1か所だけになる
3. 既存の `score.test.ts`・`fileScores.test.ts`・ステージのテスト(`stageCatalog.test.ts` など)が、**期待値を変えずに**通る
4. `describeScoreLocations` に 4.2 のケースがあり、テストが通る
5. リファクタリング画面で、減点のあるルールごとに `<ルール名>: <クラス・メソッド名>` の行が、`data-testid="score-locations"` に出る。
   満点では一覧が出ない。`data-testid="score"` の1行表示は、文言も `aria-live` も今のまま
6. E2E(`e2e/refactor.spec.ts`)。新しいテストは作らず、既存の2つに確認を足す
   - 「初期状態の点数は、行数の上限を超えた placeOrder・…」(チュートリアル2): `score-locations` に次の3つが含まれる
     - `行数: OrderService.placeOrder()`
     - `責務の混在: OrderService`
     - `空のクラス・ファイル: TaxCalculator`
   - 「税の計算を抽出して TaxCalculator へ移すと、責務の混在の減点が消える」: 移したあと、`score-locations` に次の2つが**含まれない**
     - `責務の混在`
     - `空のクラス・ファイル`
7. `workers/critique/`・`critiqueRequest.ts`・`ScoreDeduction` 型に変更が無い(AI講評の入力の形が変わらない)
8. `npm run check` と `npm run test:e2e` が通る。`domain` のカバレッジ閾値を割らない

## 7. スコープ外

- 一覧の名前をクリックして、キャンバスをそのクラスへ寄せる・メソッドエディタを開く(`selectMethod` で足せる。実機で「名前だけでは探せない」と分かってから足す)
- ファイルの ⚠️(`FileMark`)にルール別の内訳をツールチップで出す(`findViolationTargets` があれば数行で足せる。01 の2段目の候補)
- 白紙設計の結果画面(`BlankDesignResultPanel.tsx`)・設計くらべクイズへの同じ一覧の表示
- AI講評の入力(`critiqueRequest.ts`)にルールごとの対象を渡すこと(`workers/` のプロンプト変更を伴う)
- `contract` を3種類のルールに分ける・種類ごとの説明を出すこと(クラス名/メソッド名が出るだけでも、どこを見ればよいかは分かる)
- Feature Envy・行数超過以外のルールに、キャンバス上の印(`CyclicMark` のようなもの)を足すこと
- `ScoreDeduction`・`Score` の型の変更、`find*` 関数の戻り値の変更
- 点数の計算結果の変更(どのステージも点数は変わらない)

## 未決事項

### 未決事項1: `duplicate-code-scoring`・`inline-method-stage` との実装順序をどうするか

- 選択肢A(推奨): この2件がマージされてから実装に入る。
  - 本機能は何ルールでも同じ設計で、テストもルール数に依存しない(3.1)。そのため待つコストは「まとめる対象が15ルールになる」だけ
  - 2件の仕様書を書き換えずに済む
  - どちらかが長く止まった場合は、止まっている方を待たずに進めてよい。その場合、残った方は選択肢Bの読み替えで入れる
- 選択肢B: 先にこちらを入れる。2件の最終仕様(`04-final-spec.md`)を書く時点で、次の手順を読み替えてもらう。
  - 読み替え前: 「`counts` と `fileDeductions` の `violatingTargetIds` に1行ずつ足す」
  - 読み替え後: 「`findViolationTargets` の `Record` に1行足す」
  - 足すファイルが1つ減るが、他パイプラインの仕様に手を入れる調整が要る
- 選択肢C: 順序を決めず並行で進める。後からマージする側が rebase で `score.ts`・`fileScores.ts` の衝突を解く。
  衝突は「一覧のまとめ直し」と「一覧への追記」の組になるため、機械的には解けず、実装者の判断が要る

### 未決事項2: 名前の一覧をどう見せるか

- 選択肢A(推奨): 採点の1行の直下に、常に開いた一覧(`<ul>`)で出す。
  - 操作のたびに、どこが直ったかがすぐ見える
  - 読み上げは1行表示のまま(一覧は `aria-live` の外)
- 選択肢B: `<details>`(「どこが減点?」)に入れ、最初は閉じておく。
  - 自分で探したいプレイヤーは開かずに済む
  - 答えに近い情報をワンクッション置ける
  - ただし「見当が付かずにヒントを開く」という今の状態と、手間が大きく変わらない
- 選択肢C: `<details>` に入れ、最初から開いておく(ステージの説明と同じく `key={stage.id}` で開き直す)。畳みたい人だけ畳める

### 未決事項3: 答えに近い情報をどこまで出すか

- 選択肢A(推奨): 原因のクラス・メソッド・ファイルの名前だけを出す。次の情報は出さない。
  - Feature Envy の相手クラス(移し先)
  - 責務の種類
  - カプセル化の破れのフィールド名
  - `contract` の種類

  「どこが悪いか」は教えるが、「どう直すか」は自分で考えさせる。
- 選択肢B: Feature Envy だけ相手クラスも出す(`Invoice.calculateTotal() → Customer のデータ`)。
  - AI講評(`enviedClassName`)ではすでに渡している情報
  - ただし、移し先がそのまま答えになる
- 選択肢C: カプセル化の破れはフィールド名も出す(`OrderService(Account.balance)`)。
  - どのフィールドかが分かる
  - `findEncapsulationViolations` の `fieldId` を別に持つ必要があり、`Record<ScoreRule, readonly string[]>` の形では足りなくなる

### 未決事項4: 循環依存をどう出すか

- 選択肢A(推奨): 依存元のクラス名を並べる(`循環依存: Order、Customer`)。
  - ファイルの減点と同じ帰属先なので、`findViolationTargets` の形のまま出せる
  - キャンバスの `cyclic-mark` とも同じクラスを指す
- 選択肢B: 依存の組で出す(`循環依存: Order → Customer、Customer → Order`)。
  - 向きまで分かる
  - 循環依存だけ `from`/`to` の組を別に持つ必要があり、表示の関数に特別扱いが1つ増える
