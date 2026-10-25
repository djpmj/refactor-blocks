# clear-condition-line-split: クリア条件の「行数」をメソッド・クラス・ファイルの3行に分ける

## 背景・目的

左のサイドバーのクリア条件(`ClearConditionList`)では、行数の条件が1行にまとまっている。

- 目標: `行数: メソッド17行・クラス34行・ファイル35行以内`
- 今の値(未達成のとき): `今: メソッド最大21行・クラス最大43行・ファイル最大43行`

そのため、メソッド・クラス・ファイルのどれが上限を超えていて、どれはもう達成しているのかが分からない。
メソッドだけ直せば済むのか、クラスやファイルも分けないといけないのかを、条件の行を見て判断できるようにしたい。

そこで、行数の条件を「メソッドの行数」「クラスの行数」「ファイルの行数」の3行に分け、それぞれ達成・未達成を出す。
採点(`line-limit` の減点)は今のまま1つのルールで、**表示の分け方だけを変える**。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/clearConditions.ts` | domain | `ClearCondition` に `lineKind` を足し、`line-limit` を3つに分けて返す。条件の識別子 `clearConditionKey` を足す |
| 変更 | `src/domain/stage/clearConditions.test.ts` | domain | 上の期待値を書く(先に書く) |
| 変更 | `src/presentation/stage/describeCondition.ts` | presentation | 種類ごとの目標・今の値の文にする |
| 変更 | `src/presentation/stage/describeCondition.test.ts` | presentation | 上に合わせて期待値を書き換える(先に書く) |
| 変更 | `src/presentation/stage/ClearConditionList.tsx` | presentation | 行の `key`・「達成した瞬間」の追跡を `rule` から `clearConditionKey` に変える |
| 変更 | `e2e/sidebar-structure.spec.ts` | E2E | 達成数・未達成数を新しい件数に合わせ、行数が3行に分かれることを確かめる |

`application` / `infrastructure` は変更しない(ステージ定義・採点・`conditionNotes` はそのまま)。
`src/domain/scoring/` も変更しない。`scoreCodebase` が返す `line-limit` の減点(`count` は違反の総数)はそのまま使う。

## データ・型の変更

```ts
// src/domain/stage/clearConditions.ts
export type LineKind = 'method' | 'class' | 'file';

export type ClearCondition = {
  readonly rule: ScoreRule;
  readonly count: number;
  /** `rule === 'line-limit'` の行だけ入る。メソッド・クラス・ファイルのどれの行数かを表す */
  readonly lineKind?: LineKind;
};

/** 条件を一意に表す識別子。`line-limit` は `line-limit:method` のように種類を足す。その他は `rule` そのまま */
export function clearConditionKey(condition: Pick<ClearCondition, 'rule' | 'lineKind'>): string;

export function clearConditions(
  initial: Score,
  current: Score,
  lineViolations: readonly Pick<LineLimitViolation, 'kind'>[],
): ClearCondition[];
```

- 第3引数 `lineViolations` は `findLineLimitViolations(codebase, stage.limits)` の結果。種類ごとの違反数 `count` を数えるのに使う
- `line-limit` は、採点順の中の元の位置に、`method` → `class` → `file` の順で3つ並べて返す(常時表示なので、違反がなくても3つとも返す)
  - `{ rule: 'line-limit', lineKind: 'method', count: <メソッドの違反数> }`、`class`・`file` も同様
- `line-limit` 以外の条件の形は今と同じ(`lineKind` は付けない)
- `current` の `line-limit` の `count` は使わず、違反の一覧から数える(3種類の合計は元の `count` と一致する)
- `ALWAYS_SHOWN_RULES`・`worstMeasures`・`WorstMeasures` は変えない

## 動きの仕様

### 条件の行

- 行数の条件が、次の3行になる(`stage.limits` の値を入れる)。並びは今の「行数」の位置に、メソッド・クラス・ファイルの順
  - `メソッドの行数: 1つ17行以内`
  - `クラスの行数: 1つ34行以内`
  - `ファイルの行数: 1つ35行以内`
- 未達成の行の2行目の「今の値」は、その種類の最大だけを出す
  - `今: 最大21行`
  - 今の `今: メソッド最大21行・クラス最大43行・ファイル最大43行` のような、3種類を `・` でつないだ文はなくす
- 達成済みの行は、今と同じく目標だけを出し、「今の値」は出さない
- `li` の `aria-label` は今の形式のまま(`達成: <goal>` / `未達成: <goal> (<current>)`)。既存E2Eが `li[aria-label^="達成:"]` などで数えているため
- 丸バッジ・行の色・「達成した瞬間」の弾みの見た目は変えない

### 達成数と「達成した瞬間」

- 見出しの `N/M 達成` は、分けた行を1件ずつ数える(行数の条件が1件から3件に増えるので、`M` が2増える)
- 「達成した瞬間」の弾み(`clear-condition--just-met`)・行の `key` は、`rule` ではなく `clearConditionKey` で追跡する
  (そのままだと3行が同じ `line-limit` になり、1つ達成したら3行とも弾んでしまうため)
- 「悪化したら弾みを消す」「ステージを開いた直後・切り替え・最初に戻す・元に戻す(やり直し)では付けない」の今の挙動は、そのまま `clearConditionKey` 単位で保つ
- `stage.conditionNotes` は `rule` で引いたままにする(`line-limit` の理由を持つステージはない。持つようになったら3行すべてに出る)

## TDD対象

### `clearConditionKey`(domain)

- `{ rule: 'line-limit', lineKind: 'method', count: 1 }` → `'line-limit:method'`
- `{ rule: 'coupling', count: 0 }` → `'coupling'`(`lineKind` が無ければ `rule` そのまま)

### `clearConditions`(domain)

既存のテストの期待値を書き換えてから実装する。第3引数は `[{ kind: 'method' }, { kind: 'method' }, { kind: 'class' }]` のような違反の一覧。

- `line-limit` の違反が `method` 2件・`class` 1件 → `line-limit` が `{ lineKind: 'method', count: 2 }`・`{ lineKind: 'class', count: 1 }`・`{ lineKind: 'file', count: 0 }` の3件で返る
- 違反がまったくない → `line-limit` は `count: 0` の3件で返る(常時表示)
- `line-limit` の3件は、`coupling`・`responsibility` など他の条件より前の、採点順の位置に並ぶ
- 任意ルール(`visibility` など)の出し分け(初期か現在のどちらかで違反があれば出す)は今のまま

### `describeCondition`(presentation)

既存のテストの期待値を書き換えてから実装する。

- `{ rule: 'line-limit', lineKind: 'method', count: 0 }` → `{ goal: 'メソッドの行数: 1つ50行以内', current: null }`
- `{ rule: 'line-limit', lineKind: 'class', count: 2 }`、`measures.class = 200` → `{ goal: 'クラスの行数: 1つ120行以内', current: '今: 最大200行' }`
- `lineKind: 'file'` でも同様(`ファイルの行数: 1つ300行以内`)
- 結合度・責務の混在・件数だけのルール・循環依存の文は変えない

「達成した瞬間」の判定は表示の状態(前回の表示との比較)なので、コンポーネントの中に置き、E2E で確かめる。

## 受け入れ基準

1. チュートリアル2を開くと、クリア条件に `メソッドの行数`・`クラスの行数`・`ファイルの行数` の3行が並び、`行数: メソッド…・クラス…・ファイル…以内` の1行は出ない
2. 上限を超えている種類の行だけが未達成になり、2行目に `今: 最大<その種類の最大行数>行` が出る。超えていない種類の行は達成済みになり、「今の値」は出ない
3. メソッドの行数が上限以内になった操作では、`メソッドの行数` の行だけに `clear-condition--just-met` が付き、クラス・ファイルの行には付かない(他の種類が最初から達成済みでも付かない)
4. 見出しの `N/M 達成` が、分けた行数の3行を含めて数える(分ける前の `M` より2増える)。3行がすべて達成なら、その3行は達成数に3件入る
5. 100点にすると、行数の3行を含めてすべての行が達成済みの見た目になる
6. 結合度・責務の混在・循環依存・空・未使用などの条件の表示は変わらない。`conditionNotes`(理由)も今までどおり出る
7. `e2e/sidebar-structure.spec.ts` の `1/4 達成`・未達成3件などの件数は、行数を3行に分けた後の実際の件数に書き換える
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 採点(`line-limit` の減点・点数の計算)の変更。減点は今までどおり1つのルールのまま
- 条件の行をクリックして、超えているメソッド・クラス・ファイルの場所へ飛ぶ操作
- ステージごとに上限の値を変えること(`stage.limits` はそのまま使う)
- ヒント・サイドバーのほかの欄の見た目
