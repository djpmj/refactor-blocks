# boss-change-request: 変更依頼の最後に「鬼の変更」を置き、組み替えていなかった場合と比べて見せる

## 背景・目的

設計の良し悪しがはっきり出るのは、「後から来た重い仕様変更を、良い設計なら一撃で入れられる」場面である。
ところが今の変更依頼は、どれも「1つの責務を少し変える」同じくらいの重さで、ステージの山場になる依頼が無い。
結果も「置き方○点」の数字だけで、「組み替えていなかったら大変だった」ことが見えない。

そこで、**組み替えの効果が点数に表れるステージ**の変更依頼の最後に、**鬼の変更(ボス)**を1つ置く。
ボスは、冒頭の手直し(#160)で直した責務を**大きく作り直す**重い依頼にする
(例: 税率の変更を手で直したステージで、最後に「税の計算を、品目ごとの税率と端数処理まで含めて作り直して」が来る)。

- その責務を組み替えで切り出していれば、切り出したクラス1つを直すだけで済む(100点)
- 切り出していなければ、ほかの責務と同居する大きなクラスを書き換えることになり、行数の上限も超える

### 調べて分かったこと(2026-10-17 追記)

当初は「全ステージに、新しい種類を足す(extend)ボスを置く」としていたが、今の置き方の採点では成り立たないと分かった(全ステージで計測)。

- 機能の追加(extend)の点は「置き先のクラスにある別の責務 −5」と「呼ばれている抽象を実装すれば減点なし」だけで決まる。
  模範解答で拡張の入口(抽象)ができないステージでは、組み替える前でも「別の責務が少ない小さなクラス」に置けば 85〜90点になり、組み替えの差が出ない
- extend のボスは、模範解答の設計でも 90点止まりのステージがほとんどで、`change-request-fairness`(#176)の「解答例の設計では100点」を満たせない
- 冒頭と同じ責務の重い変更(modify)なら、次の11ステージで「解答例の設計で100点、かつ組み替える前の最善より高い」が成り立つ

| ステージ | 冒頭の責務 | 組み替える前の最善 → 解答例 |
| --- | --- | --- |
| チュートリアル1 tutorial-extract-method | aggregation | 90 → 100 |
| チュートリアル2 tutorial-order-service | tax | 90 → 100 |
| 初級1 beginner-user-controller | notification | 90 → 100 |
| 初級2 beginner-invoice-service | rendering | 85 → 100 |
| 中級4 intermediate-volatile-tax | tax | 90 → 100 |
| 中級5 intermediate-volatile-format | formatting | 90 → 100 |
| 中級8 intermediate-extract-class | address | 85 → 100 |
| 中級9 intermediate-copy-paste-tax | tax | 95 → 100 |
| 中級11 intermediate-layered-order-api | persistence | 90 → 100 |
| 上級3 advanced-discount-strategy | discount-premium | 90 → 100 |
| 上級4 advanced-report-factory | report-building | 90 → 100 |

(`linesPerSite` は冒頭の依頼の2倍(20以上)、冒頭の依頼と同じ責務の modify で計測)

そのため、ボスは**差が出るステージにだけ**置き、種類は modify を基本にする(差が出て #176 も満たせるなら extend でもよい)。
差が出ないステージ(採点の仕組み上、組み替えの効果が置き方の点に表れないステージ)には置かない。
置き方の採点そのものを見直して全ステージに広げるのは、別の仕様で扱う。

結果画面では、**同じボスを組み替える前のコードに入れていたら**どうなったか(最善の置き方でも何点で、既存の何クラスを書き換え、どのクラスが行数の上限を超えるか)を自動で計算する。
それを今の結果と並べて、「この設計のおかげで一撃で済んだ」を際立たせる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/change/ChangeRequest.ts` | domain | `ChangeRequest` に任意の `boss` を足す |
| 変更 | `src/domain/change/changePain.ts` | domain | `painRequestsOf` の extend からボスを除く |
| 変更 | `src/domain/change/changePain.test.ts` | domain | 上のテスト |
| 新規 | `src/domain/change/bossCounterfactual.ts` | domain | ボスを組み替える前のコードに入れていたらどうなったかを計算する純粋関数 |
| 新規 | `src/domain/change/bossCounterfactual.test.ts` | domain | 上のテスト |
| 変更 | `src/application/ChangeRequestUseCases.ts` | application | ボスの結果(`ChangeOutcome`)に組み替える前の計算結果を足す |
| 変更 | `src/application/ChangeRequestUseCases.test.ts` | application | 上のテスト |
| 新規 | `src/presentation/change/describeBoss.ts` | presentation | ボスの結果の比較の文を作る純粋関数 |
| 新規 | `src/presentation/change/describeBoss.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/change/ChangeRequestPanel.tsx` | presentation | ボスの依頼票の見た目と、結果カードの比較 |
| 変更 | `src/index.css` | presentation | ボスの依頼票・比較のスタイル |
| 変更 | `src/infrastructure/stages/tutorialStages.ts` / `beginnerStages.ts` / `intermediateStages.ts` / `advancedStages.ts` | infrastructure | 上の表のステージに、ボスの依頼を最後に1つ足す |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | ボスの置き方と、ボスが設計の差を生むことを守るテスト |
| 新規 | `e2e/boss-change-request.spec.ts` | E2E | ボスの依頼票と結果の比較を確かめる |

## データ・型の変更

### domain

```ts
// src/domain/change/ChangeRequest.ts
export type ChangeRequest = {
  // 既存のフィールドに加えて
  /** true なら、そのステージの鬼の変更(ボス)。changeRequests の最後に置く。 */
  readonly boss?: true;
};
```

- `painRequestsOf(stage)` の `modify`・`extend` は、どちらも `boss` でない最初の依頼にする(ボスを100点前のカードや冒頭の手直しに使わない)。
  これにより `change-rumors`(#165)の `rumoredRequests` には、ボスが自動で入る(#165 が実装済みなら、ボスにも `rumor` を書く)

```ts
// src/domain/change/bossCounterfactual.ts
/** ボスを組み替える前のコードに入れていたら。解答例(最善の置き方)で測る。 */
export type BossCounterfactual = {
  /** 組み替える前のコードでの、最善の置き方の点数(sampleImplementation の score)。 */
  readonly score: number;
  /** その置き方で書き換わる既存クラスの名前(measurePlacement の modifiedClassIds を名前にしたもの)。 */
  readonly modifiedClassNames: readonly string[];
  /** その置き方のあとで、クラスの行数の上限(stage.limits.class)を超えるクラスの名前。 */
  readonly overLimitClassNames: readonly string[];
};

/** request が boss でない、または組み替える前のコードに置き先が無ければ undefined。 */
export function bossCounterfactual(stage: Pick<Stage, 'codebase' | 'limits'>, request: ChangeRequest): BossCounterfactual | undefined;
```

- `sampleImplementation(stage.codebase, request)` で最善の置き方を求め、`measurePlacement(stage.codebase, sample.codebase, request)` で書き換わる既存クラスを求める
- 行数の上限を超えるクラスは、`sample.codebase` の全クラスについて `classLines` > `stage.limits.class` のもの

### application

```ts
export type ChangeOutcome = {
  // 既存のフィールドに加えて
  /** ボスの依頼のときだけ。組み替える前のコードに入れていたら。 */
  readonly bossCounterfactual?: BossCounterfactual;
};
```

- `evaluateImplementationUseCase` で、依頼が `boss` なら `bossCounterfactual(stage, request)` を付ける

## ボスの依頼の作り方(ステージ定義を書く人向け)

- 「調べて分かったこと」の表のステージに、ボスを1つ足す。`changeRequests` の**最後**に置く。ほかのステージには置かない
- `boss: true`。`kind` は省略(modify)を基本にし、`responsibility` は冒頭の手直しで直した責務(`painRequestsOf(stage).modify.responsibility`)にする。`partName` と `rumor`(#165)も必ず書く
- 冒頭の手直しの責務を**大きく作り直す**依頼にする。タイトルは「〜まで含めて作り直して」「〜を全面的に変えて」のように、重さが伝わるものにする
- `linesPerSite` は、組み替えていない大きなクラスに入れるとクラスの行数の上限を超える程度に大きくする(目安: 他の依頼の1.5〜2倍)
- 下のカタログのテスト(解答例で100点・組み替える前より高い)を満たさないボスは、責務・種類・`linesPerSite` を見直す。どうしても満たせないステージには置かない
- 例(チュートリアル2「太った placeOrder」。冒頭の手直しは税の計算の変更):
  `{ id: 'req-boss-tax-overhaul', title: '税の計算を、品目ごとの税率と端数処理まで含めて作り直して', description: '来月から軽減税率の品目が増え、端数処理も品目ごとに変わる。税の計算をまるごと作り直したい。', responsibility: 'tax', linesPerSite: 20, boss: true, partName: 'calculateTaxByItem' }`

## 見た目・動きの仕様

### ボスの依頼票(`ChangeRequestPanel`)

- 依頼がボスのとき
  - 依頼票の上に `⚠ 鬼の変更` のラベル(`data-testid="boss-label"`)を出す
  - 依頼票に `var(--danger)` の太い左線と、薄い赤の背景を付ける
  - 「依頼 N / M」の表示はそのまま
- 動き(アニメーション)は付けない(`answer-feedback-animation` と演出が重なるため)

### ボスの結果カード(`OutcomeCard`)

- ボスの依頼のカードにも、ボスの印(`⚠ 鬼の変更`)を付ける
- 今のカードの内容(置き方の点数・解答例・減点の理由)に加えて、`bossCounterfactual` があれば比較の欄(`data-testid="boss-comparison"`)を出す
  - 左に「組み替える前のコードなら」、右に「あなたの設計では」を並べる
  - 組み替える前: `最善の置き方でも <score>点`、`既存の <N> クラスを書き換え(<クラス名>・…)`、行数の上限を超えるクラスがあれば `<クラス名> が行数の上限を超える`
  - あなたの設計: `<placement.score.total>点`、`既存の <N> クラスを書き換え` または `既存のクラスを書き換えずに済んだ`
- 比較の下に、`describeBoss` の文を1行出す

### 比較の文(`describeBoss`)

`describeBoss(outcome: ChangeOutcome, openingTitle: string | undefined): string | undefined` を作る。`bossCounterfactual` が無ければ `undefined`。

- 今の点数 > 組み替える前の点数
  - `openingTitle` あり: `冒頭の「<openingTitle>」の処理を切り出しておいたおかげで、鬼の変更も <今の点数>点で入れられた(組み替える前なら最善でも <前の点数>点)`
  - なし: `組み替えておいたおかげで、鬼の変更も <今の点数>点で入れられた(組み替える前なら最善でも <前の点数>点)`
- 今の点数 <= 組み替える前の点数: `この設計では、鬼の変更は組み替える前と同じくらい大変だった。変わる場所を切り出せているか、見直してみよう`

`openingTitle` は `painRequestsOf(stage).modify?.title` を渡す。

## TDD対象の純粋関数

### `painRequestsOf`(`domain/change/changePain.ts`)

- extend がボスだけ → `extend` は `undefined`
- ボスでない extend とボスがある → `extend` はボスでない方
- modify の依頼のあとに modify のボスがある → `modify` はボスでない方
- 既存のテストはそのまま通る

### `bossCounterfactual`(`domain/change/bossCounterfactual.ts`)

- ボスでない依頼 → `undefined`
- 1つの大きなクラスにすべての処理があるコードにボスを入れる → `modifiedClassNames` にその大きなクラスが入り、`linesPerSite` を足すと上限を超えるなら `overLimitClassNames` にも入る。`score` は100未満
- 置き先が無いコード(クラスが無い) → `undefined`

### `evaluateImplementationUseCase`(`application/ChangeRequestUseCases.ts`)

- ボスの依頼 → `bossCounterfactual` が付く
- ボスでない依頼 → `bossCounterfactual` が付かない

### `describeBoss`(`presentation/change/describeBoss.ts`)

- `bossCounterfactual` なし → `undefined`
- 今 100点・前 60点・`openingTitle` あり → 「冒頭の「…」の処理を切り出しておいたおかげで、鬼の変更も 100点で入れられた(組み替える前なら最善でも 60点)」
- `openingTitle` なし → 「組み替えておいたおかげで…」
- 今 60点・前 60点 → 見直しを促す文

### ステージカタログ(`stageCatalog.test.ts`)

- ボスのあるステージでは、ボスはちょうど1つで、`changeRequests` の最後にあり、`partName` がある
- 「調べて分かったこと」の表の11ステージには、ボスがある(ボスのあるステージの一覧をテストに書き、減ったら失敗する)
- **ボスが設計の差を生む**: ボスのあるすべてのステージで、`sampleImplementation(sampleAnswerCodebase(stage), boss).score` > `sampleImplementation(stage.codebase, boss).score`
- ボスは #176 の「解答例の設計で100点」のテストの既知の例外に入れない(ボスは解答例の設計で100点になる)

## 受け入れ基準

1. 「調べて分かったこと」の表の11ステージでは、変更依頼に挑戦すると最後の依頼がボスで、依頼票に `⚠ 鬼の変更` が出る。ほかのステージにはボスが出ない
2. 100点前のカード「新しい種類を足すなら?」にボスは出ない
3. 解答例どおりに組み替えてからボスを実装すると、結果カードに比較の欄が出る。「組み替える前のコードなら」の点数が「あなたの設計では」より低く、「冒頭の「…」の処理を切り出しておいたおかげで」の文が出る
4. 組み替える前のコードでボスを入れると行数の上限を超えるステージでは、比較の欄にそのクラス名が出る
5. カタログのテストで、ボスの置き場所と、ボスが設計の差を生む(解答例で100点、かつ組み替える前より高い)ことが、ボスのある全ステージで確かめられる
6. 既存の変更依頼の E2E は、依頼が1件増えても通るように直す(依頼の数や「依頼 N / M」を数えている箇所)
7. `npm run check` と `npm run test:e2e` が通る。`npm run stage-report` の出力に差分が出る場合は再生成してコミットする

## スコープ外

- 置き方の採点(`scorePlacement`)の見直しと、ボスを全ステージへ広げること。採点の仕組み上、差が出ないステージ(循環をほどく・横流しをなくす・継承を畳むなど)は、採点を見直す別の仕様で扱う
- 複数の責務にまたがる変更(1つの依頼で2つの責務を変える)。上級ステージ向けに別の仕様で扱う
- ボスの依頼票のアニメーション・効果音
- ボスだけを単独で挑戦する入口
- 答え合わせ画面(#164)へのボスの組み込み
- 組み替える前のコードにボスを入れた図を見せること(数字とクラス名だけにする)
