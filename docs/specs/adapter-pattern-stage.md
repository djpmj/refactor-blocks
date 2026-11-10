# adapter-pattern-stage: 上級10「散らばったメール送信SDKの呼び出しを Adapter に閉じ込める」を足す
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

## 背景・目的

`docs/feature-ideas/IDEAS.md` 2026-10-03 の「1. Adapterパターンのステージ」が未仕様化のまま残っている。
既存の実装・仕様書に Adapter を扱うものは無い(`adapter` で grep して IDEAS.md だけがヒット)。近いステージとの違いは次の通りで、重複ではない。

- 中級9(`intermediate-copy-paste-tax`): 同じ「抽出 → 統合 → 1クラスへ移す」操作を使うが、主題はコピペの直し忘れ。外部ライブラリとの境界や依存の向きは扱わない。
- 上級2(`advanced-payment-gateway-interface`): 呼び出し元が**最初から**インターフェース越しに呼んでいる。外部SDKの呼び出しが業務のクラスに散らばった状態から境界を作る練習ではない。
- 中級11(`intermediate-layered-order-api`): `layers` で層の向きを採点するが、外部ライブラリを包む話ではない。

業務のクラス3つがメール配信SDK(`SendGridClient`)をそれぞれ直接呼び、SDK固有の型(`SendGridMessage`)の組み立てまでコピペしている状態から、
「自前の言葉の窓口(インターフェース `MailSender`)+ SDKを包む Adapter」へ組み替える上級ステージを足す。
**外部の変更(SDKのバージョンアップ)が Adapter で止まる**ことを変更依頼で、**業務のクラスが外部ライブラリを直接呼ばなくなる(依存の向きの整理)**ことを既存の層の採点(`layer`)で体験させる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 新ステージ `mailAdapterStage`(id `advanced-mail-adapter`)を定義し、`advancedStages` 配列の**末尾**(`orderStateStage` の次)に足す。runtime を import する。**他の新規ステージ仕様と衝突しやすい** |
| 新規 | `src/infrastructure/stages/runtime/advanced-mail-adapter.ts` | infrastructure | C# 書き出し用の `advancedMailAdapterRuntime`(全ステージに runtime が必須: `stageCode.test.ts`「全ステージが C# で書き出せる」) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-mail-adapter']`(9手)を足す。**衝突しやすい** |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表 `'advanced-mail-adapter'` を足す。**衝突しやすい** |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新しい章を末尾に足し、上級9の章から「最後の章」の文言を外す(章の並び = stages の並び)。**衝突しやすい** |
| 新規 | `src/infrastructure/stages/mailAdapterStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`orderStateStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 「初期違反の種類」に1行、近道(`shortcuts`)に3件を足す。**衝突しやすい** |
| 変更 | `src/infrastructure/stages/layeredOrderApiStage.test.ts` | infrastructure(テスト) | 「層を持つのはこのステージだけ」を、中級11と上級10の2つを期待する形に直す |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のファイルスナップショット)。**衝突しやすい** |

- domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。既存の操作
  (Extract Method・Merge Methods・新しいクラスへの移動・実装するインターフェースの設定)と既存の採点(`layer`・`responsibility`・`contract`・行数)だけで100点になる。
- 新しい依存は足さない。
- `patternComparison.ts`(パターン比較表)・`comparisonQuizzes.ts` には足さない(スコープ外)。

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`・`StageRuntime`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-mail-adapter` |
| level | `'advanced'` |
| title | `上級10: 散らばったメール送信SDKの呼び出しを Adapter に閉じ込める` |
| problem | `メール送信SDKの呼び出しが、注文・会員登録・パスワード再設定に散らばっている` |
| outcome | `外部ライブラリの呼び出しを、自前の窓口と Adapter に閉じ込められる` |
| learns | `['Adapter', '腐敗防止層']` |
| principles | `['dip']` |
| limits | `{ method: 18, class: 25, file: 27 }` |
| dependencyLimit | `1` |
| responsibilityLimit | `1` |
| layers | `[{ name: 'ドメイン', responsibilities: ['ordering', 'membership', 'password-reset'] }, { name: 'Adapter', responsibilities: ['mail-sdk-call'] }, { name: '外部SDK', responsibilities: ['sendgrid-sdk'] }]` |
| visibilityEnforced | 省略(移したメソッドは自動で public になる) |
| conditionNotes | 省略(`dependencyLimit` は0でない) |
| runtime | `advancedMailAdapterRuntime` |

- description: `ネットショップのメール送信。注文確定(OrderService.confirmOrder)・会員登録(MemberService.register)・パスワード再設定(PasswordResetService.requestReset)が、それぞれメール配信サービスのSDK(SendGridClient)を直接呼んでいる。SDK専用の SendGridMessage を組み立てる処理までコピペで3か所にあり、SDKの呼び方が変わると業務のクラスを3つとも直すことになる。自分たちの言葉で「メールを送る」と頼むためのインターフェース MailSender(sendMail)は用意したが、まだ誰も実装していない。SendGridClient は外部のライブラリなので中身は変えない。`
- goal: `SDKを呼ぶ処理を Extract Method で sendMail として取り出し、メソッドエディタの「似た処理を持つメソッド」から3つを統合して、新しいクラス(自動で SendGridMailAdapter と名前が付く)へ移そう。最後に SendGridMailAdapter が MailSender を実装(implements)するよう設定する。業務のクラスがSDKを直接呼ばなくなり、層を飛ばす赤い矢印が消える。このゲームでは呼び出し先を書き換えられないので、業務のクラスの矢印は MailSender ではなく SendGridMailAdapter を指す。メソッドは18行・クラスは25行・ファイルは27行以内、1クラスの責務は1種類まで、依存先は1クラスまで`
- why: `メール配信SDKの呼び方が変わるたびに、注文・会員登録・パスワード再設定のクラスを全部開いて直していました。SDKを呼ぶのを Adapter 1つにまとめたので、外部の変更は Adapter で止まり、業務のコードは自分たちの言葉で「メールを送る」と頼むだけになります。`
- responsibilityNames: `ordering: '注文の確定'`、`membership: '会員の登録'`、`'password-reset': 'パスワード再設定'`、`'mail-sdk-call': 'SDKでの送信'`、`'sendgrid-sdk': 'SDKの内部処理'`
- classNames(自動命名。初期のクラス名と重ねない): `ordering: 'OrderConfirmationHandler'`、`membership: 'MemberRegistrationHandler'`、`'password-reset': 'PasswordResetHandler'`、`'mail-sdk-call': 'SendGridMailAdapter'`、`'sendgrid-sdk': 'SendGridApiTransport'`
- methodNames: `ordering: 'completeOrder'`、`membership: 'registerMember'`、`'password-reset': 'issueResetToken'`、`'mail-sdk-call': 'sendMail'`、`'sendgrid-sdk': 'postToSendGrid'`

### 初期コードベース

ID は他ステージと重ならないよう `mail-` を含める(`stageCode.test.ts` の `fragmentById` は全ステージを横断して探すため)。
`lines` はコードの行数と一致させ、1行に文は1つ(`stageCode.test.ts`)。3つの SDK 呼び出しの Fragment は **id 以外(label・code・variables・uses・suggestedName・duplicateGroup)をすべて同じ**にする
(統合の条件 `duplicateGroup`、「同じ duplicateGroup の C# コードは完全一致」、振る舞いのテストの鍵 = 責務|ラベル のため)。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/order/OrderService.ts`(`file-mail-order-service`) | OrderService(`class-mail-order-service`) | `confirmOrder`(`method-mail-confirm-order`・public・`Order order`) | `frag-mail-order-confirm` / 注文内容を確かめて確定し、保存する / 3 / `ordering` / suggestedName `completeOrder`<br>`frag-mail-order-content` / 注文確認メールの宛先・件名・本文を作る / 3 / `ordering` / suggestedName `buildOrderMail`<br>`frag-mail-order-sendgrid` / SendGrid SDK の形式でメールを組み立てて送る / 4 / `mail-sdk-call` / uses `method-mail-sendgrid-send-email`・duplicateGroup `sendgrid-send`・suggestedName `sendMail` |
| `src/member/MemberService.ts`(`file-mail-member-service`) | MemberService(`class-mail-member-service`) | `register`(`method-mail-register-member`・public・`string email, string name`) | `frag-mail-member-register` / 会員を作って保存する / 3 / `membership` / suggestedName `registerMember`<br>`frag-mail-member-content` / 登録完了メールの宛先・件名・本文を作る / 3 / `membership` / suggestedName `buildWelcomeMail`<br>`frag-mail-member-sendgrid` / (上と同じ) / 4 / `mail-sdk-call` / (上と同じ) |
| `src/member/PasswordResetService.ts`(`file-mail-reset-service`) | PasswordResetService(`class-mail-reset-service`) | `requestReset`(`method-mail-request-reset`・public・`string email`) | `frag-mail-reset-token` / 会員を探して再設定用のトークンを発行する / 3 / `password-reset` / suggestedName `issueResetToken`<br>`frag-mail-reset-content` / 再設定メールの宛先・件名・本文を作る / 3 / `password-reset` / suggestedName `buildResetMail`<br>`frag-mail-reset-sendgrid` / (上と同じ) / 4 / `mail-sdk-call` / (上と同じ) |
| `src/mail/MailSender.ts`(`file-mail-sender`) | MailSender(`class-mail-sender`) | `sendMail`(`method-mail-sender-send`・public・`string to, string subject, string body`)、`fragments: []` | なし(インターフェース役) |
| `src/vendor/SendGridClient.ts`(`file-mail-sendgrid-client`) | SendGridClient(`class-mail-sendgrid-client`) | `sendEmail`(`method-mail-sendgrid-send-email`・public・`SendGridMessage message`) | `frag-mail-sendgrid-post` / SendGrid の API へメールを送信する(ライブラリの中身) / 3 / `sendgrid-sdk` / suggestedName `postToSendGrid` |

役割の隠しタグ(`roleResponsibilities`)は使わない(`stageCatalog.test.ts` が役割タグ付きクラスを9件と数えているため)。

各 Fragment の C# コード(`code.csharp`。行数 = 上の lines)と `variables`:

```csharp
// frag-mail-order-confirm   variables: { uses: ['order'] }
if (order.Items.Count == 0) throw new ValidationException("注文に商品がありません");
order.Status = "Confirmed";
FakeOrderRepository.Save(order);
// frag-mail-order-content   variables: { declares: to/subject/body(すべて string), uses: ['order'] }
var to = order.CustomerEmail;
var subject = $"ご注文を承りました(注文番号 {order.Id})";
var body = $"{order.CustomerName} 様、ご注文ありがとうございます。合計 {order.Total} 円です。";
// frag-mail-member-register   variables: { declares: member(Member), uses: ['email', 'name'] }
if (string.IsNullOrWhiteSpace(email)) throw new ValidationException("メールアドレスが必要です");
var member = new Member(email, name);
FakeMemberRepository.Save(member);
// frag-mail-member-content   variables: { declares: to/subject/body(すべて string), uses: ['member'] }
var to = member.Email;
var subject = "会員登録が完了しました";
var body = $"{member.Name} 様、ブロック商事へようこそ。";
// frag-mail-reset-token   variables: { declares: member(Member)・token(string), uses: ['email'] }
var member = FakeMemberRepository.FindByEmail(email) ?? throw new NotFoundException(email);
var token = Guid.NewGuid().ToString("N");
FakeResetTokenStore.Save(member.Id, token);
// frag-mail-reset-content   variables: { declares: to/subject/body(すべて string), uses: ['member', 'token'] }
var to = member.Email;
var subject = "パスワード再設定のご案内";
var body = $"次のURLから30分以内に再設定してください: https://shop.example/reset?token={token}";
// frag-mail-{order,member,reset}-sendgrid(3つとも同じ)   variables: { declares: message(SendGridMessage), uses: ['to', 'subject', 'body'] }
var message = new SendGridMessage { From = new EmailAddress("noreply@shop.example"), Subject = subject };
message.AddTo(new EmailAddress(to));
message.AddContent("text/plain", body);
sendEmail(message);
// frag-mail-sendgrid-post   variables: { uses: ['message'] }
var payload = message.ToJson();
var response = FakeSendGridApi.Post("/v3/mail/send", payload);
if (response.StatusCode >= 400) throw new SendGridException(response.Body);
```

- 宛先・件名・本文の変数名(`to`・`subject`・`body`)と型(`string`)を3つのメソッドでそろえる。抽出したメソッドの引数が3つとも `(string to, string subject, string body)` になり、
  統合でき、`MailSender.sendMail` と同じ形になる。

### 変更依頼(changeRequests。この順に並べる。どちらも modify・ボスなし)

| # | id | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-sendgrid-v4` | メール送信SDKの新しいバージョンに追従して | メール配信SDKがv4になり、宛先の指定方法と送信メソッドの呼び方が変わった。新しい呼び方に直したい。 | `mail-sdk-call` | 4 | `adaptToSendGridV4` | なし(最初に全文を見せる modify) |
| 2 | `req-mail-sandbox` | テスト環境ではメールを実際に送らないで | テスト環境から送るメールは、SDKのサンドボックスモードを使って実際には届かないようにしたい。 | `mail-sdk-call` | 3 | `enableSandboxMode` | `{ from: '先輩の田中さん', text: '「テスト環境からのメールの送り方」を見直したいという話が、いつか出てくるかもしれないらしいです。' }` |

- 機能の追加(extend)の依頼は出さない(「設計判断」4)。ボス(`boss: true`)も付けない(ボスのあるステージを固定で列挙しているテストを変えないため)。

### 理解度チェック(checks。正解の位置を2問で変える。正解の選択肢を最長にしない)

- `check-1`(answer: 1)「メール送信SDKの呼び出しを Adapter に閉じ込めると、SDKのバージョンアップのとき何が良くなる?」
  - 0: `SDKのバージョンアップが要らなくなり、古いSDKを使い続けられる` / 解説: `バージョンアップ自体は必要です。変わるのは、直す場所の数です。`
  - 1: `直すのは Adapter だけで、注文や会員登録のクラスは開かずに済む` / 解説: `SDKの呼び方を知っているのが1クラスだけなので、外部の変更がそこで止まります。`
  - 2: `メールの件名や本文の文言まで、Adapter を1か所直すだけで全部まとめて変えられる` / 解説: `文面はそれぞれの業務の知識なので、各サービスに残しています。Adapter が知るのは送り方だけです。`
- `check-2`(answer: 2)「SendGridMailAdapter の sendMail が、SendGridMessage ではなく宛先・件名・本文の文字列を受け取るのはなぜ?」
  - 0: `SendGridMessage は外部ライブラリの型なので、業務のクラスからはどうやっても参照できないから` / 解説: `参照はできます。呼ぶ側にSDKの型を見せないために、あえて使っていません。`
  - 1: `文字列で受け取ったほうが、メールが速く届くから` / 解説: `速さの話ではありません。境界の形の話です。`
  - 2: `呼ぶ側が自分たちの言葉だけで頼めて、SDKの型を知らずに済むから` / 解説: `SDKの型が呼ぶ側に漏れると、SDKの変更が呼ぶ側まで届いてしまいます。`

### 模範解答(`sampleAnswerSteps['advanced-mail-adapter']`、9手)

```ts
'advanced-mail-adapter': [
  { extract: { from: 'confirmOrder', fragmentIds: ['frag-mail-order-sendgrid'], name: 'sendMail' } },
  { extract: { from: 'register', fragmentIds: ['frag-mail-member-sendgrid'], name: 'sendMail' } },
  { extract: { from: 'requestReset', fragmentIds: ['frag-mail-reset-sendgrid'], name: 'sendMail' } },
  { merge: { methodA: 'sendMail', methodAClass: 'OrderService', methodB: 'sendMail', methodBClass: 'MemberService', name: 'sendMail' } },
  { merge: { methodA: 'sendMail', methodAClass: 'OrderService', methodB: 'sendMail', methodBClass: 'PasswordResetService', name: 'sendMail' } },
  { addFile: 'src/mail/SendGridMailAdapter.ts' },
  { addClass: { name: 'SendGridMailAdapter', file: 'src/mail/SendGridMailAdapter.ts' } },
  { move: { method: 'sendMail', fromClass: 'OrderService', toClass: 'SendGridMailAdapter' } },
  { addInterface: { class: 'SendGridMailAdapter', interface: 'MailSender' } },
],
```

- `move` には `fromClass: 'OrderService'` が必須(`MailSender` にも同名の `sendMail` があるため)。
- `addFile`+`addClass` は、プレイヤーが空いた場所へドラッグして新しいクラスを作る操作(自動で `SendGridMailAdapter` と命名)を表す。

方針の表(`solutionPhaseTable['advanced-mail-adapter']`):

- `{ from: 0, title: 'SDKを呼ぶ処理を、3つのサービスから sendMail として取り出す', why: '業務の処理とSDKの呼び方が同じメソッドに混ざっていると、SDKの変更のたびに業務のコードまで読むことになるため' }`
- `{ from: 3, title: 'コピペされた3つの sendMail を1つに統合する', why: 'SDKの呼び方を知っている場所を1つにすれば、外部の変更で直すのも1か所になるため' }`
- `{ from: 5, title: '統合した sendMail を Adapter へ移し、MailSender を実装する', why: '業務のクラスからSDKへの直接の依存を消し、自分たちの窓口の約束どおりに外部を包むため' }`

### runtime(`src/infrastructure/stages/runtime/advanced-mail-adapter.ts`)

- `entryMethodId: 'method-mail-confirm-order'`、`entryArguments: ['SampleData.Order']`。bindings / bindingDemos は持たない(`MailSender` を呼ぶクラスが無いため)。
- `expectedBuildFailures: ['04', '05', '06', '07']`(1回目の統合のあと、Adapter へ移すまでは、MemberService・PasswordResetService が OrderService の private な `sendMail` を呼ぶのでビルドに失敗する。中級9の `['04', '05']` と同じ理由)。
  実装時に `stageCode.test.ts`「ビルド失敗予定のスナップショットには実際にビルド問題がある」で確かめ、ずれていたら実際の値に合わせる。
- support: `logFile` と、`supportFile('Mail.cs', ...)` に次の偽物を置く。いずれも何をしたかを `Console.WriteLine` で1行出す。
  - `Order`(`Id`・`CustomerEmail`・`CustomerName`・`Total`・`Items`・`Status`)、`Member`(コンストラクタ `(string email, string name)`、`Id`・`Email`・`Name`)
  - `EmailAddress`、`SendGridMessage`(`From`・`Subject`・`AddTo`・`AddContent`・`ToJson()`)、`SendGridResponse`(`StatusCode`・`Body`)、`SendGridException`
  - `ValidationException`・`NotFoundException`(`logFile` など既存の補助ファイルに既にあるものは重ねて定義しない)
  - `FakeSendGridApi.Post`・`FakeOrderRepository.Save`・`FakeMemberRepository.Save / FindByEmail`・`FakeResetTokenStore.Save`・`SampleData.Order`

### 机上の検算(`stageCatalog.test.ts` の保証に通ること)

行数は `lineCount.ts` のとおり Fragment =「コード行数+1」、メソッド = +3 と Fragment 間の空行、クラス = +3 とメソッド間の空行。抽出で残る呼び出し行
`sendMail(to, subject, body);` は 1+1 = 2行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| 業務の3メソッド(各) | 4+4+5+3+2 = 18 | 4+4+2+3+2 = 15 | メソッド18 |
| 業務の3クラス・ファイル(各) | 21 / 21 | 18 / 18 | クラス25 / ファイル27 |
| `SendGridMailAdapter.sendMail` / クラス | — | 8 / 11 | 18 / 25 |
| `SendGridClient.sendEmail` / クラス | 7 / 10 | 7 / 10 | 18 / 25 |
| 責務の種類 | 業務の各クラス2種(3件違反)・SDK 1種 | どのクラスも1種(呼び出し行は数えない) | 1 |
| 依存 | 業務の3クラス → SendGridClient | 業務の3クラス → SendGridMailAdapter → SendGridClient | 1 |
| 層 | ドメイン → 外部SDK が層を飛ばす(3件違反) | ドメイン → Adapter → 外部SDK(違反なし) | — |

- 初期: responsibility 3件+layer 3件 = **40点**。減点の種類は `['responsibility', 'layer']`。
- 模範解答後: **100点**。確認した規則: 循環なし/空の入れ物なし/未使用 private なし/約束違反なし(Adapter は `sendMail` を持ち MailSender を実装、業務のクラスの public メソッド名は契約名と重ならない)/
  極小メソッド・薄いクラスなし(`sendMail` は5行)/横流しなし/混在した抽出メソッドなし/フィールドなし。
- MailSender は処理を持たないので層が決まらず、キャンバスでは「未分類」の段に出る(既存の `layerLanes` の仕様どおり。見た目の調整はスコープ外)。
- 変更依頼: どちらも初期は業務の3クラスにまたがり、模範解答後は SendGridMailAdapter 1クラス。`isClearlyRelieved`(1件目)は場所 3→1・クラス 3→1 で満たす。
  解答例の置き方(`sampleImplementation`)は Adapter に置いて100点になる想定(Adapter は `mail-sdk-call` だけを持つ)。`knownChangeRequestExceptions` に足すものは無い。
- うわさ: `rumoredRequests` は1件目の modify を除くので、2件目だけがうわさを持つ。話し手は既存の章の話し手、1文、タイトル・partName・自動命名の名前を含まず「かもしれない」「らしい」を含む。
- 振る舞いのテスト: 3つの SDK 呼び出しの Fragment のラベルが同じなので、統合しても鍵(責務|ラベル)は変わらず、どの手の後も緑。

### ストーリー(`storyChapters.ts`)

- 上級9の章: title を `注文の状態` に、outro を `3月の下旬。発送済みの注文について、返品の相談が届きました。` にする(上級9の1件目の依頼 `req-add-returned-state` へつなぐ)。
- 新しい章を末尾に足す: `{ stageId: 'advanced-mail-adapter', title: '最後の章、メール配信SDK', speaker: SUZUKI, intro: 'PMの鈴木です。メール配信のSDKが、近いうちに新しいバージョンになるそうです。今は注文・会員登録・パスワード再設定のあちこちから直接呼んでいて、全部直すことになります。SDKの呼び方を1か所に閉じ込めておいてください。', outro: '3月31日の夕方。SDKの新しいバージョンの案内が届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`

## 動きの仕様

- ステージ一覧の上級の末尾(上級9の次)に「上級10: 散らばったメール送信SDKの呼び出しを Adapter に閉じ込める」が出る。
- 初期画面: 層の帯が「ドメイン」「外部SDK」(と「未分類」に MailSender)で出て、業務の3クラスから SendGridClient への3本の矢印が層を飛ばす違反として赤い。
- プレイヤーの操作は既存のものだけ: SDK呼び出しの処理を選んで抽出(名前の候補は `sendMail`)→「似た処理を持つメソッド」から統合 → 空いた場所へドラッグして新しいクラス(自動で `SendGridMailAdapter`)へ移す → クラスの右クリックから MailSender を実装。
- 移した直後は「実装の宣言漏れ」(contract)で減点が残り、MailSender を実装すると100点になる。
- 100点のあと、変更依頼は「SDKの新しいバージョンに追従」→「テスト環境ではメールを実際に送らない」(うわさ付き)の順に出て、どちらも Adapter 1クラスで済む。

### 設計判断(確定)

1. **外部SDKをステージ内のクラス `SendGridClient` として置く。** 依存は `Fragment.uses` からしか出ないので、SDKをクラスにしないと「業務 → 外部ライブラリ」の矢印が描けない。
   層(`layers`)の採点と組み合わせると、初期の「業務が外部SDKを直接呼ぶ」が層飛ばしの違反になり、依存の向きの整理を既存の採点だけで示せる。中身を変えないことは説明文で伝え、操作の禁止(ロック)は作らない(YAGNI)。
2. **自前のインターフェース MailSender を最初から用意し、Adapter に実装させる。** 移した `sendMail` は public になり、契約名と同じなので実装を宣言しないと既存の contract で減点される。GoF の Target(MailSender)・Adapter・Adaptee(SendGridClient)・Client(業務の3クラス)がそのまま揃う。
3. **業務のクラスの矢印は MailSender ではなく Adapter を指したままにする。** 呼び出し先(`uses`)を書き換える操作は無く、上級2・上級3・上級9の仕様と同じ既知の制約。goal に一言書いて正直に見せる。新しい操作は足さない。
4. **extend(別のメール配信サービスへの乗り換え)の依頼は出さない。** MailSender を呼ぶクラスが無いので、新しい実装クラスを足す解答例が「どこからも呼ばれないクラス」になり100点にならない(上級9仕様の設計判断2と同じ事情)。SDKのバージョンアップ(modify)だけで「外部の変更が Adapter で止まる」ことは十分示せる。
5. **3つの SDK 呼び出しはコピペ(duplicateGroup)にし、統合させる。** 統合せずに3つとも Adapter へ移すとクラスが29行で上限25を超えるので100点にならない(近道2)。
6. **E2E は足さない。** 新しい操作・UIは無く、使う操作(抽出・統合・新しいクラスへの移動・実装の設定)は既存の E2E が守っている(上級3・上級9の仕様と同じ判断)。既存の E2E が通ることだけを確かめる。

## TDD対象

新しい純粋関数は無い。ステージデータが仕様どおりに採点されることを、先にテストを書いて確かめる(Red → Green)。AAA で書く。

### `mailAdapterStage.test.ts`(infrastructure・新規)

- 模範解答は9手である
- 初期は40点で、減点の種類は responsibility(3件)と layer(3件)だけ
- 初期の layer 違反は、業務の3クラスから SendGridClient への依存である
- 模範解答を適用すると100点で、layer の減点は0
- 模範解答後、SendGridMailAdapter が MailSender を `interfaceIds` に持ち、メソッドは `sendMail` 1つ、責務は `mail-sdk-call` だけ
- 模範解答後、SendGridClient を呼ぶ(依存する)クラスは SendGridMailAdapter だけ、業務の3クラスの依存先は SendGridMailAdapter だけ
- 模範解答後、業務の3クラスに `mail-sdk-call` の処理が残っていない(呼び出し行だけ)
- 模範解答後も SendGridClient の中身(メソッド・処理)は初期と同じ
- 異常系: 模範解答から `addInterface` を抜くと100点未満(contract が1件)
- modify `req-sendgrid-v4`: 初期の変更箇所は3クラス、模範解答後は SendGridMailAdapter の1クラス
- 2件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['advanced-mail-adapter', ['responsibility', 'layer']]` を足す
- 近道(`shortcuts`、いずれも100点未満):
  - `Adapter へ移すが MailSender を実装しない`: 模範解答から `addInterface` の手を除いたもの(contract)
  - `統合せずに3つとも新しいクラスへ移す`: `sendOrderMail`・`sendWelcomeMail`・`sendResetMail` として抽出し、`src/mail/SendGridMailAdapter.ts` に SendGridMailAdapter を作って3つとも移す(クラス29行・ファイル29行で行数違反)
  - `統合した sendMail を SendGridClient へ移す`: 模範解答の0〜4手のあと `move sendMail(OrderService) → SendGridClient`(SendGridClient の責務が2種類になり、実装の宣言漏れも出る)
- その他の全ステージ共通の検査(模範解答で100点・依頼の解答例が100点・うわさ・自動命名・ID重複・outcome など)は、コードの変更なしに新ステージにも効く

### `layeredOrderApiStage.test.ts`(infrastructure・変更)

- 「層を持つのはこのステージだけ」を「層を持つのは中級11と上級10だけ」にし、`['intermediate-layered-order-api', 'advanced-mail-adapter']` を期待する

## 受け入れ基準

1. ステージ一覧を開くと、上級の末尾(上級9の次)に「上級10: 散らばったメール送信SDKの呼び出しを Adapter に閉じ込める」があり、学べることに「Adapter」「腐敗防止層」が出る
2. 上級10を開くと初期点が40点で、業務の3クラスから SendGridClient への矢印が層を飛ばす違反として赤く、3クラスが責務の混在で減点されている
3. confirmOrder の「SendGrid SDK の形式でメールを組み立てて送る」を抽出すると名前の候補が `sendMail` になり、統合したメソッドを空いた場所へドラッグすると `SendGridMailAdapter` という名前のクラスが自動でできる
4. 模範解答の手順どおりに操作すると100点になり、赤い矢印が消える。解答例の再生でも最後に100点になる
5. 100点のあと、変更依頼「メール送信SDKの新しいバージョンに追従して」は SendGridMailAdapter に置くと100点になる。2件目の依頼にはうわさ(先輩の田中さん)が先に出る
6. ストーリーをオンにすると、上級9のあとに「最後の章、メール配信SDK」が出て、上級9の章はもう「最後の章」と名乗らない
7. `npm run csharp-export` で上級10の C# プロジェクトが書き出せる(`stageCode.test.ts` の runtime 関連の検査が通る)
8. `docs/stages/report.md` が再生成され、上級10の行がある
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 別のメール配信サービス(Amazon SES など)の Adapter を足す extend の依頼。業務のクラスが MailSender を呼ぶ形を作れない(設計判断3・4)。必要になったら、呼び出し先の付け替え操作と合わせて仕様化する
- 業務のクラスの呼び出しを MailSender へ付け替える操作(Extract Interface 相当)。上級2・上級3・上級9と同じ既知の制約
- 外部ライブラリのクラスを読み取り専用にする(移動・抽出を禁止する)仕組み。説明文で「中身は変えない」と伝えるだけにする
- MailSender を「未分類」ではなくドメインの段に出す見た目の調整
- パターン比較表(`patternComparison.ts`)・比較クイズ(`comparisonQuizzes.ts`)への Adapter の追加
- 新しい採点ルール・新しい操作・型の変更、ボスの変更依頼、既存ステージのデータ変更(ストーリーの上級9の章の文言だけは直す)
- `docs/feature-ideas/IDEAS.md` の更新(仕様化した案の片付けは呼び出し元が行う)
