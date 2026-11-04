# clear-condition-total-stable: クリア条件の「達成 n/m」の分母 m が操作中に増えたり減ったりする

## 症状

実機で次のように分母が変わり、「あと何個で全部達成か」が読み取れない。

- 中級3「越境する private メソッド」: 開いた直後は `3/6 達成`。renderTemplate を NotificationService へ移すと TemplateEngine が空になり、`6/7 達成` になる(分母が 6 → 7)
- 中級11「Controller に全部書いてある注文API」: `1/7` → `1/6` → `2/7` → `2/6` と行き来する。空のクラスができたり消えたりするたびに、「空のクラス・ファイル: 0件にする」の行が出たり消えたりする

## 原因

`src/domain/stage/clearConditions.ts` の `clearConditions` が、表示する条件を次の式で選んでいる。

```ts
.filter(({ rule, count }) => ALWAYS_SHOWN_RULES.includes(rule) || count > 0 || (initialCounts.get(rule) ?? 0) > 0)
```

`count > 0`(**今**違反があるか)が入っているため、初期は違反0件の任意ルール(`empty`・`unused`・`cycle` など)は、
操作で違反が出ると行が現れ、直すと消える。分母 `m = conditions.length` はこの行数そのものなので一緒に増減する。

呼び出し元は2か所(grepで確認済み)。

- `src/presentation/stage/ClearConditionList.tsx`(サイドバーの一覧と `n/m 達成`)
- `src/presentation/critique/describeFallbackCritique.ts`(AI講評が取れないときの簡易講評の `クリア条件: n/m 達成`)

## 修正

**方針(確定)**: 条件の行(分母 m)はステージを開いた時点で固定する。操作で初めて出た違反は「条件」には数えず、
同じ一覧の下に「操作で生じた問題」として別扱いで出し、見出しにはその件数を `n/m 達成` とは別に出す。

- 「全ルールを最初から達成済みで並べる」案は採らない。ルールは19種類あり、初級ステージに層・契約違反などが並ぶと条件一覧がノイズになる
- 「一度出た行は残し続ける」案も採らない。分母が増える(減らない)だけで、「増える」という症状は残る

### domain(`src/domain/stage/clearConditions.ts`)

1. `clearConditions` のフィルタから `count > 0` を外す。条件は「`ALWAYS_SHOWN_RULES` か、初期に違反があったルール」だけになる。
   `initial` が同じなら、`current` がどう変わっても返る条件の並び(`clearConditionKey` の列)は変わらない
2. 新しい純粋関数を足す

```ts
/**
 * 初期は違反0件で、今は違反があるルール(操作で生じた問題)。clearConditions とは重ならない。採点順。
 * `ALWAYS_SHOWN_RULES` のルールは常に clearConditions 側にあるので含めない(line-limit の lineKind 分割も不要)。
 */
export function arisenProblems(initial: Score, current: Score): ClearCondition[];
```

- 返す要素は `{ rule, count }`(`lineKind` なし)。`count` は今の違反数
- 新しい型・ファイルは作らない(`ClearCondition` をそのまま使う)

### presentation(`src/presentation/stage/ClearConditionList.tsx`)

- `conditions = clearConditions(...)`、`problems = arisenProblems(initial, current)` を `useMemo` で求める
- 見出しの `data-testid="clear-conditions-progress"` は `{conditions のうち count===0 の数}/{conditions.length} 達成` のまま(m は固定になる)
- `problems.length > 0` のときだけ、その右に `<span data-testid="clear-conditions-arisen">操作で生じた問題 {problems.length}件</span>` を出す
  (色は未達成と同じ `--danger` 系。CSS は `src/index.css` の `.clear-conditions` まわりに最小限足す)
- 全件達成の緑(`clear-conditions__progress--complete`)は `achievedCount === conditions.length && problems.length === 0` のときだけ付ける
- 一覧の `ul` には、条件の行のあとに `problems` の行を同じ描き方(未達成の行)で続ける。違いは次の2点だけ
  - `li` にクラス `clear-condition--arisen` を足し、目標の文の前に小さく `操作で生じた問題` と出す
  - `aria-label` は `操作で生じた問題: <goal> (<current>)`(`未達成:` で始めない。既存E2Eの `li[aria-label^="未達成:"]` の件数が条件の行だけを数え続けるため)
- 「達成した瞬間」の追跡(`useJustMetRules`)には、今と同じ挙動を保つため `[...conditions, ...problems]` を渡す
  (問題の行が出たときは今までどおり「悪化」として弾みを消す。問題の行が消えても弾みは付かない — 消えた行は描かれないため)
- `stage.conditionNotes` は問題の行でも今までどおり `rule` で引く

### presentation(`src/presentation/critique/describeFallbackCritique.ts`)

- `クリア条件: n/m 達成` の m は固定の条件数になる(コードの変更は不要、`clearConditions` の変更で揃う)
- `arisenProblems` が1件以上なら、`まだ達成していない条件:` の一覧のあとに `操作で生じた問題:` と、同じ `・<goal>(<current>)` の形で並べる
- 減点がない(`current.deducted === 0`)ときは問題も0件なので、今の文のまま

## テスト

先に書いて失敗させてから実装する(AAA)。

### `clearConditions`(`src/domain/stage/clearConditions.test.ts`)

- 既存ケース「常時表示の3条件を含め、初期か現在のどちらかで違反した条件だけを採点順に返す」を書き換える:
  `initial = { visibility: 2 }`・`current = { line-limit:1, coupling:2, responsibility:3, unused:1 }` のとき、
  `unused` は含めず、`line-limit` ×3・`coupling`・`responsibility`・`visibility(count 0)` の6件を返す
- 追加: 同じ `initial` に対して `current` を (a) 初期と同じ (b) `empty: 1, unused: 2` を足したもの (c) すべて0件、の3通りで呼ぶと、
  返る `clearConditionKey` の列がすべて等しい(分母が変わらない)
- 追加: 初期に違反があった任意ルール(`empty: 1`)は、今0件でも `{ rule: 'empty', count: 0 }` で残る
- 既存ケース「どちらも違反がない任意ルールは含めない」はそのまま通る

### `arisenProblems`(同ファイル)

- `initial = {}`・`current = { empty: 1, unused: 2 }` → `[{ rule: 'empty', count: 1 }, { rule: 'unused', count: 2 }]`(採点順)
- 初期に違反があったルール(`initial = { empty: 1 }`・`current = { empty: 2 }`)は含めない
- `ALWAYS_SHOWN_RULES`(`initial = {}`・`current = { coupling: 1, 'line-limit': 1 }`)は含めない
- 今0件のルールは含めない(`initial = current = {}` → `[]`)

### `describeFallbackCritique`(`src/presentation/critique/describeFallbackCritique.test.ts`)

- 追加: `initial` で違反0件の `empty` が `current` で1件になったとき、`クリア条件: n/m 達成` の m が `initial === current` のときと同じで、
  本文に `操作で生じた問題:` と `空のクラス・ファイル` の行が入る

### E2E(新規 `e2e/clear-condition-total-stable.spec.ts`)

`e2e/refactor.spec.ts` の「越境した private メソッドの呼び出しは減点され…」と同じ操作で、中級3を進める。

1. 中級3を開く → `clear-conditions-progress` が `3/6 達成`、`clear-conditions-arisen` は無い
2. notifyShipment から `sendMail`・`logDelivery` を抽出し、renderTemplate を NotificationService へドラッグで移す
   → 分母は `/6` のまま(`toHaveText(/\/6 達成$/)`)。`clear-conditions-arisen` が `操作で生じた問題 1件`、
   `li.clear-condition--arisen` が1件で `aria-label` が `操作で生じた問題: 空のクラス・ファイル` で始まる。進捗バッジに `--complete` が付いていない
3. TemplateEngine.ts を右クリックで削除 → `6/6 達成`、`clear-conditions-arisen` と `li.clear-condition--arisen` が消え、進捗バッジに `--complete` が付く
4. 「元に戻す」で 2 の状態に戻しても分母は `/6` のまま

## 受け入れ基準

1. 中級3で上の E2E の操作をしても、`n/m 達成` の m は最初から最後まで 6 のまま。空のクラスができている間は `操作で生じた問題 1件` が見え、`6/6 達成` でも緑にならない
2. 中級11で空のクラスを作ったり消したりしても、m は開いた直後の値から変わらない(`1/7 → 1/6 → 2/7 → 2/6` のような行き来がない)
3. 100点になると、条件の行がすべて達成済み・問題の行は0件・進捗バッジが緑になる
4. 既存の `e2e/sidebar-structure.spec.ts`(チュートリアル2の `3/6 達成`)と `e2e/small-text-fixes.spec.ts`(`達成: 空のクラス・ファイル…` の行)が変更なしで通る(チュートリアル2は初期に空のクラスがあるので、`empty` は固定の条件のまま)
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 採点(`scoreCodebase`・減点の点数)の変更
- `ALWAYS_SHOWN_RULES` の中身の変更や、ステージ定義で「表示する条件」を指定できるようにすること
- 問題の行をクリックして違反の場所へ飛ぶ操作(減点の内訳側の `deduction-targets-named.md` の範囲)
- 「操作で生じた問題」が解消した瞬間の演出(行は消えるだけ)
- 見出しの文言・行の見た目(バッジ・色)のそれ以外の変更
