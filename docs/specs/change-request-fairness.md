# change-request-fairness: 変更依頼の比べ方をそろえ、解答例の設計なら変更が素直に入るようにする

## 背景・目的

チュートリアル2を、ヒント(模範解答)どおりに100点にして変更依頼に挑戦した。
すると3件目「在庫の検証ルールを足して」の結果が「今のコード 65点 / 初期状態 70点」になり、**組み替える前より悪い**ように見えた。
「100点を取ったのに、組み替えたせいで変更が大変になった」と受け取れ、このゲームが一番伝えたいことと逆になる。

全ステージを計算して調べると、原因は2つあった。

### 原因1: 「今のコード」と「初期状態」を、条件の違うコードで比べている

- 「今のコード」の変更コスト(`ChangeOutcome.current`)は、`finishImplementation` が `session.carried`(**前の依頼で置いた部品が積み重なったコード**)で測っている
- 「初期状態」(`ChangeOutcome.initial`)は、`stage.codebase`(**何も足していない初期コード**)で測っている

チュートリアル2では、2件目で `OrderService` に部品を足したため3件目で行数の上限を超え、65点になった。
同じ依頼を単独で当てれば、解答例のコードは 100点(初期 70点)である。比べる2つのコードの条件をそろえる。

### 原因2: 解答例どおりに組み替えても、変更がきれいに入らない依頼が多い

解答例のコード(`sampleAnswerCodebase(stage)`)に対する最善の置き方(`sampleImplementation(...).score`)が100点にならない依頼が、50件中22件ある。

| ステージ | 依頼 | 最善の置き方 |
| --- | --- | --- |
| tutorial-extract-method | req-report-yoy / req-report-share | 90 / 90 |
| tutorial-order-service | req-mail-text / req-stock-rule | 85 / 85 |
| beginner-invoice-service | req-rounding | 95 |
| intermediate-cyclic-dependency | req-price-rule / req-member-discount | 85 / 85 |
| intermediate-misplaced-private | req-sms / req-log-format | 85 / 85 |
| intermediate-feature-envy | req-free-admin-seat / req-campaign-trial | 90 / 90 |
| intermediate-anemic-domain-model | req-premium-daily-limit / req-deposit-while-frozen | 85 / 85 |
| intermediate-extract-class | req-late-night-overtime | 90 |
| intermediate-member-rank-branching | req-premium-shipping | 95 |
| advanced-notifier-hierarchy | req-notification-format | 95 |
| advanced-payment-gateway-interface | req-payment-logging / req-gateway-integration | 90 / 90 |
| advanced-report-factory | req-report-delivery | 95 |
| advanced-collapse-hierarchy | req-fiscal-year | 95 |
| advanced-interface-segregation | req-task-assignee | 95 |
| advanced-value-object | req-accept-euro / req-hide-yen-decimals | 90 / 90 |
| advanced-template-method | req-add-xml / req-order-validation | 80 / 90 |

結果画面の「解答例: 既存の OrderService に置く(85点)」は、「正しく組み替えても満点にならない」と伝えてしまう。
「良い設計なら、後から来た変更が素直に入る」を体験させるには、解答例の設計で変更依頼が100点で入るべきである。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/application/ChangeRequestUseCases.ts` | application | 変更コストは「挑戦前のコード」で、置き方は「積み重なったコード」で測るように、引数を分ける |
| 変更 | `src/application/ChangeRequestUseCases.test.ts` | application | 上のテスト |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `finishImplementation` から、挑戦前のコード(`session.base`)と積み重なったコード(`session.carried`)を分けて渡す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 2件目で部品を足しても、3件目の変更コストが挑戦前のコードで測られるテスト |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 解答例の設計で、すべての変更依頼が100点で入ることを確かめるテスト(既知の例外の一覧つき) |
| 変更 | `src/domain/stage/sampleAnswer.ts`、`src/infrastructure/stages/*.ts` | domain / infrastructure | 上のテストに引っかかるステージの模範解答・変更依頼を見直す |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する |

## データ・型の変更

### application

`evaluateImplementationUseCase` の引数を、次のように分ける(引数は4つまでなので、コードはオブジェクトにまとめる)。

```ts
export function evaluateImplementationUseCase(
  stage: Pick<Stage, 'limits' | 'codebase'>,
  codebases: Readonly<{
    /** 変更コスト(current)を測るコード。挑戦前の、プレイヤーが組み替えたコード(session.base)。 */
    design: Codebase;
    /** 置き方を測る基準。前の依頼までの部品が積み重なったコード(session.carried)。 */
    base: Codebase;
    /** 部品を置いたあとのコード。 */
    implemented: Codebase;
  }>,
  request: ChangeRequest,
): Result<ChangeOutcome, ImplementationError>;
```

- `measureCosts` には `design` を渡す(`initial` は今どおり `stage.codebase`)。これで「今のコード」と「初期状態」が、どちらも**部品を足していないコード**の比較になる
- `measurePlacement` と `sampleImplementation` には今どおり `base` を渡す(前の依頼で置いた部品の影響は、置き方の点に出る)
- `boss-change-request`(#170)が同じ関数に `bossCounterfactual` を足す。先にマージされた方に合わせる

## 解答例の設計で変更依頼が素直に入ること(ステージの内容)

### カタログのテスト

`stageCatalog.test.ts` に次のテストを足す。

- 解答例があるすべてのリファクタリングのステージ・すべての変更依頼について、`sampleImplementation(sampleAnswerCodebase(stage), request).score === 100`
- 満たせない依頼は、テストの中の**既知の例外の一覧**(`依頼のid → 理由の文`)に載せた場合だけ通す。理由には、なぜ100点にできないかと、いつ直すかを書く
  (例: `'advanced-template-method/req-add-xml': '具象の基底クラスへの追加で concrete-base の -10 が残る。…'`)
- 一覧に載っている依頼が100点になったら、テストを失敗させて一覧から消させる(例外の放置を防ぐ)
- modify の依頼は、解答例のコードでの変更コスト(`scoreChange(measureChange(answer, …))`)が初期状態以上であることも確かめる(今は全件満たしている。今後の悪化を防ぐため)

### データの見直し

- 上の表の22件を、1件ずつ減点の理由(`describePlacement` の文)を見て直す。直し方は次のどれか
  - 模範解答(`sampleAnswerSteps`)の手順を足す・変える(例: チュートリアル2で、検証の処理2つを1つのメソッドにまとめて抽出する)
  - 依頼の `responsibility` や `linesPerSite` を、解答例の設計が受け止められるものに変える
  - クリア条件(`limits` など)を、解答例の設計に合わせて変える
- **チュートリアル・初級のステージ(表の上から3ステージ、5件)は、例外にせず必ず100点にする**(最初の体験を守るため)
- 模範解答を変えたら、ヒント(手順の文)・解答の再生・既存の E2E(模範解答どおりに操作するもの)が通ることを確かめる

## TDD対象の純粋関数

### `evaluateImplementationUseCase`(`application/ChangeRequestUseCases.ts`)

- `design` と `base` が同じ → 今と同じ結果
- `base` に前の依頼の部品が積み重なって行数の上限を超える → `current` の点数は `design` で測った点数のまま(上限超えの減点が入らない)。置き方の点(`placement`)には上限超えが反映される
- extend の依頼 → `current` / `initial` は今どおり `null`

### ストア(`useGameStore.test.ts`)

- チュートリアル2で解答例どおりに組み替え、1件目・2件目の部品を `OrderService` に置いてから3件目を終える → 3件目の `current.score.total` が、単独で当てたときと同じ(100)

## 受け入れ基準

1. チュートリアル2で解答例どおりに組み替え、2件目の部品を `OrderService` に置いても、3件目の結果の「今のコード」が初期状態より下がらない
2. カタログのテストが、解答例の設計ですべての変更依頼が100点で入ること(既知の例外を除く)を確かめている
3. チュートリアル・初級のステージに既知の例外が無い
4. 既知の例外の一覧に載った依頼には、理由と直す時期が書いてある。例外は22件より減っている
5. 模範解答を変えたステージで、ヒント・解答の再生・既存の E2E が通る
6. `npm run check` と `npm run test:e2e` が通る。`npm run stage-report` を再生成してコミットする

## スコープ外

- 結果画面の点数の見せ方(`change-results-clarity` で扱う)
- 置き方の採点ルール(`scorePlacement`)の変更
- 「鬼の変更」の追加(#170)
