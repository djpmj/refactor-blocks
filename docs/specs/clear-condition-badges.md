# clear-condition-badges: クリア条件の達成・未達成を丸バッジと行の色で分かりやすくする

## 背景・目的

左のサイドバーの「クリア条件」(`ClearConditionList`)は、行頭に黒い文字の `✓` / `✗` を出し、未達成の今の値を
`(今: メソッド最大21行・…)` と同じ行の末尾に続けているだけである。
そのため、次の点が分かりにくい。

- どれが達成済みでどれが未達成か、ひと目で見分けられない(記号が小さく、色も同じ)
- 目標と今の値が1行に混ざっていて、どこまで減らせばよいかが読み取りにくい
- 何件中何件を達成したかが分からない

そこで、丸いバッジと行の背景色で達成・未達成を見せ、目標と今の値を2行に分ける。見出しには達成数を出す。
さらに、操作によって未達成から達成に変わった瞬間に、その行のバッジを弾ませて手応えを出す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/stage/describeCondition.ts` | presentation | 目標の文と今の値の文を分けて返す |
| 変更 | `src/presentation/stage/describeCondition.test.ts` | presentation | 上に合わせて期待値を書き換える(先に書く) |
| 変更 | `src/presentation/stage/ClearConditionList.tsx` | presentation | 丸バッジ・行の色・2行表示・達成数・達成した瞬間の演出 |
| 変更 | `src/index.css` | presentation | `.clear-conditions` まわりのスタイルと `@keyframes` |
| 変更 | `e2e/sidebar-structure.spec.ts` | E2E | 達成数の表示と、達成した行のクラスを確かめる |

`domain` / `application` / `infrastructure` は変更しない(判定は既存の `clearConditions` / `worstMeasures` をそのまま使う)。

## データ・型の変更

```ts
// src/presentation/stage/describeCondition.ts
export type ConditionDescription = {
  /** 目標。例: '行数: メソッド17行・クラス34行・ファイル35行以内' */
  readonly goal: string;
  /** 未達成のときの今の値。例: '今: メソッド最大21行・クラス最大43行・ファイル最大43行'。達成済みなら null。 */
  readonly current: string | null;
};

export function describeCondition(
  condition: ClearCondition,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
  measures: WorstMeasures,
): ConditionDescription;
```

- `goal` は今の `describeRule` の文字列そのまま
- `current` は今の `describeStatus` から前後の ` (` `)` を除いたもの。件数だけのルールは `今: 2件`(今の `今2件` にコロンを足して他と揃える)
- 戻り値の型が変わるので、呼び出し元(`ClearConditionList` だけ)を合わせて直す

## 見た目・動きの仕様

### 見出し

- `クリア条件` の右に、達成数を `N/M 達成` と小さめのバッジで出す(`data-testid="clear-conditions-progress"`)。全件達成なら `--success` の色にする

### 各行

- `ul` の行頭の点(`list-style`)と左の余白はなくし、各行を角丸の帯(`padding: 6px 8px`、行どうしの間隔 4px)にする
- 行の左に直径18px程度の丸いバッジを置き、右に文を置く(`display: flex; gap: 8px; align-items: flex-start`)
- 未達成の行(クラス `clear-condition--unmet`)
  - 背景は `color-mix(in srgb, var(--danger) 8%, var(--surface))`
  - バッジは `var(--danger)` の枠線(2px)で、中に `var(--danger)` の `✗`
  - 1行目に `goal`、2行目に `current` を `var(--danger)` の文字色・少し小さめで出す
- 達成済みの行(クラス `clear-condition--met`)
  - 背景は `color-mix(in srgb, var(--success) 10%, var(--surface))`
  - バッジは `var(--success)` で塗りつぶし、中に白い `✓`
  - `goal` だけを出す
- バッジの記号は今どおり `aria-hidden="true"`。`li` の `aria-label` は今と同じ `達成: <goal>` / `未達成: <goal> (<current>)` の形にする
  (既存の E2E が `li[aria-label^="達成:"]` / `li[aria-label^="未達成:"]` で数えているため)
- ライトテーマ・ダークテーマの両方で、文字が背景に対して読めること

### 未達成から達成に変わった瞬間の演出

- 同じステージの中で、ある条件が未達成から達成に変わったとき、その行にクラス `clear-condition--just-met` を付け、
  バッジが `scale(0.6 → 1.25 → 1)` と弾み、行の背景が一瞬濃い緑から薄い緑に戻る(約600ms)
- ステージを開いた直後・ステージを切り替えた直後・「最初に戻す」の直後に最初から達成している条件には付けない(前回の表示と比べて、変わったものだけに付ける)
- アニメーションが終わったら(`animationend`)クラスを外す。続けて別の条件が達成されたら、その行にも付く
- `@media (prefers-reduced-motion: reduce)` ではアニメーションを止める(色の変化だけにする)

## TDD対象の純粋関数

### `describeCondition`(`presentation/stage/describeCondition.ts`)

既存の `describeCondition.test.ts` の期待値を、新しい戻り値に書き換えてから実装する。

- 達成済み(`count: 0`): 行数 → `{ goal: '行数: メソッド50行・クラス120行・ファイル300行以内', current: null }`。結合度・責務の混在も `current: null`
- 未達成の行数: `{ goal: '行数: …以内', current: '今: メソッド最大84行・クラス最大200行' }`(計測できた値だけを `・` でつなぐ)
- 未達成の結合度: `current: '今: 最大3クラス'`
- 未達成の責務の混在: `current: '今: 最大4種類'`
- 件数だけのルール(例: `visibility`、`count: 2`): `{ goal: 'アクセス制御: 0件にする', current: '今: 2件' }`

未達成から達成に変わった条件の判定は、表示の状態(前回の表示との比較)なので、コンポーネントの中に置き、E2E で確かめる。

## 受け入れ基準

1. チュートリアル2を開くと、見出しの横に `<達成した数>/<条件の数> 達成` が出て(未達成は3件)、未達成の行は薄い赤の背景・赤枠の丸に `✗`、2行目に赤字で `今: …` が出る
2. 達成済みの行は、薄い緑の背景・緑で塗りつぶした丸に白い `✓` で、`今: …` の行は出ない
3. 操作で条件を1つ達成すると、その行に `clear-condition--just-met` が付いて弾み、達成数が1増える。ステージを開いた直後に最初から達成している行には付かない
4. 100点にすると、すべての行が達成済みの見た目になり、達成数のバッジが緑になる
5. `li` の `aria-label` は今と同じ形式で、既存の `e2e/sidebar-structure.spec.ts` の数え方がそのまま通る。上の1〜4を確かめるケースを足す
6. `prefers-reduced-motion: reduce` では弾むアニメーションが動かない
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- クリア条件の判定・並び順の変更(`domain/stage/clearConditions.ts` には手を入れない)
- 条件の行をクリックして違反の場所へジャンプする操作
- 全件達成したときの専用の演出(スコアの100点の演出が既にあるため)
- ヒント・困っていることなど、サイドバーのほかの欄の見た目
