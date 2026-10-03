# 「やりすぎ」検知(極小メソッド・極小クラスの減点)

## 背景・目的

`docs/feature-ideas/IDEAS.md`(2026-10-03)の案7。今の採点ルールは、行数・結合度・責務の混在など「分けていない・まとめすぎている」方向にしか減点しない。そのため「とにかく Extract Method / Move Class で分ければ点が良くなる」という誤った癖がつきやすい。

実務では、1〜2行しかない処理をわざわざメソッドに切り出したり、メソッドが1つしかない極小クラスを量産したりすると、呼び出しを1段たどる手間が増えるだけで可読性も保守性も上がらない(過剰な Extract Method / Extract Class)。採点に「分けすぎ」の軸を1つ足すことで、「分ければ良いわけではなく、粒度にはバランスがある」ことを、プレイ中に自然に学べるようにする。

### 設計判断(対話で確定済み)

- **適用範囲**: 既存ステージ全部に常時適用する横断ルールとする。ステージごとのオプション項目(例: `visibilityEnforced?`)にして専用ステージだけで有効にする案もあったが、後述の調査で既存ステージの模範解答・テストに該当するコードがないことを確認できたため、素直に全ステージ共通ルールにする。
- **検知対象**: 「1〜2行だけの極小メソッド」と「メソッドが1つだけの極小クラス」の両方を、別々の採点ルールとして数える(`trivial-method` / `thin-class`)。
- **専用の新ステージは追加しない**(YAGNI)。ルールが全ステージに常時適用されるため、プレイヤーがどのステージで極小メソッド・極小クラスを作っても自然に減点され、専用ステージを新規設計するコストをかけずに同じ学びが得られる。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/scoring/overExtraction.ts` | domain | 新規 | `findTrivialMethods`・`findThinClasses`・`TRIVIAL_METHOD_MAX_LINES` |
| `src/domain/scoring/overExtraction.test.ts` | domain | 新規 | 上記のテスト |
| `src/domain/scoring/responsibilities.ts` | domain | 変更 | `CALL_RESPONSIBILITY` を `export` する(呼び出し行だけのメソッドを `overExtraction.ts` から除外するため。既存の動作は変えない) |
| `src/domain/scoring/score.ts` | domain | 変更 | `ScoreRule` に `'trivial-method'`・`'thin-class'` を足し、`scoreCodebase` で数える |
| `src/domain/scoring/score.test.ts` | domain | 変更 | 新ルールの減点ケースを足す。既存テストの中で、依存関係・結合度などの検証専用に使っている「1行だけのダミー処理」フィクスチャ(`codebaseOf` など)が新ルールで意図せず減点されないよう、行数を増やすなど調整する(検証したい観点は変えない) |
| `src/domain/scoring/fileScores.ts` | domain | 変更 | `findTrivialMethods`・`findThinClasses` の対象IDを `violatingTargetIds` に足す |
| `src/domain/scoring/fileScores.test.ts` | domain | 変更 | 同上。既存フィクスチャの調整も `score.test.ts` と同様に必要なら行う |
| `src/presentation/stage/describeScore.ts` | presentation | 変更 | `RULE_LABEL` に2件足す |

実装メモ: `ScoreRule` を網羅している箇所(`Record<ScoreRule, …>` や、各ルールを switch/map している箇所)は型チェックで漏れが分かる。`src/domain/critique/critiqueRequest.ts` は `Score` 型をそのまま転送しているだけなので変更不要(確認済み)。

## データ/型の変更

- `ScoreRule`(`src/domain/scoring/score.ts`)に `'trivial-method'` と `'thin-class'` を追加する(既存の並びの末尾、`'cohesion'` の後ろに置く)。
- `src/domain/scoring/responsibilities.ts` の `CALL_RESPONSIBILITY`(今はモジュール内だけの `const`)を `export const` にする。値・意味は変えない。

## TDD対象の純粋関数

### `findTrivialMethods(codebase: Codebase): string[]`(`src/domain/scoring/overExtraction.ts`)

実際の処理はあるが、合計 `TRIVIAL_METHOD_MAX_LINES`(= 2)行以下しかないメソッドのIDを返す。getter/setter(`accessor: true`)・空実装(`isStubMethod`)・呼び出し行だけ(全 `fragments` の `responsibility` が `CALL_RESPONSIBILITY`)のメソッドは対象外にする。

- 正常系: 1行の処理が1つだけのpublicメソッド → 返す
- 正常系: 1行の処理が2つ(合計2行)のメソッド → 返す
- 正常系: 3行以上の処理を持つメソッド → 返さない
- 境界: `fragments: []`(インターフェースの契約宣言・抽象メソッド) → 返さない
- 境界: `stub: true` のメソッド(空実装) → 返さない(既存の `stub` ルールと重複カウントしない)
- 境界: `accessor: true` のメソッド(getter/setter) → 返さない
- 境界: 全 `fragments` が `responsibility: 'call'`(Extract Method後の呼び出し行だけ、または依存関係検証用の最小フィクスチャ) → 返さない
- 正常系: `call` の処理(1行)と実処理(1行)が1つずつで合計2行(すべてが`call`ではない) → 返す

### `findThinClasses(codebase: Codebase): string[]`(`src/domain/scoring/overExtraction.ts`)

メソッドがちょうど1つ・フィールドが0個で、その1つのメソッドが `findTrivialMethods` の条件を満たすクラスのIDを返す。

- 正常系: メソッド1つ(極小)・フィールド0個 → 返す
- 正常系: メソッド1つだが30行(極小でない) → 返さない
- 正常系: メソッド1つ(極小)だがフィールドが1つ以上ある(値を保持する役目がある) → 返さない
- 正常系: メソッドが2つ以上ある → 返さない
- 境界: メソッドが0個(空クラス) → 返さない(`findEmptyContainers` の担当)

### `scoreCodebase`(`src/domain/scoring/score.ts`)

- 極小メソッドが1つあると `trivial-method` の減点が10点になる
- 役割の薄い極小クラスが1つあると `thin-class` の減点が10点になる
- 両方の条件を同時に満たすクラス(メソッド1つだけでそのメソッドも極小)は、2つのルールでそれぞれ1件として数える(メソッド単体の問題とクラス単体の問題は別の軸として扱う。他のルールも軸ごとに独立して10点ずつ減点する方式のため、それに合わせる)

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- 既存の全ステージについて、`stageCatalog.test.ts` の「模範解答どおりに操作すると100点になる」が引き続き通る(新ルールが既存の模範解答を減点しないこと)
- 画面でプレイ中、1〜2行の極小メソッドを量産する・メソッドが1つだけの極小クラスを作る、のいずれかを行うと、採点の内訳に「極小メソッドの量産」「役割の薄い極小クラス」の減点がそれぞれ表示される
- AI講評(`CritiqueRequest`)は既存の `score`(減点内訳を含む)をそのまま渡しているため、追加の実装なしに新ルールの減点も講評の入力に含まれることを確認する(コード変更は不要)

## スコープ外

- 専用の新ステージの追加(対話で「追加しない」を確定。全ステージ共通ルールとして適用することで同じ学びを狙う)
- 「許容件数を超えた分だけ減点する」といった閾値付きの方式(IDEAS.mdの「増えすぎた場合」という書き方より単純にした。既存の全ルールと同じ、1件ごとに10点減点する方式に揃える。閾値方式が要ると後で分かったら別仕様で追加する)
- `findEmptyContainers`(空のクラス・ファイル)・`findUnusedPrivateMethods`(未使用private)との統合・置き換え(別ルールとして独立に残す)
- Middle Man(横流しするだけのメソッド)のような、呼び出し元を直接つなぎ替える操作が必要な減点(`lone-superclass-scoring.md` で既にスコープ外とされている理由と同じ: ゲーム内で直す手段がない)

## 未決事項

なし。対話(`AskUserQuestion`)で、適用範囲・検知対象・専用ステージの有無をすべて確定済み。
