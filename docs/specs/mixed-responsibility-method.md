# 抽出で作ったメソッドに、別々の責務の処理が混ざっていたら減点する

## 背景・目的

中級1「循環依存を断ち切る」で、`checkout` から「合計金額を求める」(`pricing`)と「決済する」(`payment`)を選んで
1つのメソッド(`orderTotalAndPay`)に抽出しても、100点のままになる(報告あり)。

今の採点は、責務の混在を**クラス単位**(`responsibilityLimit`: 1クラスの責務の種類数)でしか見ていない
(`src/domain/scoring/responsibilities.ts`)。メソッド単位の混在は数えないので、関係のない処理を1つのメソッドに
まとめる抽出をしても点が下がらない。中級1の模範解答自体も、「在庫を引き当てる」(`inventory`)と「合計金額を求める」(`pricing`)を
`prepareOrder` にまとめている(メソッドの行数上限に収めるため)。

「メソッドは1つのことをする」を体験させるため、**プレイヤーが抽出で新しく作ったメソッド**に、別々の責務の処理が混ざっていたら減点する。
初期状態からあるメソッド(`checkout` のような、手順を順に呼ぶまとめ役)は対象にしない(それを分けるのがプレイヤーの仕事なので)。

一方、中級「ドメインモデル貧血症」の模範解答の `Account.debit`(口座の状態確認・引き出し上限・残高)と `Account.credit` は、
責務の付け方は細かく分かれているが、1つのメソッドにまとめるのが正しい設計。そこで、ステージに
「1つのメソッドに一緒に入ってよい責務の組」を書けるようにし、組の中だけの混在は減点しない。

## 振る舞い

### 新しいルール「責務の混ざったメソッド」(`mixed-method`)

次の**すべて**を満たすメソッド1つにつき10点減点する(他のルールと同じ `POINTS_PER_VIOLATION`)。

1. ステージの初期状態のコードベース(`stage.codebase`)に、同じ ID のメソッドが無い(=プレイヤーの抽出などで新しくできたメソッド)。
   移動しただけのメソッドは ID が変わらないので対象外
2. メソッドの処理のうち、`call`(`CALL_RESPONSIBILITY`)を除いた責務が2種類以上ある
3. その責務がすべて、ステージの `cohesiveResponsibilities` のいずれか1つの組に含まれる、ということが**ない**

例:

| ステージ | 抽出したメソッドの中身(責務) | 判定 |
| --- | --- | --- |
| 中級1 | 合計金額を求める(pricing)+ 決済する(payment) | 減点(報告の例) |
| 中級1 | 在庫を引き当てる(inventory)+ 合計金額を求める(pricing) | 減点(今の模範解答。直す) |
| 中級1 | 決済する(payment)だけ | 減点しない |
| どこでも | 抽出したメソッドの呼び出し(call)+ 1種類の責務 | 減点しない |
| 貧血症 | 状態確認(account-status)+ 引き出し上限(withdrawal-limit)+ 残高(balance) | 組の中なので減点しない |
| 貧血症 | 組の中の責務 + 組の外の責務 | 減点 |

- 白紙設計: 部品(部品置き場にある初期のメソッド)は ID が `problem.codebase` にあるので対象外。白紙設計で抽出して作ったメソッドは対象になる
- 初期状態の点数は変わらない(初期状態には新しいメソッドが無いため)

### 表示

- 点数の内訳(`describeScore`)の名前: 「責務の混ざったメソッド」
- 理由の説明(`ruleWhy.ts` の `RULE_WHY`):
  - こう困ります: 「関係のない処理を1つのメソッドにまとめると、片方だけを直したいときにもう片方まで読むことになり、名前も中身を言い表せなくなります。」
  - だから: 「メソッドは1つの役割の処理だけをまとめると、名前で中身が分かり、直す場所もすぐ見つかります。」
- 違反箇所(`violationTargets.ts`): 該当するメソッドを `methodIds` に入れる(`addMethods`)(既存の「違反箇所へ移動」・点数のホバーでの強調がそのまま使える)

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/scoring/mixedMethods.ts` + `.test.ts` | domain | 新規 | `findMixedMethods(codebase, initial, cohesiveResponsibilities)`: 上の規則で違反するメソッドのIDを返す純粋関数(TDD) |
| `src/domain/scoring/score.ts` + `score.test.ts` | domain | 変更 | `ScoreRule` に `'mixed-method'` を足し、`scoreCodebase` で数える。`stage` の `Pick` に `'codebase' \| 'cohesiveResponsibilities'` を足す |
| `src/domain/scoring/violationTargets.ts` + `.test.ts` | domain | 変更 | `'mixed-method'` の違反箇所(メソッド)を足す |
| `src/domain/stage/Stage.ts` | domain | 変更 | `cohesiveResponsibilities?: readonly (readonly string[])[]` を足す |
| `src/presentation/stage/describeScore.ts`・`ruleWhy.ts` | presentation | 変更 | ルール名と理由の文面(上記) |
| `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 変更 | 貧血症ステージに `cohesiveResponsibilities: [['account-status', 'withdrawal-limit', 'balance']]` を書く |
| `src/domain/stage/sampleAnswer.ts` | domain | 変更 | 中級1の模範解答から `prepareOrder`(在庫+価格)の抽出をやめ、1種類の責務だけを抽出する手順で100点にする(下記) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 下記のカタログ検証 |
| `e2e/`(中級1を扱う既存のspec、無ければ `e2e/mixed-method.spec.ts` を新規) | E2E | 変更 | 報告の操作で減点される(下記)。既存E2Eで、責務の混ざった抽出をして点数を確かめているものがあれば直す |
| `docs/stages/report.md` | — | 変更 | `npm run stage-report` で再生成する(模範解答の手順が変わるため) |

`scoreCodebase` の呼び出し元(`StagePanel`・`useGameStore`・`SampleAnswerReplayDialog`・`stageReport`・`reviewBlankDesign`)は、
どれも `Stage`(または `Stage` を含む `BlankDesignProblem`)をそのまま渡しているので、呼び出し側の変更は無い。
テストで `scoreCodebase` に部分的な `stage` を渡しているものは、`codebase` を足す。

### 中級1の模範解答

- `move` 2手(`calculateOrderTotal` → `Order`、`countOrdersOf` → `Customer`)は今のまま
- `checkout` の行数を16行以内にするための抽出は、**1種類の責務だけ**の処理で行う(例: 「決済する」だけを `pay` として抽出、
  足りなければ「在庫を引き当てる」だけも `reserveStock` として抽出)。どれをいくつ抜くかは、実際の行数(コメント行を含む `methodLines`)で決める
- それでも上限に収まらない・別のルール(極小メソッドなど)に触れる場合に限り、中級1の `limits.method` を調整してよい。
  そのときも、初期状態が100点にならないこと・他の制限値の関係(クラス・ファイル)が崩れないことを守る
- 抽出したメソッドの名前は #147(`short-method-names`)の自動命名とは独立に、手順の `name` で決める

## データ・型の変更

`src/domain/stage/Stage.ts`:

```ts
/**
 * 1つのメソッドに一緒に入っていても減点しない責務の組。
 * 責務の付け方が細かいステージ(状態確認と残高の更新を別の責務にしているなど)で、まとめるのが正しいメソッドを減点しないために書く。
 */
readonly cohesiveResponsibilities?: readonly (readonly string[])[];
```

`src/domain/scoring/mixedMethods.ts`:

```ts
export function findMixedMethods(
  codebase: Codebase,
  initial: Codebase,
  cohesiveResponsibilities: readonly (readonly string[])[] = [],
): string[];
```

## TDD対象の純粋関数

### `findMixedMethods`

1. 初期状態に無いメソッドで、`call` を除いて責務が2種類 → 違反(IDが返る)
2. 初期状態に無いメソッドで、責務が1種類 → 違反しない
3. 初期状態に無いメソッドで、`call` + 1種類の責務 → 違反しない(`call` は数えない)
4. 初期状態にあるメソッド(別クラスへ移したものも含む)は、責務が何種類でも違反しない
5. 責務がすべて `cohesiveResponsibilities` の1つの組に含まれる → 違反しない
6. 組の中の責務と、組の外の責務が混ざる → 違反
7. 2つの組にまたがる(どの1つの組にも全部は含まれない)→ 違反
8. `cohesiveResponsibilities` を省略したら、組が無いものとして判定する
9. 返す順序はコードベース内の出現順(`allClasses` の順・メソッドの順)

### `scoreCodebase`

1. 抽出で責務の混ざったメソッドを作ると、`mixed-method` が1件・10点の減点になる
2. 初期状態のコードベースの点数は、ルールを足す前と変わらない(既存ステージの初期点数のテストで確かめる)

### `violationTargets`

1. `mixed-method` の違反箇所に、該当メソッドのIDが入る

### ステージカタログ(`stageCatalog.test.ts`)

1. 全ステージの模範解答・全白紙設計問題の模範解答で、`findMixedMethods` が空(既存の「模範解答で100点」のテストで自動的に確かめられるが、
   失敗したときに原因が分かるよう個別に書く)
2. 中級1の初期状態から `checkout` の「合計金額を求める」「決済する」を1つのメソッドに抽出すると、`mixed-method` の減点が1件出る
3. 貧血症ステージの模範解答の `debit`・`credit` は違反しない

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- 中級1で、`calculateOrderTotal` と `countOrdersOf` を移したあと、`checkout` の「合計金額を求める」「決済する」を選んで抽出すると、
  点数が10点下がり、点数の内訳に「責務の混ざったメソッド」が出る。内訳から違反箇所へ移動すると、そのメソッドが強調される
- 同じ操作で「決済する」だけを抽出したときは、この減点が出ない
- 中級1の「解答を再生」「解答例の図を見る」で、`prepareOrder` が出ず、最後の手で100点になる
- 貧血症ステージの模範解答は今どおり100点
- 全ステージ・白紙設計の初期状態の点数が変わらない(`docs/stages/report.md` の初期点数の列が変わらない)

E2E: 中級1で `calculateOrderTotal` を `Order` へ、`countOrdersOf` を `Customer` へ移し、`checkout` を選んで
「合計金額を求める」「決済する」にチェックを入れて抽出する → 点数の内訳に「責務の混ざったメソッド」が出る。

## スコープ外

- 初期状態からあるメソッド(まとめ役)の責務の混在の減点
- クラス単位の責務の混在(`responsibilityLimit`)の仕様変更
- 「メソッドとして抽出」ボタンを押す前の警告(抽出のプレビューで減点を予告するなど)
- 白紙設計の問題への `cohesiveResponsibilities` の追加(必要になった時点で書く)
- AI講評の文面の変更
