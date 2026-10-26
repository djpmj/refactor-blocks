# critique-failure-fallback: AI講評が取れないときに、採点の内訳から作った簡易講評を代わりに出す

## 背景・目的

実機で、チュートリアル1(`/` を開いた最初のステージ)で「AIの講評をもらう」を押すと、講評は出ずに
「AI講評を取得できませんでした。しばらくしてからもう一度お試しください」とだけ表示された
(`src/application/CritiqueUseCases.ts` の `'request-failed'`)。講評サーバーに届かないとき
(`VITE_CRITIQUE_ENDPOINT` 未設定・通信失敗・5xx・応答不正)は、学習者が受け取れるフィードバックがなくなる。

講評が取れないときは、すでに手元にある採点結果(`Score` の減点内訳と、クリア条件の達成状況)から
ルールベースの簡易講評を作って代わりに表示する。AIの講評ではないことは見出しと本文の両方に書く。

本当に新しい仕組みが要るか: 減点の内訳(`RULE_LABEL`)、クリア条件の文言(`describeCondition`)、
困る理由(`RULE_WHY`)、いちばん大きい減点(`biggestProblem`)は、すでに `presentation`/`domain` にある。
今回はそれらを並べて文章にする純粋関数を1つと、表示を1か所足すだけにする。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/critique/describeFallbackCritique.ts` | presentation | 採点結果から簡易講評の文章を作る純粋関数 |
| 新規 | `src/presentation/critique/describeFallbackCritique.test.ts` | presentation | 上記のユニットテスト(先に書く) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `CritiqueState` に `fallback` を足し、`requestCritique` が失敗したときに簡易講評を入れる |
| 変更 | `src/presentation/critique/CritiquePanel.tsx` | presentation | `CritiqueResult` で、エラー文の下に簡易講評を出す |
| 変更 | `src/index.css` | presentation | 簡易講評の見た目(既存の `.critique-panel__*` に1〜2行足す。不要なら足さない) |
| 変更 | `e2e/critique.spec.ts` | (E2E) | 失敗時に簡易講評が出ることを確かめるテストを足す |

`domain`・`application`・`infrastructure` は変更しない(`CritiqueError` の種類も `fetchCritique` も今のまま)。
新しい依存は足さない。

## データ・型の変更

`src/presentation/store/useGameStore.ts`:

```ts
export type CritiqueState = {
  readonly text: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** AI講評を取れなかったときだけ入る、採点結果から作った簡易講評。AI講評ではない。 */
  readonly fallback: string | null;
};
const EMPTY_CRITIQUE: CritiqueState = { text: null, loading: false, error: null, fallback: null };
```

`src/presentation/critique/describeFallbackCritique.ts`:

```ts
export function describeFallbackCritique(input: Readonly<{
  stage: Stage;
  codebase: Codebase;
  initial: Score; // scoreCodebase(stage.codebase, stage)
  current: Score; // scoreCodebase(codebase, stage)
}>): string;
```

保存形式の変更はない(講評は保存しない)。

## 動きの仕様

- 「AIの講評をもらう」の結果が `ok: false` のとき(`request-failed`・`invalid-request`・`version-mismatch` のどれでも)、
  `critique` を `{ text: null, loading: false, error: <今の describeCritiqueError の文>, fallback: describeFallbackCritique(...) }` にする。
  `initial` は `scoreCodebase(stage.codebase, stage)`、`current` はボタンを押した時点で計算済みの `score` を使う。
- 成功したときは今と同じで、`fallback` は `null`。押した直後の「講評中」の状態でも `fallback: null` に戻す。
- `CritiqueResult` の表示:
  - エラー文(`.critique-panel__error`、`role="status"`)は今のまま一番上に出す。
  - その下に `<details className="critique-panel__details" open>` を出し、`<summary>` は `簡易講評(AI講評ではありません)`。
    本文は `<p className="critique-panel__text" data-testid="critique-fallback-text">`(改行は既存の `white-space: pre-wrap` で出す)。
  - AI講評(`data-testid="critique-text"`)と同時には出ない。
  - 何も出さない条件(`return null`)は「`error`・`text`・`fallback` がすべて `null`」にする。
- `describeFallbackCritique` が返す文章の形(行ごと、`\n` 区切り):
  1. 1行目は必ず `※ AIの講評ではありません。採点の内訳から自動で作った簡易講評です。`
  2. `クリア条件: {達成数}/{全体数} 達成` — `clearConditions(initial, current, findLineLimitViolations(codebase, stage.limits))` の結果で数える
     (`ClearConditionList` と同じ数になる)。
  3. 未達成の条件があるとき: `まだ達成していない条件:` の後に、未達成の条件1件につき1行
     `・{goal}({current})`(`describeCondition(condition, stage, worstMeasures(codebase, stage), codebase)` の値。`current` が `null` なら括弧ごと省く)。
  4. 減点があるとき: `いちばん大きい減点: {RULE_LABEL[rule]} -{points}点` と、次の行に `RULE_WHY[rule].trouble`。
     `rule` は `biggestProblem(current)`。
  5. 減点が0のとき(`current.deducted === 0`): 3・4の代わりに `減点はありません。今の分け方でクリア条件をすべて満たしています。`
- 講評取得後にコードベースを編集しても簡易講評は自動で更新しない(AI講評と同じ扱い。既存の ponytail コメントの範囲)。
  ステージを切り替えたら今と同じく `EMPTY_CRITIQUE` に戻り、簡易講評も消える。

## 設計判断(確定)

- **どの失敗で簡易講評を出すか**: 3種類すべて。原因が何であれ学習者は講評を受け取れないため。原因の説明は既存のエラー文が受け持つ。
- **関数を置く層**: `presentation`。文言の材料(`RULE_LABEL`・`RULE_WHY`・`describeCondition`)がすべて `presentation/stage/` にあり、
  `domain` に移すと文言が層をまたいで散るため。`src/presentation/stage/describeScore.test.ts` などと同じく、presentation の純粋関数としてテストを先に書く。
- **戻り値は文字列1本**: 表示先が既存の `pre-wrap` の段落で足りるため。構造化した型は作らない。
- **講評はプレイヤーの命名を評価しない**: 文面はルール名・条件・数値だけで作り、クラス名の良し悪しには触れない。

## TDD対象

### `describeFallbackCritique`(presentation)

テストは既存のステージ定義(最初のステージ)とその `codebase` を使い、AAAで書く。

- 初期状態のステージ(減点あり) → 1行目が `※ AIの講評ではありません。採点の内訳から自動で作った簡易講評です。`
- 初期状態のステージ → `クリア条件: x/y 達成` の x・y が `clearConditions` の結果(`count === 0` の数/全体の数)と一致する
- 未達成の条件がある → `まだ達成していない条件:` があり、未達成の条件の数だけ `・` で始まる行があり、各行に `describeCondition` の `goal` が入る
- 未達成で `describeCondition` の `current` が文字列の条件 → `・{goal}({current})` の形になる
- 減点あり → `いちばん大きい減点: {RULE_LABEL[biggestProblem(current)]} -{points}点` と `RULE_WHY[rule].trouble` が続けて入る
- 減点が同点で複数ある(`Score` を直接組み立てて渡す) → `biggestProblem` の決め方(deductions の順で先のもの)に従う
- 減点なし(`deducted: 0` の `Score` を `current` に渡す) → `減点はありません。…` が入り、`まだ達成していない条件:` と `いちばん大きい減点:` は入らない。1行目の注記は入る

## 受け入れ基準

1. `npm run dev` で開き、`VITE_CRITIQUE_ENDPOINT` が未設定(または届かない)状態でチュートリアル1の「AIの講評をもらう」を押すと、
   今までのエラー文の下に「簡易講評(AI講評ではありません)」が開いた状態で出て、本文の1行目に
   `※ AIの講評ではありません。採点の内訳から自動で作った簡易講評です。` が表示される。
2. 1の本文の `クリア条件: x/y 達成` が、サイドバーの「クリア条件」の `x/y 達成` と同じ数になっている。
3. 1の本文に、サイドバーで ✗ になっている条件が `・` 付きで並び、いちばん大きい減点のルール名・点数・困る理由が出ている。
4. 講評サーバーが成功を返したときは、今までどおりAI講評だけが出て、簡易講評は出ない。
5. 簡易講評を出したあと別のステージに切り替えると、簡易講評もエラー文も消える。
6. `e2e/critique.spec.ts` に、500を返すモックで「エラー文が出る」「`critique-fallback-text` の1行目がAI講評でない旨の注記」
   「summary が `簡易講評(AI講評ではありません)`」を確かめるテストがあり、成功時のテストで `critique-fallback-text` が出ないことも確かめている。
   既存のエラー文のテスト(500・400・409)はそのまま通る。
7. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- `request-failed` の原因をさらに分けること(呼び出し先が未設定/通信失敗/5xx/応答不正の区別)。簡易講評で学習者のフィードバックは確保できるため。
  未設定の環境が多いと分かったら、`fetchCritique` が専用のエラーを投げる別Issueにする。
- 講評サーバーへの自動リトライ・タイムアウトの調整。
- 簡易講評の文面をステージごとに書き分けること、メソッド名・クラス名を挙げた具体的な指摘(`describeTargets` などの流用)。
- 簡易講評を、AI講評が取れたときにも並べて出すこと。
- コードベースを編集したときの講評・簡易講評の自動更新。
