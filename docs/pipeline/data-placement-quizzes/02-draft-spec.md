# 設計くらべクイズに「データとふるまいの置き場所」の問題を足す(草案)

- slug: `data-placement-quizzes`
- 入力: `docs/pipeline/data-placement-quizzes/01-discovered.md`
- 元の仕様: `docs/specs/design-comparison-quiz.md`(クイズ本体)。1問足した前例は `docs/specs/lone-superclass-scoring.md` の「設計くらべクイズの4問目」

## 背景・目的

- 設計くらべクイズは「直す」ではなく「**見分ける**」を練習する唯一のモード。今の4問は「何でも屋を分ける(1問目)」
  「よく変わる所を閉じ込める(2・3問目)」「子が1つしかない継承(4問目)」だけで、フィールドを使うステージ
  (中級6 Feature Envy・中級7 getter/setter だけの口座・中級8 Extract Class・上級7 Money)の観点が1問も無い。
- 新卒〜4年目のレビューで多い指摘「そのロジックはデータを持っているクラスに置く」「金額と通貨をばらばらに持たない」を、
  2案を見比べて判断する形で練習できるようにする。

**ponytail**:

- domain / application / presentation は**変更しない**。`ComparisonQuiz` の型、`judgeComparison`、`ComparisonQuizView`
  (選択欄と「次のクイズへ」は `comparisonQuizzes` 配列から作る)、`PreviewClassNode`(フィールドを出す)、
  `CodebasePreviewCanvas`(クラス間の依存の矢印を出す)がそのまま使える。
- 設計は既存ステージの初期コードと `sampleAnswerCodebase(stage)` から作る。新しい設計データ・模範解答の手順は手で書かない。
- 変更依頼は各ステージの**1件目**を使う(未決事項2の推奨どおりなら)。既存の `firstRequest` をそのまま使え、
  `requestById` のような新しいヘルパーは要らない。
- 問題ごとの個別テストは足さない(未決事項5)。全問共通の `describe.each` が新しい問題にも自動で効き、
  点数の前後は各ステージのテスト(`featureEnvyStage.test.ts` など)が既に固定している。

### 調べて分かった注意点(explanation の書き方に効く)

`scoreChange` が測るのは「散らばり・波及・巻き込み・上限超え」だけで、**Feature Envy(他クラスのデータを触ること)そのものは測らない**。
そのため中級6・7では、点数の差は「データの持ち主へ移したこと」ではなく「長いメソッドから依頼の処理を切り離したこと」から生まれる。
実際、手で計算すると次のようになる(どれも `measureChange` の定義から計算。既存テストでは固定していない値)。

| ステージ・依頼 | 初期コード | 模範解答(持ち主へ移す) | 抽出だけして元のクラスに残す(参考) |
| --- | --- | --- | --- |
| 中級6 `req-free-admin-seat` | 75 | 95(`BillingService` への波及 -5) | 100 |
| 中級7 `req-premium-daily-limit` | 70 | 85(波及 -5・巻き込み -10) | 100 |

つまり「抽出だけした設計 vs 持ち主へ移した設計」を比べる問題は、今の採点では**持ち主へ移さない方が正解**になってしまうので作らない(スコープ外)。
今回は「初期コード vs 模範解答」だけを比べ、explanation に「移したから点が上がった」とは書かない
(変更箇所が小さなメソッドにまとまっている・長いメソッドの無関係な処理を巻き込まない、という実際の理由を書く)。
上級7・中級8は、クラスの分け方そのもの(散らばり・クラスの上限超え)で差が付くので、この注意は要らない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/infrastructure/quizzes/comparisonQuizzes.ts` | infrastructure | 変更 | 配列の**末尾**に5問目・6問目を足す(推奨案の場合。未決事項1で3問になれば7問目も) |

変更しないもの(確認済み):

- `src/infrastructure/quizzes/comparisonQuizzes.test.ts` — `describe.each` で新しい問題にも「引き分けなし・両方に変更箇所あり・差5点以上」が効く。
  「正解が全問同じ側に偏らない」も配列全体で効く
- `src/domain/quiz/*`、`src/domain/change/*`、`src/domain/stage/sampleAnswer.ts`(`sampleAnswerCodebase` を呼ぶだけ)
- `src/infrastructure/stages/intermediateStages.ts` / `advancedStages.ts`(読むだけ)
- `src/presentation/quiz/ComparisonQuizView.tsx`、`src/presentation/preview/*`
- `e2e/quiz.spec.ts`(1問目・2問目の見出ししか参照していないので、末尾への追加で壊れない)
- `docs/specs/design-comparison-quiz.md` の一覧表(4問目を足したときも更新していない前例に合わせる。最終仕様 `docs/specs/` 側に書く)

## データ/型の変更

型の変更はない。`comparisonQuizzes` に `ComparisonQuiz` を2件足す。`stageById` で取るステージを2つ増やす。

```ts
const featureEnvy = stageById('intermediate-feature-envy');
const valueObject = stageById('advanced-value-object');
```

どちらの依頼も `kind` を省略している(= `'modify'`)ことを確認済み。

### 5問目: 中級6(Feature Envy)— 正解は設計A(推奨の並べ方の場合)

- id: `quiz-feature-envy-seat`
- title: `5問目: 席の料金ルールが変わるなら`
- description(案): `SaaS の月額課金のコード。契約(Subscription)が持つ席数・単価・状態を使う処理を、どこに置くかが違う2つの設計がある。BillingService の renewSubscription は、トライアルの判定・請求額の計算・カードへの請求・請求書メールを順に行う。`
  - ステージの `description` は初期コードの説明なので使わない(2問目と同じく、両方の設計に当てはまる文を書く)
  - 後半の1文は、プレビューに出ない「renewSubscription の中身」を補うためのもの(未決事項4)
- limits: `featureEnvy.limits`(メソッド60行・クラス150行・ファイル300行)
- 設計A: `{ label: 'トライアル判定・料金計算・解約を、データを持つ Subscription に任せた設計', codebase: sampleAnswerCodebase(featureEnvy) }`
- 設計B: `{ label: 'BillingService が Subscription のフィールドを読んで全部やる設計', codebase: featureEnvy.codebase }`
- changeRequest: `firstRequest(featureEnvy)`(`req-free-admin-seat`「管理者の席は無料にして」、`pricing`、+6行)
- 点数(実測は `featureEnvyStage.test.ts` で固定済み): 設計A 95 / 設計B 75
  - 設計A: 変更は `Subscription.monthlyFee`(30行)だけ。波及 -5(呼び出し元 `BillingService`)
  - 設計B: 変更は94行の `renewSubscription`。巻き込み -15(trial・payment・notification の3種類)、上限超え -10(100行 > 60行)
- explanation(案):
  `料金の計算が、席数と単価を持つ Subscription の monthlyFee(30行)にまとまっていれば、直すのはそこだけで済む(呼び出し元の BillingService は動作確認だけ)。BillingService が Subscription のフィールドを読んで計算する設計では、トライアル判定・カード請求・メール送信と同居した94行の renewSubscription に手を入れることになり、無関係な処理を巻き込んで壊すおそれがあるうえ、上限60行も超える。`

### 6問目: 上級7(Money)— 正解は設計B(推奨の並べ方の場合)

- id: `quiz-value-object-euro`
- title: `6問目: 対応する通貨を増やすなら`
- description(案): `経費精算システム。申請・承認・精算の3つのサービスが、経費の金額と通貨を使う。金額と通貨の持ち方が違う2つの設計がある。`
- limits: `valueObject.limits`(メソッド50行・クラス65行・ファイル300行)
- 設計A: `{ label: '金額(amount)と通貨(currency)を Expense にばらばらに持たせた設計', codebase: valueObject.codebase }`
- 設計B: `{ label: '金額と通貨を値オブジェクト Money にまとめた設計', codebase: sampleAnswerCodebase(valueObject) }`
- changeRequest: `firstRequest(valueObject)`(`req-accept-euro`「ユーロ建ての経費も申請できるようにして」、`money-validation`、+4行)
- 点数(実測は `valueObjectStage.test.ts` で固定済み): 設計A 45 / 設計B 85
  - 設計A: 変更は `submitExpense`(80行)と `approveMonthlyExpenses` の2クラス・+8行。散らばり -10、巻き込み -25、上限超え -20(`submitExpense` と `ExpenseApplicationService`)
  - 設計B: 変更は `Money.validate` だけ・+4行。波及 -15(Money を使う3つのサービス)
- explanation(案):
  `金額と通貨を Money にまとめた設計なら、対応通貨の追加は Money の validate 1か所で済む(Money を使う3つのサービスは動作確認だけ)。amount と currency をばらばらに持たせた設計では、同じ検証のコピペが申請(submitExpense)と承認(approveMonthlyExpenses)の2クラスにあり、両方を直す必要がある。直し忘れた方ではユーロの経費が弾かれてしまう。`

### (未決事項1で3問にした場合)7問目: 中級8(Extract Class)— 正解は設計A

- id: `quiz-extract-class-address`、title: `7問目: 住所の項目を増やすなら`
- 設計A: 模範解答(`Address` を分けた)/ 設計B: 初期コード(`Employee` に同居)
- changeRequest: `firstRequest(extractClass)`(`req-building-name`、`address`、+6行 × 2か所)
- 点数(`extractClassStage.test.ts` で固定済み): 設計A 100 / 設計B 90(上限超え -10: `Employee` 132行+12行 > 120行)
- explanation(案): `住所のフィールドとメソッドを Address(48行)に分けた設計なら、建物名の追加は Address の中で済む。Employee に同居したままだと、住所の変更でも給与計算の入った132行の Employee を開いて+12行することになり、クラスの上限120行を超える。`
- 差は10点と小さく、減点の理由は「上限超え」1つだけ

### 衝突への備え

- 5・6問目の explanation の行数(30行・94行・80行など)は中級6・上級7の初期コードと模範解答から計算した値。
  新しい問題の直前に、次の1行コメントを置く:
  `// 5問目以降の explanation の行数・クラス名は、中級6・上級7のステージデータと模範解答に合わせてある。ステージを変えたら見直す`
- `inline-method-stage`(`intermediateStages.ts`)・`template-method-stage`(`advancedStages.ts`)は新ステージの**追加だけ**で、
  中級6・上級7のデータは変えない見込み(両者の草案を確認済み)。`duplicate-code-scoring` と `inline-method-stage` は
  `scoreCodebase` の減点を増やすが、クイズの判定は `scoreChange` だけなので影響しない。
  もし中級6・上級7のデータや模範解答が変わった場合は、`featureEnvyStage.test.ts` / `valueObjectStage.test.ts` の
  「変更依頼2件の点数」が先に落ちるので、そのとき合わせて explanation を見直す。
- 他のパイプラインが後から同じ配列の末尾に問題を足す場合は、後からマージする側が title の「n問目」を振り直す。

## TDD対象の純粋関数

新しい純粋関数は無い(クイズのデータを足すだけ)。テストを先に書く手順は次のとおり。

1. 先に `comparisonQuizzes.ts` に5問目だけを足し、`npm test -- comparisonQuizzes` で `describe.each` の
   「5問目: …」の2ケース(引き分けにならない・差5点以上)が通ることを確かめる。6問目も同様
2. 途中で片側だけの並べ方にしてしまった場合、「正解が全問同じ側に偏っていない」が落ちないことも確かめる
   (既存4問が A・B 両方を含むので、新しい問題の並べ方ではこのテストは落ちない。並べ方の偏りは未決事項3で決める)

既存のテストで固定されている値(新しく足さない):

- `featureEnvyStage.test.ts`: 変更依頼2件とも初期75点・模範解答95点
- `valueObjectStage.test.ts`: 初期 [45, 35]・模範解答 [85, 85]
- (3問にする場合)`extractClassStage.test.ts`: 初期 [90, 70]・模範解答 [100, 85]

## 受け入れ基準

- `npm run check` が通る(lint・typecheck・test)
- `comparisonQuizzes.test.ts` の `describe.each` に「5問目: 席の料金ルールが変わるなら」「6問目: 対応する通貨を増やすなら」が現れ、
  どちらも「引き分けにならず、両方の設計に変更箇所がある」「2つの設計のスコアの差が5点以上」が通る
- 既存の `e2e/quiz.spec.ts` が変更なしで通る
- 画面で「設計くらべ」を開き、選択欄から5問目を選ぶと、設計Aに `Subscription`(`isInTrial`・`monthlyFee`・`cancel` と5つ+`trialDays` のフィールド)、
  設計Bに `BillingService` と、メソッドの無い `Subscription` が表示される。正解の側を選ぶと「正解」と explanation が出て、
  答え合わせの点数が設計A 95点・設計B 75点になる
- 6問目を選ぶと、設計Aに `Expense`(amount・currency を含む4フィールド)と3つのサービス、設計Bに `Money` が表示され、
  答え合わせの点数が設計A 45点・設計B 85点になる。6問目では「次のクイズへ」ボタンが出ない(最後の問題)
- explanation に書いた行数・クラス名・メソッド名が、答え合わせの「変更が必要: …(◯クラス・◯ファイル・+◯行)」と減点理由に食い違わない

## スコープ外

- **「抽出だけした設計 vs データの持ち主へ移した設計」を比べる問題**。上の表のとおり、今の `scoreChange` では持ち主へ移した方が
  波及の分だけ点が低くなる。作るなら `scoreChange` に Feature Envy・カプセル化の観点を足す必要があり、採点の仕様変更として別件にする
- 中級6と中級7の両方を入れること(同じ観点「データを持つクラスにふるまいを寄せる」が2問続く。推奨案では中級6だけ)
- プレビューで「どのメソッドがどのフィールドを読むか」「メソッドの中の処理」を見せる表示の追加(未決事項4。やるなら別件)
- 模範解答で移したメソッドが private のまま表示される見た目(中級6は `visibilityEnforced` ではない)の手直し
- デザインパターン系(上級2・3・4・6)の問題。上級2・3の依頼には `kind: 'extend'` があり、`measureChange` だけで判定するクイズでは
  「新しいクラスを足すだけで済む」を表しにくい
- クイズの正解数の保存、問題の並び替え・難易度での絞り込み
- `docs/specs/design-comparison-quiz.md` の一覧表の更新

## 未決事項

### 未決事項1: どのステージを使い、何問足すか

- 選択肢A(推奨): 中級6(Feature Envy)と上級7(Money)の2問。探索の見立てどおり。中級6はテーマの「データを持つクラスに仕事を頼む」そのもの、上級7は散らばり(2クラス→1クラス)で差が付き、観点が被らない
- 選択肢B: 中級6・中級8・上級7の3問。「データの塊ごとにクラスを分ける」も入る。ただし中級8は差が10点で、減点理由が「クラスの上限超え」1つだけ
- 選択肢C: 中級8と上級7の2問。クラスの分け方そのもので差が付く2問に絞る(中級6・7は、点数の差が「持ち主へ移したこと」ではなく「長いメソッドから切り離したこと」から生まれるため避ける)
- 選択肢D: 中級7(getter/setter)と上級7の2問。中級6の代わりに「getter で取り出して外で判断する」を題材にする(差は15点。模範解答の debit にも巻き込み -10 が残る)

### 未決事項2: 上級7で使う変更依頼

- 選択肢A(推奨): 1件目 `req-accept-euro`(対応通貨の追加。45点 vs 85点)。既存の `firstRequest` をそのまま使える。コピペされた検証が申請・承認の2クラスにある
- 選択肢B: 2件目 `req-hide-yen-decimals`(円の表示桁。35点 vs 85点)。差は大きいが、2件目を取るヘルパー(`requestById` など)を `comparisonQuizzes.ts` に足す必要がある

(中級6は1件目 `req-free-admin-seat`、中級7を使う場合も1件目 `req-premium-daily-limit` を推奨。中級7の2件目は、入金の依頼なのに `withdraw` も変更箇所に出てしまい直感に反する)

### 未決事項3: 設計A・Bの並べ方(正解の側)

- 選択肢A(推奨): 既存の A, B, A, B を続け、5問目は正解A(模範解答をA)、6問目は正解B(初期コードをA)。どちら側に良い設計があるかを覚えて当てられないようにする
- 選択肢B: 新しい問題はどちらも「初期コードをA・模範解答をB」(正解B)に揃える。作りは単純だが、5・6問目は続けてBを選べば当たる

### 未決事項4: プレビューに出ない情報(どのメソッドがどのフィールドを読むか・メソッドの中の処理)をどう補うか

- 選択肢A(推奨): description と設計の label の文で補う(5問目の description に「renewSubscription はトライアル判定・請求額の計算・カード請求・メールを順に行う」と書く、など)。キャンバスは変えない。行数の赤表示・依存の矢印・フィールドは今のプレビューで見える
- 選択肢B: 文では補わず、キャンバスに見えるもの(クラス・フィールド・メソッド名と行数・依存の矢印)だけで判断させる。答え合わせの「変更が必要: …」と減点理由で気づかせる
- 選択肢C: プレビューにメソッドの中の処理やフィールドの読み書きを出す表示を別件で先に作り、このPRはそれを待つ

### 未決事項5: 問題ごとの個別テストを足すか

- 選択肢A(推奨): 足さない。`describe.each` が新しい問題にも効き、点数の前後は各ステージのテストが固定しているので、正解の側が入れ替わればステージのテストが先に落ちる
- 選択肢B: 新しい問題だけ、正解の側と両方の点数(例: 5問目は正解A・95点と75点)を固定するテストを `comparisonQuizzes.test.ts` に足す。ステージのテストが書き換えられても、クイズの explanation と食い違ったことに気づける

### 未決事項6: E2Eを足すか

- 選択肢A(推奨): 足さない。プレイヤーの操作は変わらず、`ComparisonQuizView` は配列から選択欄を作るだけ。既存の `e2e/quiz.spec.ts` がそのまま通ることを確認する
- 選択肢B: 選択欄から5問目を選ぶと、設計Aに `preview-class-Subscription` が出て、回答すると `quiz-verdict` が出ることを確かめるE2Eを1件足す

### 未決事項7: title・description・label・explanation の文言

- 自由記述で確認が必要。上の「データ/型の変更」の案文でよいか、言い回しの希望があれば指定してほしい(案文の行数・クラス名・点数は手計算とステージのテストで確かめ済み)
