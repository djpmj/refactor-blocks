# chain-of-responsibility-stage: 上級10「経費申請の審査を Chain of Responsibility へ組み替える」を足す
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

> 重複の確認: Chain of Responsibility を扱うステージ・仕様書は既存にない(`docs/feature-ideas/IDEAS.md` 2026-11-06「2. Chain of Responsibilityのステージ」が未仕様化)。
> 似た題材の `intermediate-member-rank-branching`(中級10)・`advanced-discount-strategy`(上級3)・`advanced-order-state`(上級9)とは、下の「既存ステージとの違い」で差別化している。

## 背景・目的

経費申請の審査が、1つのメソッドの中で「金額の上限 → 領収書 → 二重申請 → 上長の承認」と続く if の連鎖になっている。
ルールを1つ足すにも順番を入れ替えるにも、ほかのルールを全部読んでから直すことになる。この連鎖を **1ルール1クラス** に分けて、
共通の `ApprovalRule` を実装させる上級ステージを1つ足す。次の2つを、変更依頼で触るブロックの差として体験させる。

- ルールの追加は、新しいクラスを1つ足すだけで済む(既存クラスの修正0)
- 審査の順番の変更は、順番を持つ `ClaimReviewer.review`(呼び出し4行と結果の確定だけ)を直せば済み、ルールのクラスは開かない

### 既存ステージとの違い(差別化の確認)

| ステージ | 分け方の軸 | 実行のされ方 | 1クラスのメソッド |
| --- | --- | --- | --- |
| 中級10 会員ランク | 種類(ランク)ごと | キーで1つだけ選ばれる | 価格・送料の2つ |
| 上級3 Strategy | 方式ごと | 外から1つ選んで差し替える | 1つ |
| 上級9 State | 状態ごと | 今の状態が1つ選ばれ、次の状態も決める | 3つ |
| **上級10 CoR(本仕様)** | **ルールごと** | **全ルールが決まった順に流れ、どれかが結論を出したら後ろは素通りする** | 1つ |

ブロック操作(抽出 → 移動 → 実装の設定)は上級3と同じだが、**「順番」を独立した責務(`review-flow`)として残し、順番の変更依頼で差を出す**点と、
理解度チェックで「1つ選ぶ(Strategy)/全部を順に流す(CoR)」を問う点で区別する。新しい操作・採点ルールは作らない(既存の操作だけで100点になる。YAGNI)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | `approvalChainStage`(id `advanced-approval-chain`)を定義し、`advancedStages` 配列の**末尾**(`orderStateStage` の次)に足す。runtime の import を1行足す **(他の新規ステージ仕様と衝突しやすい)** |
| 新規 | `src/infrastructure/stages/runtime/advanced-approval-chain.ts` | infrastructure | C# 書き出し用の `StageRuntime`(全ステージに runtime が必須: `stageCode.test.ts`「全ステージが C# で書き出せる」) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-approval-chain']`(20手)を足す **(衝突しやすい)** |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表を足す **(衝突しやすい)** |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新しい章を末尾に足し、上級9の章から「最後の章」の文言を外す **(衝突しやすい。末尾の章の書き換えが他の新規ステージと重なる)** |
| 新規 | `src/infrastructure/stages/approvalChainStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`orderStateStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 初期違反の種類の表に1行、近道(`shortcuts`)に2件 **(衝突しやすい)** |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のファイルスナップショット) **(衝突しやすい。他の新規ステージと同時に入ったら再生成し直す)** |

- domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。新しい依存は足さない。

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`・`StageRuntime`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-approval-chain` |
| level | `'advanced'` |
| title | `上級10: 経費申請の審査を Chain of Responsibility へ組み替える` |
| problem | `経費申請の審査ルールが、1つのメソッドの if の連鎖に詰まっている`(コード識別子を入れない) |
| outcome | `if の連鎖を、順に流れる1ルール1クラスに組み替えられる` |
| learns | `['Chain of Responsibility', '1ルール1クラス']` |
| principles | `['ocp']` |
| limits | `{ method: 22, class: 26, file: 28 }` |
| dependencyLimit | `4`(ClaimReviewer が4つのルールクラスを順に呼ぶため。コメントで理由を書く) |
| conditionNotes | `{ coupling: 'このゲームでは呼び出し先を書き換えられないため、ClaimReviewer が4つのルールを順に呼ぶ形を答えとして認めるため' }` |
| responsibilityLimit | `2` |
| visibilityEnforced | 省略 |

- description: `経費精算の審査。ClaimReviewer の review が、金額の上限・領収書・二重申請・上長の承認の4つのルールを if の連鎖で順に確かめ、最後にどのルールにも止められなかった申請を承認している。ルールを足すにも順番を入れ替えるにも、この長いメソッドを全部読んで直すことになる。申請画面の ClaimController は、前任者が ApprovalRule(インターフェース)経由で審査を流す形に先に書き換えたが、ルールごとのクラスはまだ無い。`
- goal: `4つのルールを、それぞれ新しいクラス(AmountLimitRule/ReceiptRule/DuplicateClaimRule/ManagerApprovalRule)へ分けよう。Extract Methodでルールを check として取り出し、Move Methodでルールのクラスへ移し、4クラスとも ApprovalRule を実装(implements)する。審査の順番と結果の確定は ClaimReviewer に残す。上級3(Strategy)は1つの方式を選んだが、ここでは全ルールが順に流れ、結論を出したルールの後ろは素通りする。メソッドは22行・クラスは26行・ファイルは28行以内、1クラスの責務は2種類まで、依存先は4クラスまで`
- why: `ルールを足すたびに、審査の if の連鎖を全部読み直していました。1ルール1クラスに分けると、新しいルールはクラスを1つ足すだけで済み、順番を変えるときもルールの中身を開かずに済みます。`
- responsibilityNames: `http: '申請の受付'`、`'chain-dispatch': '審査への受け渡し'`、`'rule-amount': '金額の上限'`、`'rule-receipt': '領収書の確認'`、`'rule-duplicate': '二重申請の確認'`、`'rule-manager': '上長の承認'`、`'review-flow': '審査の流れ'`、`'rule-entertainment': '交際費のルール'`
- classNames(自動命名。初期のクラス名と重ねない): `http: 'ClaimRequestValidator'`、`'chain-dispatch': 'ApprovalChainRunner'`、`'rule-amount': 'AmountLimitRule'`、`'rule-receipt': 'ReceiptRule'`、`'rule-duplicate': 'DuplicateClaimRule'`、`'rule-manager': 'ManagerApprovalRule'`、`'review-flow': 'ReviewFlow'`
- methodNames: `http: 'validateClaimRequest'`、`'chain-dispatch': 'runApprovalChain'`、`'rule-amount': 'checkAmountLimit'`、`'rule-receipt': 'checkReceipt'`、`'rule-duplicate': 'checkDuplicateClaim'`、`'rule-manager': 'checkManagerApproval'`、`'review-flow': 'finishReview'`

### 初期コードベース

ID は既存ステージ(上級7の `class-expense` など)と重ねないよう `claim` を使う。`lines` はコードの行数と一致させる(`stageCode.test.ts`)。
1行に文は1つ。後ろに処理が続くので、どの Fragment にも `return` を書かない(結論済みかどうかは `result.IsDecided` で判定し、早期 return しない。
こうすると抽出の前後で実行される処理と出力が変わらない)。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/expense/ClaimController.ts`(`file-claim-controller`) | ClaimController(`class-claim-controller`) | `submitClaim`(`method-submit-claim`・public・`string claimId`) | `frag-submit-load` / 申請IDを検証して申請を読み込む / 2 / `http` / declares `claim: ExpenseClaim`、uses `claimId`<br>`frag-submit-chain` / ApprovalRule(インターフェース)経由で審査に流し、結果を保存する / 3 / `chain-dispatch` / uses `method-approval-rule-check`、declares `result: ReviewResult`、uses `claim` |
| `src/expense/ClaimReviewer.ts`(`file-claim-reviewer`) | ClaimReviewer(`class-claim-reviewer`) | `review`(`method-review-claim`・public・`ExpenseClaim claim, ReviewResult result`) | `frag-rule-amount` / 金額が上限を超えていたら却下する / 3 / `rule-amount` / suggestedName `check`<br>`frag-rule-receipt` / 3,000円以上で領収書が無ければ差し戻す / 3 / `rule-receipt` / suggestedName `check`<br>`frag-rule-duplicate` / 同じ領収書で申請済みなら却下する / 3 / `rule-duplicate` / suggestedName `check`<br>`frag-rule-manager` / 5万円以上で上長の承認が無ければ、承認待ちにする / 3 / `rule-manager` / suggestedName `check`<br>`frag-review-flow` / どのルールにも止められなければ承認し、審査の結果を記録する / 2 / `review-flow` |
| `src/expense/ApprovalRule.ts`(`file-approval-rule`) | ApprovalRule(`class-approval-rule`) | `check`(`method-approval-rule-check`・public・`ExpenseClaim claim, ReviewResult result`・`fragments: []`) | なし(インターフェース役) |

- ルールの4つの Fragment と `frag-review-flow` は、`variables.uses` を `['claim', 'result']`(メソッドの引数の順)にし、宣言するローカル変数名は Fragment 間で重ねない。
  抽出したメソッドの引数が `(ExpenseClaim claim, ReviewResult result)` になり、`ApprovalRule.check` と同じ形になる(実装者は抽出後の引数の並びをテストで確かめる)。

各 Fragment の C# コード(`code.csharp`。行数 = 上の lines):

```csharp
// frag-submit-load
if (string.IsNullOrWhiteSpace(claimId)) throw new ValidationException("申請IDがありません");
var claim = FakeClaimRepository.Find(claimId);
// frag-submit-chain
var result = new ReviewResult();
check(claim, result);
FakeClaimRepository.SaveResult(claim.Id, result.Status);
// frag-rule-amount
var amountLimit = claim.Category == "出張" ? 300000m : 100000m;
var overLimit = claim.Amount > amountLimit;
if (!result.IsDecided && overLimit) result.Reject($"金額が上限 {amountLimit} 円を超えています");
// frag-rule-receipt
var needsReceipt = claim.Amount >= 3000m;
var missingReceipt = needsReceipt && claim.ReceiptIds.Count == 0;
if (!result.IsDecided && missingReceipt) result.SendBack("領収書を添付してください");
// frag-rule-duplicate
var claimedReceipts = FakeClaimRepository.ClaimedReceiptIds();
var duplicated = claim.ReceiptIds.Any(id => claimedReceipts.Contains(id));
if (!result.IsDecided && duplicated) result.Reject("同じ領収書で申請済みです");
// frag-rule-manager
var needsManager = claim.Amount >= 50000m;
var waitingManager = needsManager && !claim.ManagerApproved;
if (!result.IsDecided && waitingManager) result.Hold("上長の承認待ちです");
// frag-review-flow
if (!result.IsDecided) result.Approve();
Log.Info($"申請 {claim.Id} の審査結果: {result.Status}");
```

### runtime(`runtime/advanced-approval-chain.ts`)

`intermediate-member-rank-branching` の runtime と同じ形(bindingDemos は付けない)。

- `entryMethodId: 'method-review-claim'`(ClaimController は初期状態で実装のない ApprovalRule を呼ぶため入口にしない。上級9と同じ判断)
- `entryArguments: ['SampleData.Claim', 'new ReviewResult()']`
- `bindings: { ApprovalRule: 'AmountLimitRule' }`
- `support: [logFile, supportFile('Expense.cs', ...)]`。`Expense.cs` に置くもの:
  - `ExpenseClaim`(`string Id`・`string Category`・`decimal Amount`・`List<string> ReceiptIds`・`bool ManagerApproved`)
  - `ReviewResult`(`string Status = "未審査"`・`bool IsDecided`・`Reject(string)`/`SendBack(string)`/`Hold(string)` は `Status` に理由を入れて `IsDecided = true`、`Approve()` は `Status = "承認"`。それぞれ何をしたか1行出力する)
  - `ValidationException`、`FakeClaimRepository`(`Find`・`ClaimedReceiptIds`・`SaveResult`。何をしたか1行出す偽物)
  - `SampleData.Claim`: 交通費・60,000円・領収書あり・上長未承認(4つ目の上長ルールで「承認待ち」に止まり、連鎖の打ち切りが出力で見える)

### 変更依頼(changeRequests。この順に並べる)

| # | id | kind | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-add-entertainment-rule` | `extend` | 交際費のルールを足して | 取引先との会食(交際費)の申請は、参加者の名前が書かれていなければ差し戻したい。ほかのルールはこれまでどおり使う。 | `rule-entertainment` | 4 | `checkEntertainmentGuests` | なし |
| 2 | `req-duplicate-first` | (modify) | 二重申請のチェックをいちばん先にして | 二重申請が多いので、同じ領収書の確認を最初に回し、見つかったらほかの審査をせずに却下したい。 | `review-flow` | 3 | `reorderDuplicateFirst` | なし |
| 3 | `req-travel-limit` | (modify) | 出張の上限額を上げて | 出張の申請の上限を、30万円から50万円に上げたい。 | `rule-amount` | 3 | `raiseTravelLimit` | `{ from: '営業の佐藤さん', text: '経費で使える金額の決まりを見直す話が、いつか出てくるかもしれないらしいです。' }` |

- 2件目が「順番の変更は順番を持つ場所だけを直す」、1件目が「ルールの追加はクラスを足すだけ」を見せる。ボス(`boss: true`)は付けない(ボスのステージを固定で列挙しているテストを変えないため)。
- うわさは1件目の extend・1件目の modify 以外にしか付けられないので3件目にだけ付ける。文にタイトル・partName・自動命名の名前を含めない。

### 理解度チェック(checks。正解は最長の選択肢にしない・正解の位置を2問で変える)

- `check-1`(answer: 0)「審査のルールを1ルール1クラスの連鎖に分けると、何が良くなる?」
  - 0: `新しいルールを、ほかのルールのクラスを開かずに、クラスを1つ足して足せる` / 解説: `ルールが互いに独立するので、追加や変更でほかのルールを読み直さずに済みます。`
  - 1: `ルールの順番を気にせずに、どの順に並べても同じ審査結果になるようになる` / 解説: `連鎖では、前のルールが結論を出すと後ろは素通りするので、順番で結果が変わります。順番は ClaimReviewer で決めます。`
  - 2: `ルールの数がいくつ増えても、審査を呼び出す側のコードが1行も要らなくなる` / 解説: `呼び出す側は残ります。変わるのは、ルールの中身を知らずに順に流すだけになることです。`
- `check-2`(answer: 2)「Chain of Responsibility と Strategy(上級3)の違いとして、合っているのはどれ?」
  - 0: `Strategy はインターフェースを使うが、Chain of Responsibility は if の連鎖のまま使う` / 解説: `どちらも共通のインターフェースを実装したクラスに分けます。違いは、呼ばれ方です。`
  - 1: `どちらも外から1つのクラスを選んで差し替えるもので、名前が違うだけの同じ形である` / 解説: `1つを選ぶのは Strategy です。連鎖では、並んだ全員に順に申請が回ります。`
  - 2: `Strategy は1つを選んで使い、連鎖は並んだルールに順に回して結論を出したところで止める` / 解説: `Strategy は方式の差し替え、Chain of Responsibility は処理を順に受け渡す形です。`

### 模範解答(`sampleAnswerSteps['advanced-approval-chain']`、20手)

同じ名前 `check` で抽出するので、上級9・中級10と同じく「抽出 → 移動」を1組ずつ行う(同じクラスに同名メソッドがあると Extract Method が失敗するため)。

```ts
'advanced-approval-chain': ([
  ['amount', 'AmountLimitRule'],
  ['receipt', 'ReceiptRule'],
  ['duplicate', 'DuplicateClaimRule'],
  ['manager', 'ManagerApprovalRule'],
] as const).flatMap(([rule, toClass]): SolutionStep[] => {
  const file = `src/expense/${toClass}.ts`;
  return [
    { addFile: file },
    { addClass: { name: toClass, file } },
    { extract: { from: 'review', fragmentIds: [`frag-rule-${rule}`], name: 'check' } },
    { move: { method: 'check', fromClass: 'ClaimReviewer', toClass } },
    { addInterface: { class: toClass, interface: 'ApprovalRule' } },
  ];
}),
```

方針の表(`solutionPhaseTable['advanced-approval-chain']`):

- `{ from: 0, title: '金額の上限のルールを AmountLimitRule に分け、ApprovalRule を実装する', why: '1つのルールを1つのクラスにすれば、そのルールを直すときにほかのルールを読まずに済むため' }`
- `{ from: 5, title: '残りの3つのルールも、同じ形で1ルール1クラスにする', why: 'どのルールも ApprovalRule として同じように並べられ、ClaimReviewer には順番と結果の確定だけが残るため' }`

### 机上の検算(実装時にテストで確かめる)

行数は `lineCount.ts` のとおり「コード行数+1」、メソッドは +3 と Fragment 間の空行、クラスは +3。抽出で残る呼び出し行は2行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| `ClaimReviewer.review` | 4×4 + 3 + 3 + 4 = 26(違反) | 呼び出し4×2 + 3 + 3 + 4 = 18 | メソッド22 |
| `ClaimReviewer` クラス・ファイル | 29 / 29(各違反) | 21 / 21 | 26 / 28 |
| `ClaimController.submitClaim` / クラス | 11 / 14 | 同じ | — |
| ルールクラス(各) | — | メソッド7・クラス10 | — |
| 責務 | ClaimReviewer 5種(違反)・Controller 2種 | ClaimReviewer 1種(`review-flow`)・Controller 2種・各ルール1種 | 2 |
| 依存 | Controller → ApprovalRule | 上記+ ClaimReviewer → 4ルールクラス | 4 |

- 初期: 減点の種類は `['line-limit', 'responsibility']`(line-limit 3件+responsibility 1件)。
- 模範解答後: 100点。循環なし/空の入れ物なし/約束違反なし(4クラスとも `check` を持ち ApprovalRule を実装、`review`・`submitClaim` は契約名と重ならない)/
  極小メソッドなし(ルールのメソッドは処理4行)/横流しなし(`review` は `review-flow` を持つ)/混在した抽出なし/フィールドなし。
- 変更依頼の変更コスト(`scoreChange`):
  - `req-duplicate-first`(review-flow): 初期は巻き込み4(-20)+上限超え3(-30)= 50点 → 解答後は `review` 22行・クラス25行で上限内、波及0 = 100点。
  - `req-travel-limit`(rule-amount): 初期 50点 → 解答後は AmountLimitRule のみ、波及1(ClaimReviewer が呼ぶ。-5)= 95点。
  - 「はっきり楽になる」(1件目の modify): 読む行数 26 → 18(0.75倍以下)。
- 解答例の置き方(`sampleImplementation`)はすべて100点の見込み: extend は ApprovalRule を実装する新クラス(ApprovalRule は Controller から呼ばれているので `'abstract'`)、
  modify は ClaimReviewer / AmountLimitRule。`knownChangeRequestExceptions`・`ALLOWED_SCATTER` に足すものはない。
- 機能の追加の痛み(`measureExtendPain`): 初期は ApprovalRule が未実装で入口にならず既存クラスを1つ書き換える → 解答後は0、置き先 `{ kind: 'new-class', implementing: 'ApprovalRule' }`。
- 数値がずれたら、limits と `linesPerSite` だけを調整してよい(題材・責務・手順は変えない)。

### ストーリー(`storyChapters.ts`)

- 上級9の章: title を `注文の状態` に、outro を `3月の終わり。カスタマーサポートから、返品の相談が届きました。` にする(上級9の1件目の依頼 `req-add-returned-state` へつなぐ)。
- 末尾に足す: `{ stageId: 'advanced-approval-chain', title: '最後の章、経費の審査', speaker: SUZUKI, intro: '経費精算の審査が、1つのメソッドの if の連鎖になっています。ルールを足すたびに全部読み直していて、順番を入れ替えるのも怖いんです。ルールごとに分けて、並べ替えやすくしてください。', outro: '3月31日の夕方。最後の依頼が届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`
- 他の新規ステージが同時に上級の末尾へ入る場合は、後から入る方が「最後の章」を引き継ぐ(マージ時に調整)。

### 設計判断(確定)

1. **ルールは4つ。** 「巨大な if の連鎖」に見え、かつ模範解答を20手(上級9の27手以下)に収めるため。
2. **連鎖は「全員に順に回し、結論済みなら素通り」(リスト型)で表す。** GoF の `next` フィールドで次を持つ形は、ルールクラス間の依存と循環を生み、表現できないため採らない。
3. **順番は `review-flow` の責務として ClaimReviewer に残す。** 順番の変更依頼が「順番を持つ短いメソッドだけを直す」形で採点に出る。ClaimReviewer がルールクラスを直接呼ぶのは上級9と同じ既知の制約(呼び出し先の付け替え操作がない)で、dependencyLimit 4 と conditionNotes で認める。
4. **ApprovalRule を呼ぶのは ClaimController にする(上級9・中級10と同じ「移行の途中」の形)。** 新しいルールのクラスが「呼ばれている抽象」につながり、extend の解答例が100点になる。
5. **早期 return を使わず `result.IsDecided` で素通りさせる。** 抽出の前後で出力が変わらず、振る舞いのテストがどの手の後も緑になる。
6. **クラス名・メソッド名はプレイヤーに付けさせない。** 抽出名は `suggestedName`(`check`)、空いた場所へのドラッグで作るクラスは `classNames` から自動命名。
7. **E2E は足さない。** 新しい操作・UI が無く、使う操作は既存の E2E が守っている(上級3・上級9と同じ判断)。

## 動きの仕様

- ステージ一覧の上級の末尾(上級9の次)に「上級10: 経費申請の審査を Chain of Responsibility へ組み替える」が出る。
- 初期画面: ClaimController → ApprovalRule の依存矢印1本。ClaimReviewer の `review` が行数超過・責務の混在で赤い。
- 操作は既存のものだけ: ルールを1つ選んで抽出(名前の候補 `check`)→ 空いた場所へドラッグして新クラス(自動で `AmountLimitRule` など)→ クラスの右クリックから ApprovalRule を実装。
- 4クラスとも実装すると100点。そのあと変更依頼が「交際費のルールを足して」→「二重申請のチェックをいちばん先にして」→「出張の上限額を上げて」(うわさ付き)の順に出る。

## TDD対象

新しい純粋関数は無い。ステージデータが仕様どおりに採点されることを、先にテストを書いて確かめる(Red → Green、AAA)。

### `approvalChainStage.test.ts`(infrastructure・新規)

- 模範解答は20手である
- 初期は100点未満で、減点の種類は line-limit と responsibility だけ。`method-review-claim` がメソッドの行数上限を超える
- 模範解答を適用すると100点
- 模範解答後、4つのルールクラスが ApprovalRule を `interfaceIds` に持ち、それぞれ `check` の1メソッド・責務1種類だけを持つ
- 模範解答後、ClaimReviewer に残る処理は呼び出し行(`call`)4つと `review-flow` だけで、呼び出しの並びが 上限 → 領収書 → 二重申請 → 上長 の順
- 異常系: 模範解答から `addInterface` の4手を抜くと100点未満(約束違反)
- extend `req-add-entertainment-rule`: 初期は書き換えるクラスが1以上、模範解答後は0で、置き先が `{ kind: 'new-class', implementing: 'ApprovalRule' }`
- modify `req-duplicate-first`: 初期・解答後とも変更箇所は `method-review-claim` の1つだけで、読む行数が 26 → 18、変更コストが 50 → 100
- modify `req-travel-limit`: 解答後の変更箇所は AmountLimitRule の `check` だけ(ClaimReviewer を含まない)
- extend が1件目・modify が2件、3件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['advanced-approval-chain', ['line-limit', 'responsibility']]` を足す
- 近道(`shortcuts`、どちらも100点未満):
  - `ルールのクラスへ移すが ApprovalRule を実装しない`: 模範解答から `addInterface` の手を除いたもの
  - `4つのルールをまとめて1つのクラスへ移す`: `src/expense/RuleBook.ts` と RuleBook を作り、4つのルールの Fragment をまとめて `checkAll` として抽出して RuleBook へ移す(責務の混在・混在抽出で減点)
- その他の全ステージ共通の検査(模範解答で100点・解答例の依頼が100点・うわさ・自動命名・ID重複・変数のつながり・C# 書き出しなど)は、コードの変更なしに新ステージにも効く

## 受け入れ基準

1. ステージ一覧の上級の末尾に「上級10: 経費申請の審査を Chain of Responsibility へ組み替える」があり、学べることに「Chain of Responsibility」「1ルール1クラス」が出る
2. 上級10を開くと、ClaimReviewer の review が行数超過・責務の混在で減点されている
3. review の「金額が上限を超えていたら…」を抽出すると名前の候補が `check` になり、空いた場所へドラッグすると `AmountLimitRule` という名前のクラスが自動でできる
4. 模範解答の手順どおりに操作すると100点になる。解答例の再生でも最後に100点になる
5. 100点のあと、「交際費のルールを足して」は ApprovalRule を実装する新クラスに置くと100点、「二重申請のチェックをいちばん先にして」は ClaimReviewer に置くと100点、3件目の前にうわさ(営業の佐藤さん)が出る
6. ストーリーをオンにすると、上級9のあとに「最後の章、経費の審査」が出て、上級9の章はもう「最後の章」と名乗らない
7. `npm run csharp-export` で上級10の C# プロジェクトが書き出せる(`stageCode.test.ts` が通る)
8. `docs/stages/report.md` が再生成され、上級10の行がある
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- GoF の `next` フィールドで次のハンドラを持つ形(ルールクラス間の依存・循環になるため)。必要になったらフィールドの付け替え操作と合わせて別仕様にする
- ClaimReviewer の呼び出し行を「ApprovalRule の並びを順に回す1行」に置き換える操作(呼び出し先の付け替え)。上級3・上級9と同じ既知の制約
- 新しい採点ルール(順番の検査など)・新しい操作・型の変更・E2E の追加
- ステージ一覧の「パターン比較」表(`presentation/stage/patternComparison.ts`)への行の追加。比較表の5件固定テストを変えることになるので、要るなら別仕様で
- ボスの変更依頼、既存ステージ(中級10・上級3・上級9)のデータ変更(ストーリーの上級9の章の文言だけは直す)
- `docs/feature-ideas/IDEAS.md` の更新(仕様の確定後に呼び出し元が行う)
