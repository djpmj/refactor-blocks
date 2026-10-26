# comparison-quiz-more-questions: 設計くらべに、後半ステージの論点(Strategy・State・インターフェース・Money)の4問を足す

## 背景・目的

実機で「設計くらべ」を開くと、問題は4問(1問目 メール / 2問目 税 / 3問目 帳票 / 4問目 子が1つの継承)しかない
(`src/infrastructure/quizzes/comparisonQuizzes.ts`)。上級ステージで学ぶ Strategy(上級3)・State(上級9)・
インターフェースの分け方(上級6)・値オブジェクト Money(上級7)について、「変更依頼が来たとき楽なのはどちらか」を練習する問題がない。

既存の4問と同じ作り方(ステージの初期コードと模範解答 `sampleAnswerCodebase` を設計A・Bにし、ステージの変更依頼を1つ当てる)で、
5〜8問目の4問を足す。新しい型・判定・画面は作らない。データを足すだけで、今の検証テスト(`comparisonQuizzes.test.ts` の `describe.each`)が新しい問題にもそのまま効く。

本当に新しい仕組みが要るか: 要らない。`ComparisonQuiz` 型・`judgeComparison`・`withoutEmptyShells`・`design()`・`sampleAnswerCodebase` で足りる。
足すのは「ステージの先頭以外の変更依頼を選ぶ」小さな関数1つだけ(上級6・7・9は、使いたい依頼が先頭にないか、先頭が `kind: 'extend'` のため)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/quizzes/comparisonQuizzes.ts` | infrastructure | 5〜8問目を足す。変更依頼をIDで選ぶ `requestById` を足す |
| 変更 | `src/infrastructure/quizzes/comparisonQuizzes.test.ts` | infrastructure | 問題のIDと順番、変更依頼の種類のテストを足す(既存の `describe.each` は新しい問題にも自動で効く) |
| 変更 | `e2e/quiz.spec.ts` | E2E | 「4問」前提の箇所を問題数に合わせる(下の「E2E の直し方」) |

`domain`(`src/domain/quiz/`)・`application`・`presentation`(`ComparisonQuizView.tsx` など)は変更しない。
画面はクイズの一覧(`comparisonQuizzes`)を回しているので、セレクト・「次のクイズへ」・まとめは自動で8問になる。新しい依存は足さない。

## データ・型の変更

型の変更はなし。`comparisonQuizzes.ts` に次を足す。

```ts
/** 先頭以外の変更依頼を使う問題のため。見つからなければ firstRequest と同じく開発時に気づけるよう例外にする。 */
function requestById(stage: Stage, id: string): ChangeRequest
```

参照するステージ(すべて `stageCatalog` に実在し、`sampleAnswerSteps` に模範解答がある):

```ts
const discountStrategy = stageById('advanced-discount-strategy');        // 上級3
const orderState = stageById('advanced-order-state');                    // 上級9
const interfaceSegregation = stageById('advanced-interface-segregation'); // 上級6
const valueObject = stageById('advanced-value-object');                  // 上級7
```

### 追加する4問(この順で、既存の4問の後ろに並べる)

| # | id | title | 設計A | 設計B | 変更依頼 | 正解 |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | `quiz-discount-strategy` | `5問目: プレミアム会員の割引率が変わるなら` | 模範解答 | 初期コード | `req-premium-discount` | A |
| 6 | `quiz-order-state` | `6問目: 支払済みの注文の取り消しが変わるなら` | 初期コード | 模範解答 | `req-paid-refund-fee` | B |
| 7 | `quiz-interface-segregation` | `7問目: タスクの登録が変わるなら` | 模範解答 | 初期コード | `req-task-assignee` | A |
| 8 | `quiz-value-object` | `8問目: 金額の表示が変わるなら` | 初期コード | 模範解答 | `req-hide-yen-decimals` | B |

- `limits` はそれぞれのステージの `limits` をそのまま使う
- 設計は既存と同じく `design(label, codebase)` で作る(空のクラス・ファイルを取り除く)
- 正解の側を A/B で交互にする(既存は A, B, A, B。続けて A, B, A, B)
- `description` はステージの `description` を流用しない(上級ステージの説明は「コピペで持っている」「潰している」など問題点を書いており、答えが透けるため)。下の中立な文を使う

各問の文言(`label` は `comparisonQuizzes.test.ts` の評価語チェック「全部・だけ・ひどい・悪い・良い・ダメ・最悪・最適」に引っかからないこと):

**5問目**
- description: `ネットショップの注文で、会員ランク(通常・プレミアム・VIP)ごとに割引を計算するコード。同じ機能を2通りに書いた設計がある。`
- a: `割引の計算を、ランクごとのクラス RegularDiscount・PremiumDiscount・VipDiscount に分けた設計`
- b: `ランクごとの割引を、DiscountService の calculateDiscount の中の if 分岐で切り替える設計`
- explanation: `ランクごとのクラスに分けた設計なら、プレミアムの割引率の変更は PremiumDiscount の中で済む。if 分岐の設計では、通常・VIPの計算や入力の検証が同居する14行の calculateDiscount に+5行が入り、メソッドの上限18行を超えてしまう。方式ごとにクラスを分けるのが Strategy パターン。`

**6問目**
- description: `ネットショップの注文の支払い・発送・取り消し。注文の状態(未払い・支払済み・発送済み)で振る舞いが変わる処理を、2通りに書いた設計がある。`
- a: `状態ごとの分岐を、Order の pay・ship・cancel のそれぞれの中に書いた設計`
- b: `状態ごとの処理を、UnpaidState・PaidState・ShippedState のクラスに分けた設計`
- explanation: `状態ごとのクラスに分けた設計なら、支払済みの注文の扱いは PaidState の中を読めば済む。分岐を Order の各メソッドに書いた設計では、pay・ship・cancel のどれを直すときも、未払い・発送済みの分岐を一緒に読んで巻き込むことになる。状態そのものをクラスにするのが State パターン。`

**7問目**
- description: `障害対応の連絡を Slack・Teams・Backlog・Chatwork へ送るコード。チャットへの投稿とタスク管理の約束(インターフェース)を、2通りに作った設計がある。`
- a: `投稿は ChatClient、タスク管理は TaskTracker と、インターフェースを役割ごとに分けた設計`
- b: `投稿とタスク管理を、1つのインターフェース CollaborationTool にまとめた設計`
- explanation: `役割ごとに分けた設計なら、タスクの登録を直すのは、本当にタスクを扱う Backlog と Chatwork のクラスで済む。1つにまとめた設計では、タスクを扱えない Slack・Teams の空実装(createTask)まで直す対象になり、投稿の処理と同じクラスで巻き込みも増える。使わない約束を押し付けないのがインターフェース分離の原則。`

**8問目**
- description: `経費精算システム。申請・承認・精算の3つのサービスが、外貨を含む経費の金額を扱う。金額と通貨の持ち方を2通りに作った設計がある。`
- a: `金額を数値、通貨を文字列のまま、各サービスで扱う設計`
- b: `金額と通貨を Money クラスにまとめた設計`
- explanation: `Money にまとめた設計なら、金額の表示の変更は Money の format の中で済む(呼び出し元のサービスは動作確認だけ)。数値と文字列のまま扱う設計では、申請と精算の2つのサービスに同じ表示の処理があり、両方を直したうえ、承認依頼や振込の処理を巻き込む。値とそのルールを1か所にまとめるのが値オブジェクト。`

explanation の「14行」「18行」は上級3の初期コード(`calculateDiscount` の処理 5+3+3+3 行、`limits.method` 18)と依頼の `linesPerSite` 5 から出した値。
実装時に `judgeComparison` の結果(`assessments`)と食い違ったら、数値を結果に合わせて直す(数値以外の文意は変えない)。

### 点数の見込み(実装者の確認用)

`scoreChange` の減点(散らばり10・波及5・巻き込み5・クラス内の巻き込み5・上限超え10)を手で数えた見込み。既存テスト「スコアの差が5点以上」で守られる。

| 問 | 初期コード | 模範解答 | 主な差 |
| --- | --- | --- | --- |
| 5 | 約75 | 約95 | 初期は巻き込み3つ+メソッドの上限超え |
| 6 | 約70 | 約90〜95 | 初期は pay・ship・cancel で巻き込み6つ |
| 7 | 約30 | 約75 | 初期は Slack・Teams の空実装まで4クラスに散らばる |
| 8 | 約65 | 約75 | 初期は2クラスに散らばり+巻き込み5つ。Money は呼び出し元3クラスへの波及がある |

8問目は差が小さい(見込み約10点)。実測で5点未満になったら、変更依頼を `req-accept-euro`(金額の検証)に替える(見込みは同程度の差で、散らばる先が申請と承認になる)。それでも5点未満なら、8問目は入れずに報告する。

## 動きの仕様

- 「設計くらべ」のクイズのセレクトに 5〜8問目が並び、1〜4問目のあとに「次のクイズへ」で順に進める
- 8問目で答えると「結果を見る」が出て、まとめが `8問中N問正解` になる(`summarizeQuiz` は一覧の長さを使っているので変更不要)
- 各問の判定・答え合わせのプレビュー・縮尺のそろえ方は既存の4問と同じ

## TDD対象

データの追加なので、`domain`/`application` の新しいロジックはない。先に `comparisonQuizzes.test.ts` に次を足して Red を確認してから、データを足す。

### `comparisonQuizzes.test.ts`(infrastructure)

- 問題のIDが次の順に並んでいる: `quiz-user-controller-mail`, `quiz-sales-report-tax`, `quiz-sales-report-format`, `quiz-collapse-hierarchy`, `quiz-discount-strategy`, `quiz-order-state`, `quiz-interface-segregation`, `quiz-value-object`(E2E が問題の番号に頼るため順番も固定する)
- どの問題の変更依頼も `changeKindOf(quiz.changeRequest) === 'modify'`(`ChangeRequest.kind` のコメント「quiz・blank の依頼は省略のまま」を守る。上級9の先頭の依頼 `req-add-returned-state` は `extend` で変更箇所も無いため、誤って使わないことの確認になる)
- 既存の `describe.each` が5〜8問目にも効き、次がすべて通る: 空のクラス・ファイルが無い / 設計名に評価語が無い / 両方の設計に変更箇所がある / 引き分けにならない / スコアの差が5点以上
- 正解の側: 5問目と7問目は `a`、6問目と8問目は `b`(`judgeComparison(quiz, 'a').value.answer` で確認)

`requestById` の例外はステージ定義の誤りに開発時に気づくためのもので、`stageById`・`firstRequest` と同じくユニットテストの対象にしない(問題データの読み込み時に必ず通るので、IDの書き間違いは上のテストが落ちて気づける)。

## E2E の直し方(`e2e/quiz.spec.ts`)

- 縮尺のテスト: `for (const questionNumber of [1, 2, 3, 4])` を1〜8問目にする(縮尺の下限0.6は `sharedZoom` で守られている。上級6は7ファイルあるが、収まらない分はパンで見る仕様)
- `answerAllFirstWrong`: `question < 3` を `question < 7` にする(最後の問題の手前まで「次のクイズへ」で進む)。テスト名「4問とも答えて」を「8問とも答えて」に、期待値 `/4問中\d問正解/` を `/8問中\d問正解/` にする
- 「答えていない問題があるまま」のテスト: `selectOption({ index: 3 })` を最後の問題 `index: 7` にする(期待する `まだ答えていない問題があります: 1問目` は変わらない)
- 新しい問題の判定を1つ確かめるテストを足す: 5問目を選んで設計Aを選ぶと、`quiz-verdict` に `楽なのは設計A` と `正解` が出る

## 受け入れ基準

1. `npm run dev` で「設計くらべ」を開くと、クイズのセレクトに `5問目: プレミアム会員の割引率が変わるなら`〜`8問目: 金額の表示が変わるなら` の4つが、1〜4問目のあとに並ぶ
2. 5〜8問目のそれぞれで、答える前の設計名に評価の言葉が無く、メソッドの無いクラスが表示されない
3. 5問目と7問目は設計A、6問目と8問目は設計Bを選ぶと「正解」、反対を選ぶと「不正解」になり、それぞれの解説文が出る
4. 1問目から「次のクイズへ」で8問目まで進み、答えて「結果を見る」を押すと `8問中N問正解` のまとめが出る
5. 5〜8問目でも、設計A・Bのプレビューが同じ縮尺(0.6以上)で並ぶ
6. 1〜4問目の文言・正解・解説は変わらない
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 層分け(中級11 `intermediate-layered-order-api`)の問題。1問目(UserController から保存とメールを分ける)と論点がほぼ同じで、「楽なのはどちらか」の練習としては重なるため、今回は足さない。上の4問を解いたプレイヤーから「層の問題が欲しい」と出たら別Issueで足す
- 上級2(決済ゲートウェイ)・上級4(Factory)・上級8(Template Method)の問題
- ステージにない設計(手で組んだ Codebase)を使う問題。今回はすべて既存ステージの初期コードと模範解答から作る
- `ComparisonQuiz` 型・`judgeComparison`・`ComparisonQuizView` の変更(問題の並べ替え・絞り込み・難易度表示など)
- `kind: 'extend'`(機能追加)の依頼を設計くらべで使えるようにすること
- 設計くらべの結果の保存・習得マップへの反映
