# flag-argument-split-stage: 中級「true / false で動きが変わる save」(フラグ引数の分割)を足す
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

> **重複の確認**: 既存の実装・仕様書に、フラグ引数を扱うステージ・操作は無い(`docs/feature-ideas/IDEAS.md` の「5. フラグ引数の分割ステージ」が未仕様化のまま残っているだけ)。
>
> **他の新規ステージ仕様との衝突**: 登録ファイル(`intermediateStages.ts` の配列末尾・`sampleAnswer.ts`・`storyChapters.ts`・
> `stageCatalog.test.ts` の初期違反の表と近道・`docs/stages/report.md`)は、ほかの新ステージも同じ場所に足す。
> 中級の番号(タイトルの「中級13」)は先着順で、実装時にマージ済みの `intermediateStages` を見て決め直す。

## 背景・目的

`save(user, true)` のように、bool の引数(フラグ引数)で中の動きが丸ごと切り替わるメソッドは、新卒〜4年目のコードによく出てくる。
呼び出し側からは `true` の意味が読めず、1つのメソッドに「新規登録」と「更新」のような別の役割が混ざる。
今のステージには、この形に気づいて「意図の分かる名前のメソッドに分ける」練習が無い。

ponytail の階段で確かめた結果:

1. **新しい操作は足さない。** 分岐ごとの処理を選んで抜き出すのは、既存の Extract Method でできる。
2. ただし今のデータの形(処理 = 1列に並んだ Fragment)では、分岐の `if (isNew)` を各行のコードに書くしかない。
   そのまま抽出すると `registerNewUser(User user, bool isNew)` のように**抜き出したメソッドにもフラグが残り**、教えたいことと逆になる。
   呼び出し行(抽出で自動生成される1行)にも `if` を付けられない。
3. そこで最小の足し算として、Fragment に「どのフラグの値のときに動く処理か」を表す任意の項目 `guard` を足す。
   - 表示するコードでは、`guard` のある処理の各行の頭に `if (isNew) ` / `if (!isNew) ` を付ける(行数は変わらない)
   - 同じ `guard` の処理だけを抽出したら、`guard` は抜き出したメソッドの中身から外れて**呼び出し行**に移る。
     結果は `if (isNew) registerNewUser(user);` になり、抜き出したメソッドは `registerNewUser(User user)` とフラグ無しになる
   - `guard` の違う処理を一緒に抽出したら、`guard` は中身に残り、フラグが引数として付いてくる(フラグの値で中身が変わる、悪い例が見える)
   - 振る舞いのテスト(実行される処理の集合)・採点は変えない

「呼び出し側の読みやすさ」は、分けたあとの `save` の中身(`if (isNew) registerNewUser(user);` / `if (!isNew) updateExistingUser(user);`)と、
理解度チェックの `save(user, true)` と `registerNewUser(user)` の比べっこで確かめさせる。
画面の外にいる呼び出し元(画面やバッチ)を新しいメソッドへ付け替えるのは、呼び出し先を付け替える操作が無いのでやらない(スコープ外。
上級3・上級9の仕様と同じ既知の制約)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/Codebase.ts` | domain | `Fragment.guard?` を足す(下記) |
| 変更 | `src/domain/codebase/fragmentCode.ts` + `.test.ts` | domain | `guard` のある処理のコード(明示コード・自動生成の呼び出し行の両方)の各行に `if (...) ` を付ける。`guardedCode` を export |
| 変更 | `src/domain/codebase/methodSignature.ts` + `.test.ts` | domain | `sharedGuard` を足し、`inferExtractedSignature` が `guard` の変数を引数に数えるようにする(下記) |
| 変更 | `src/domain/codebase/extractMethod.ts` + `.test.ts` | domain | 共通の `guard` を中身から外して呼び出し行へ移す。呼び出し行のラベルに条件を添える |
| 変更 | `src/domain/codebase/inlineMethod.ts` + `.test.ts` | domain | 呼び出し行の `guard` を、戻す処理(`guard` 無しのもの)に付け直す |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | **衝突注意**。新ステージ `flagArgumentStage` を定義し、`intermediateStages` の**末尾**(`middleManStage` の次)に足す |
| 新規 | `src/infrastructure/stages/runtime/intermediate-flag-argument.ts` | infrastructure | C# 実行用の補助コード(下記)。全ステージが runtime を持つテストのため必須 |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | **衝突注意**。`sampleAnswerSteps['intermediate-flag-argument']`(4手)を足す。8手未満なので `solutionPhaseTable.ts` は変更しない |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | **衝突注意**。中級12の章の次に新しい章を足す(「並びが stages と同じ」テストのため) |
| 新規 | `src/infrastructure/stages/flagArgumentStage.test.ts` | infrastructure(テスト) | ステージ固有のテスト(`memberRankBranchingStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | **衝突注意**。初期違反の種類の表に1行、近道(`shortcuts`)に2件 |
| 変更 | `src/infrastructure/stages/stageCode.test.ts` | infrastructure(テスト) | `guard` の検査を足す(下記) |
| 新規 | `e2e/flag-argument.spec.ts` | E2E | 抽出の呼び出し行に条件が付く・100点になる |
| 変更 | `docs/stages/report.md` | — | **衝突注意**。`npm run stage-report` で再生成する |

- application・presentation は変更しない(呼び出し行のラベルは domain で決まり、コードの表示は `fragmentCode` を通るので、そのまま反映される)。
- `stageCatalog.ts` は `intermediateStages` を展開しているだけなので変更しない。
- 新しい依存は足さない。

## データ・型の変更

### `Fragment.guard`(`src/domain/codebase/Codebase.ts`)

```ts
/** フラグの分岐。この処理は variable が when のときだけ動く。 */
export type FragmentGuard = { readonly variable: string; readonly when: boolean };

export type Fragment = {
  // …既存
  /**
   * この処理は、bool の引数(フラグ)variable が when のときだけ動く。コードの各行の頭に `if (variable) ` / `if (!variable) ` を付けて表示する。
   * guard.variable は variables.uses に書かない(抽出のとき、引数にするかどうかを guard から決めるため)。
   * guard のある処理のコードは、1行1文で、ローカル変数を宣言しない(`if (...) var x = ...;` は C# で書けないため)。省略時は常に動く。
   */
  readonly guard?: FragmentGuard;
};
```

### `fragmentCode.ts`

```ts
/** guard の条件。when が true なら `isNew`、false なら `!isNew`。 */
export function guardCondition(guard: FragmentGuard): string;
/** code の各行の頭に `if (<条件>) ` を付ける。guard が無ければそのまま返す。 */
export function guardedCode(code: string, guard: FragmentGuard | undefined): string;
```

`fragmentCode` は、今の結果(明示コード、または自動生成の呼び出し行)を `guardedCode(…, fragment.guard)` に通して返す。
行数(`lineCount.ts`)は行を足さないので変わらない。C# の書き出し(`generateClassSource` → `fragmentCode`)にもそのまま出る。

### `methodSignature.ts`

```ts
/** 処理がすべて同じ guard(variable と when が一致)を持つならそれを返す。1つでも guard 無し・違う guard があれば undefined。 */
export function sharedGuard(fragments: readonly Fragment[]): FragmentGuard | undefined;
```

`inferExtractedSignature` の変更:

- 選んだ処理に `sharedGuard` が**無い**とき、選んだ処理の `guard.variable` を「使う変数」に足す(引数として渡す)
- 選んだ処理に `sharedGuard` が**ある**とき、`guard.variable` は使う変数に足さない(呼び出し行で判定するので要らない)
- 後ろの処理の `guard.variable` も「後ろで使う変数」に足す(戻り値の判定用。`guard` のある処理は宣言しないので、今回のステージでは結果は変わらない)

### `extractMethod.ts`

`sharedGuard(選んだ処理)` があるとき:

- 抜き出したメソッドの処理から `guard` を外す(中身のコードは `if` 無しになる)
- 呼び出し行に同じ `guard` を付ける。ラベルを `` `${name}() を呼び出す(${variable} が ${when} のとき)` `` にする
  (例: `registerNewUser() を呼び出す(isNew が true のとき)`)
- 呼び出し行の `variables.uses` に `guard.variable` は書かない(上の約束どおり)

`sharedGuard` が無いときは今までどおり(`guard` は処理に残り、変数は引数になる)。

### `inlineMethod.ts`

呼び出し行に `guard` があるとき、戻す処理のうち `guard` を持たないものに、呼び出し行の `guard` を付ける
(抽出 → 戻すで元の形に戻る)。`guard` を持つ処理はそのまま。
`// ponytail: 条件の入れ子(guard のある呼び出し行の先に別の guard の処理)は表さない。今の操作では作れない。入れ子を作れる操作を足すときに条件を合成する`

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `intermediate-flag-argument` |
| level | `'intermediate'` |
| title | `中級13: true / false で動きが変わる save`(番号は冒頭の注意を参照) |
| problem | `true / false の引数ひとつで、メソッドの動きが丸ごと切り替わっている` |
| outcome | `フラグ引数で切り替わる処理を、意図の分かるメソッドに分けられる` |
| learns | `['フラグ引数', 'Extract Method']` |
| principles | `['srp']` |
| limits | `{ method: 18, class: 84, file: 84 }` |
| dependencyLimit | `1`(クラスは1つで依存が無い。0 にすると結合度の理由が必須になるため1) |
| responsibilityLimit | `6` |
| conditionNotes | `{ responsibility: 'このステージはクラスを分けず、1つのメソッドの分け方だけを練習するため' }` |
| runtime | `intermediateFlagArgumentRuntime` |

- description: `会員登録サービスの UserService。save(user, isNew) は、isNew が true なら新規登録(登録日の記録・ウェルカムメール・初回ポイント)、false なら登録内容の更新(上書き・変更のお知らせメール)をする。deactivate(user, byAdmin) は、byAdmin が true なら管理者による強制退会、false なら本人の退会をする。画面やバッチからは save(user, true) や deactivate(user, false) と呼ばれていて、true / false が何を意味するかは、メソッドの中を読まないと分からない。`
- goal: `true / false で切り替わる処理を、意図の分かる名前のメソッドに分けよう。Extract Methodで「新規なら…」の処理をまとめて registerNewUser に、「更新なら…」を updateExistingUser に、deactivate の2つの分岐を banUser / withdrawUser に抜き出す。同じ条件の処理だけを選ぶと、条件は呼び出し側の1行に残り、抜き出したメソッドからフラグが消える。違う条件の処理を一緒に選ぶと、フラグが引数として付いてくる。メソッドは18行・クラスは84行・ファイルは84行以内`
- why: `save(user, true) の true が新規登録のことだと知るには、save の中を全部読む必要がありました。分岐ごとに registerNewUser / updateExistingUser と名前を付けたので、save は「新規なら登録、そうでなければ更新」の2行で読め、新規登録だけを直すときに更新の処理を読まずに済みます。`
- responsibilityNames: `{ 'user-validation': '入力の検証', 'user-register': '新規登録', 'user-update': '登録内容の更新', audit: '操作の記録', 'user-ban': '強制退会', 'user-withdraw': '本人の退会' }`
- classNames(自動命名。初期のクラス名 `UserService` と重ねない): `{ 'user-validation': 'UserValidator', 'user-register': 'UserRegistration', 'user-update': 'UserProfileUpdater', audit: 'AuditRecorder', 'user-ban': 'UserBanHandler', 'user-withdraw': 'UserWithdrawal' }`
- methodNames: `{ 'user-validation': 'validateUser', 'user-register': 'registerNewUser', 'user-update': 'updateExistingUser', audit: 'recordAudit', 'user-ban': 'banUser', 'user-withdraw': 'withdrawUser' }`
  (プレイヤーは名前を考えない。抽出の名前は候補がそのまま入る)

### 初期コードベース

1ファイル・1クラス。ID は他ステージと重ならないよう `flag-` を含める。`lines` はコードの行数と一致させる。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数) |
| --- | --- | --- |
| `src/user/UserService.ts`(`file-flag-user-service`) | UserService(`class-flag-user-service`) | `save`(`method-flag-save`・public・`User user, bool isNew`)<br>`deactivate`(`method-flag-deactivate`・public・`User user, bool byAdmin`) |

`save` の処理(この順):

| id | label | lines | responsibility | guard | suggestedName | variables.uses |
| --- | --- | --- | --- | --- | --- | --- |
| `frag-flag-validate` | 入力を検証する | 3 | `user-validation` | なし | `validateUser` | `user` |
| `frag-flag-register-store` | 新規なら、登録日を記録してユーザーを追加する | 3 | `user-register` | `{ variable: 'isNew', when: true }` | `storeNewUser` | `user` |
| `frag-flag-register-welcome` | 新規なら、ウェルカムメールと初回ポイントを付ける | 3 | `user-register` | `{ variable: 'isNew', when: true }` | `welcomeNewUser` | `user` |
| `frag-flag-update-store` | 更新なら、登録内容を上書きする | 3 | `user-update` | `{ variable: 'isNew', when: false }` | `storeUserChanges` | `user` |
| `frag-flag-update-notice` | 更新なら、変更のお知らせメールを送る | 2 | `user-update` | `{ variable: 'isNew', when: false }` | `sendChangeNotice` | `user` |
| `frag-flag-audit` | 操作の記録を残す | 2 | `audit` | なし | `recordAudit` | `user`, `isNew` |

`deactivate` の処理(この順):

| id | label | lines | responsibility | guard | suggestedName | variables.uses |
| --- | --- | --- | --- | --- | --- | --- |
| `frag-flag-deactivate-check` | 退会できるユーザーか確かめる | 2 | `user-validation` | なし | `checkActiveUser` | `user` |
| `frag-flag-deactivate-ban` | 管理者による強制退会なら、退会させて管理チームへ知らせる | 3 | `user-ban` | `{ variable: 'byAdmin', when: true }` | `banUser` | `user` |
| `frag-flag-deactivate-self` | 本人の退会なら、退会させてお別れメールを送る | 3 | `user-withdraw` | `{ variable: 'byAdmin', when: false }` | `withdrawUser` | `user` |
| `frag-flag-deactivate-audit` | 退会の記録を残す | 2 | `audit` | なし | `recordDeactivation` | `user`, `byAdmin` |

各処理の C# コード(`code.csharp`。`guard` の `if` はここに**書かない**。表示のときに付く):

```csharp
// frag-flag-validate
if (user is null) throw new ArgumentNullException(nameof(user));
if (string.IsNullOrWhiteSpace(user.Email)) throw new ValidationException("メールアドレスが必要です");
if (string.IsNullOrWhiteSpace(user.Name)) throw new ValidationException("名前が必要です");
// frag-flag-register-store
user.RegisteredAt = SampleData.Now;
FakeUserTable.Insert(user);
Log.Info($"ユーザー {user.Email} を新規登録しました");
// frag-flag-register-welcome
FakeMail.SendWelcome(user.Email);
FakePoints.Grant(user.Email, 500);
Log.Info($"ユーザー {user.Email} に初回ポイントを付けました");
// frag-flag-update-store
user.UpdatedAt = SampleData.Now;
FakeUserTable.Update(user);
Log.Info($"ユーザー {user.Email} の登録内容を更新しました");
// frag-flag-update-notice
FakeMail.SendChangeNotice(user.Email);
Log.Info($"ユーザー {user.Email} に変更のお知らせを送りました");
// frag-flag-audit
FakeAuditLog.Write(user.Email, isNew ? "register" : "update");
Log.Debug("操作の記録を残しました");
// frag-flag-deactivate-check
if (user is null) throw new ArgumentNullException(nameof(user));
if (!user.IsActive) throw new InvalidOperationException("すでに退会しています");
// frag-flag-deactivate-ban
user.IsActive = false;
FakeUserTable.Update(user);
FakeMail.NotifyAdminTeam($"ユーザー {user.Email} を強制退会にしました");
// frag-flag-deactivate-self
user.IsActive = false;
FakeUserTable.Update(user);
FakeMail.SendGoodbye(user.Email);
// frag-flag-deactivate-audit
FakeAuditLog.Write(user.Email, byAdmin ? "ban" : "withdraw");
Log.Debug("退会の記録を残しました");
```

### runtime(`runtime/intermediate-flag-argument.ts`)

- `entryMethodId: 'method-flag-save'`、`entryArguments: ['SampleData.NewUser', 'true']`
- `support`: `logFile` と、`supportFile('Users.cs', …)` に次を書く(各メソッドは `Console.WriteLine` で1行出す。中級12の runtime と同じ書き方)
  - `public class User { public string Email; public string Name; public DateTimeOffset RegisteredAt; public DateTimeOffset UpdatedAt; public bool IsActive = true; }`
  - `ValidationException : Exception`(message を受けるコンストラクタ)
  - `FakeUserTable.Insert(User)` / `Update(User)`、`FakeMail.SendWelcome(string)` / `SendChangeNotice(string)` / `NotifyAdminTeam(string)` / `SendGoodbye(string)`、
    `FakePoints.Grant(string, int)`、`FakeAuditLog.Write(string, string)`
  - `SampleData.Now`(固定の日時)・`SampleData.NewUser`(Email と Name を持つ User)

### 変更依頼(changeRequests。この順に並べる)

| # | id | kind | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-welcome-bonus` | (modify) | 新規登録の特典を変えて | 新規登録の初回ポイントを500から1000に増やし、紹介コードがあれば紹介した人にもポイントを付けたい。 | `user-register` | 4 | `reviseWelcomeBonus` | なし(最初の modify) |
| 2 | `req-ban-appeal` | (modify) | 強制退会に異議申し立ての案内を足して | 管理者が強制退会にしたとき、本人へ異議申し立ての窓口を案内したい。 | `user-ban` | 4 | `addBanAppealNotice` | `{ from: 'PMの鈴木さん', text: '管理者が退会させたときの扱いを、いつか見直したいという話が出ているらしいです。' }` |

- ボス(`boss: true`)は付けない(ボスのあるステージを固定で列挙しているテストを変えないため)。
- extend の依頼は付けない(新しい種類を足す話ではなく、分岐の中を直す話なので)。

### 理解度チェック(checks。正解は最長の選択肢にしない・正解の位置を2問で変える)

- `check-1`(answer: 1)「`save(user, true)` という呼び出しが読みにくいのはなぜ?」
  - 0: `true と書くと、処理が遅くなるから` / 解説: `bool の引数で速さは変わりません。困るのは、読む人に意味が伝わらないことです。`
  - 1: `true が何を意味するか、save の中を読まないと分からないから` / 解説: `呼び出し側から意図が読めず、中の分岐まで追うことになります。registerNewUser(user) なら名前で分かります。`
  - 2: `引数が2つ以上あるメソッドは、どれも同じように読みにくくなってしまうから` / 解説: `引数の数ではなく、true / false のように意味が名前に出ない引数が問題です。`
- `check-2`(answer: 0)「フラグで切り替わる処理を、意図ごとのメソッドに分けると何が良くなる?」
  - 0: `新規登録だけを直すとき、更新の処理を読まずに済む` / 解説: `分岐ごとにメソッドがあれば、直したい意図のメソッドだけを読めば済みます。`
  - 1: `メソッドの数が減って、クラス全体の行数がいつも短くなる` / 解説: `分けるとメソッドは増え、宣言の分だけ行数も増えます。良くなるのは、読む範囲が絞れることです。`
  - 2: `true と false のどちらを渡しても同じ動きになり、引数の渡し間違いを気にせず呼べるようになる` / 解説: `動きは今までどおり2通りです。名前で選べるので、渡し間違いに気づきやすくなります。`

### 模範解答(`sampleAnswerSteps['intermediate-flag-argument']`、4手)

```ts
'intermediate-flag-argument': [
  { extract: { from: 'save', fragmentIds: ['frag-flag-register-store', 'frag-flag-register-welcome'], name: 'registerNewUser' } },
  { extract: { from: 'save', fragmentIds: ['frag-flag-update-store', 'frag-flag-update-notice'], name: 'updateExistingUser' } },
  { extract: { from: 'deactivate', fragmentIds: ['frag-flag-deactivate-ban'], name: 'banUser' } },
  { extract: { from: 'deactivate', fragmentIds: ['frag-flag-deactivate-self'], name: 'withdrawUser' } },
],
```

模範解答後の `save` のコード(条件は呼び出し側の1行に残り、抜き出したメソッドにはフラグが無い):

```csharp
// 入力を検証する
…
// registerNewUser() を呼び出す(isNew が true のとき)
if (isNew) registerNewUser(user);
// updateExistingUser() を呼び出す(isNew が false のとき)
if (!isNew) updateExistingUser(user);
// 操作の記録を残す
…
```

### 机上の検算

行数 = 処理ごとに「コード行数+1(ラベルのコメント行)」、メソッドは +3 と処理間の空行、クラスは +3 とメソッド間の空行。
抽出で残る呼び出し行は1+1 = 2行(`guard` の `if` は同じ行に付くので増えない)。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| `save` | 30(違反) | 17 | メソッド18 |
| `deactivate` | 20(違反) | 16 | メソッド18 |
| `registerNewUser` / `updateExistingUser` | — | 12 / 11 | メソッド18 |
| `banUser` / `withdrawUser` | — | 7 / 7(極小メソッドの2行以下に当たらない) | メソッド18 |
| `UserService` クラス・ファイル | 54 | 78(依頼の部品4行を置いても82) | クラス84 / ファイル84 |
| 責務の種類 | 6種 | 6種 | 6 |

- 初期: line-limit 2件 = **80点**。減点の種類は `['line-limit']`。`docs/stages/report.md` に「初期点が高い」の警告が付く
  (中級8・中級10・中級12と同じ。2つのメソッドで同じ形を繰り返し練習させるのを優先し、減点の種類は増やさない)。
- 模範解答後: **100点**。抽出したメソッドはどれも1種類の責務だけなので、責務の混ざったメソッド(`mixed-method`)に当たらない。
  抽出したメソッドは private のまま、`save` / `deactivate` から呼ばれるので未使用 private にもならない。
- 変更依頼: 1件目は初期の変更箇所が `save`(30行。新規と更新が同居)、模範解答後は `registerNewUser`(12行)だけになり、読む行数が0.75倍以下になる
  (「はっきり楽になる」)。解答例の置き方(`sampleImplementation`)は2件とも100点の見込み。
  実際の数値は `stageCatalog.test.ts` の既存の保証で確かめ、通らなければ `limits.class` / `limits.file` だけを調整する
  (そのときも、初期状態が100点にならないこと・goal の行数の文字を合わせることを守る)。
- 振る舞いのテスト: 入口は `save` と `deactivate`。抽出は実行される処理の集合を変えないので、どの手の後も緑。

### ストーリー(`storyChapters.ts`)

中級12の章(`intermediate-middle-man`)の次に足す。中級12の章の文言は変えない。

```ts
{
  stageId: 'intermediate-flag-argument',
  title: 'true / false で動きが変わる save',
  speaker: TAKAHASHI,
  intro: 'QAの高橋です。会員登録の不具合を調べていたら、save(user, true) と save(user, false) で中の動きがまるで違いました。true が何なのか、毎回中を読まないと分かりません。新規と更新を、名前で区別できる形にしてください。',
  outro: '2月の終わり。営業の佐藤さんから、新規登録の特典について相談がありました。',
},
```

## 動きの仕様

- ステージ一覧の中級の末尾(中級12の次)に「中級13: true / false で動きが変わる save」が出る。
- 初期画面: `UserService` 1クラスに `save` と `deactivate`。2つとも行数超過で赤い。コードを見ると、新規の処理の各行に `if (isNew) `、
  更新の処理の各行に `if (!isNew) ` が付いている。
- 「新規なら…」の2つの処理を選んで抽出すると、名前は候補の `registerNewUser` が入る(プレイヤーは名前を考えない)。
  `save` に `registerNewUser() を呼び出す(isNew が true のとき)` のブロックが残り、コードは `if (isNew) registerNewUser(user);`。
  `registerNewUser` のコードには `if` が無く、引数は `User user` だけ。
- 「新規なら…」と「更新なら…」をまとめて抽出すると、抜き出したメソッドに `bool isNew` の引数が付き、中身の各行に `if` が残る。
  責務の混ざったメソッドとして減点され、行数も超える。
- 4つの分岐をそれぞれ抽出すると100点。100点のあと、変更依頼「新規登録の特典を変えて」→「強制退会に異議申し立ての案内を足して」(うわさ付き)の順に出る。

### 設計判断(確定)

1. **新しい操作は足さず、Fragment の任意項目 `guard` と、抽出・戻す・コード表示の小さな変更で済ませる。** 理由は「背景・目的」の2〜3。
2. **呼び出し元(画面・バッチ)はコードベースに入れない。** 入れても `save(user, true)` のまま付け替えられず、クリア後も読みにくい呼び出しが残って教えたいことと食い違う。
   呼び出し側の読みやすさは、分けたあとの `save` の中身と理解度チェックで見せる。
3. **フラグ引数のメソッドを2つ(`save` と `deactivate`)にする。** 1つだと初期点が90点になり、同じ形を繰り返して手に覚えさせる機会も無い。
   2つ目は分岐の処理が1つずつで、1つ選ぶだけの抽出でもフラグが消えることを見せる。
4. **クラスは分けさせない(責務の上限6)。** このステージの狙いはメソッドの分け方。クラスへの分け方は他の中級ステージで練習する。
5. **共通の処理(検証・記録)は `guard` 無しにし、`save` / `deactivate` に残す。** 分けたあとも「検証 → 振り分け → 記録」の順に読める形を答えにする。
6. **`guard` の処理はローカル変数を宣言しない。** `if (isNew) var x = …;` は C# で書けないため。検査を `stageCode.test.ts` に足す。

## TDD対象

テストを先に書いて Red を確かめてから実装する。AAA で書く。

### `guardedCode` / `fragmentCode`(domain)

- guard が無ければ、コードをそのまま返す
- `{ variable: 'isNew', when: true }` なら各行の頭に `if (isNew) `、`when: false` なら `if (!isNew) ` が付く(3行なら3行とも)
- 行数は変わらない(`fragmentLines` が guard の有無で同じ)
- 自動生成の呼び出し行(`responsibility: 'call'`)に guard があれば `if (isNew) registerNewUser(user);` になる

### `sharedGuard` / `inferExtractedSignature`(domain)

- 全部が同じ guard → その guard。1つでも guard 無し → undefined。variable が同じで when が違う → undefined。空配列 → undefined
- 同じ guard の処理だけを選ぶと、guard の変数は引数に入らない(`user` だけ)
- guard の違う処理を一緒に選ぶと、guard の変数(`isNew`)が引数に入る(宣言順は今までどおり)
- guard 無しの処理だけを選んだときの結果は今までと同じ(既存テストがそのまま通る)

### `extractMethod`(domain)

- 同じ guard の処理を抽出すると、抜き出したメソッドの処理から guard が消え、呼び出し行に guard が付き、ラベルが `registerNewUser() を呼び出す(isNew が true のとき)` になる
- guard の違う処理を一緒に抽出すると、処理の guard は残り、呼び出し行に guard は無く、ラベルは今までどおり
- 元の Codebase は変わらない

### `inlineMethod`(domain)

- guard 付きの呼び出し行を戻すと、guard を持たない処理に呼び出し行の guard が付く(抽出 → 戻すで元の処理と同じ guard になる)
- guard を持つ処理は、その guard のまま戻る
- guard の無い呼び出し行を戻したときは今までどおり

### `flagArgumentStage.test.ts`(infrastructure・新規)

- 模範解答は4手で、初期は80点・減点の種類は line-limit だけ
- 模範解答を適用すると100点
- 模範解答後、`registerNewUser` / `updateExistingUser` / `banUser` / `withdrawUser` の引数に `isNew` / `byAdmin` が無く、処理に guard が無い
- 模範解答後、`save` の呼び出し行2つに guard(`isNew` true / false)が付き、生成コードに `if (isNew) registerNewUser(user);` と `if (!isNew) updateExistingUser(user);` が含まれる
- 異常系: 「新規なら…」2つと「更新なら…」2つをまとめて抽出すると、抜き出したメソッドの引数に `isNew` が付き、`mixed-method` の減点が出て100点未満
- 変更依頼 `req-welcome-bonus`: 初期の変更箇所は `save`、模範解答後は `registerNewUser` だけで、読む行数が0.75倍以下
- 2件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['intermediate-flag-argument', ['line-limit']]` を足す
- 近道(`shortcuts`、どちらも100点未満):
  - `新規と更新の処理をまとめて1つのメソッドに抜き出す`: `save` の4つの分岐を1手で `saveUser` に抽出し、`deactivate` は模範解答どおり
  - `新規の処理だけを抜き出し、更新の処理は save に残す`: 模範解答から2手目を除いたもの(`save` が行数超過のまま)
- その他の全ステージ共通の検査(模範解答で100点・解答例の依頼・うわさ・自動命名・ID重複など)は、コードの変更なしに新ステージにも効く

### `stageCode.test.ts`(infrastructure・変更)

- guard のある処理は `variables.declares` を持たず、コードに `var ` で始まる行が無い
- guard の変数は、メソッドの引数か手前の処理が作った変数で、その処理の `variables.uses` には書かれていない
- 既存の `variableFlowProblems` に guard の変数も含めて確かめる

## 受け入れ基準

1. ステージ一覧の中級の末尾に「中級13: true / false で動きが変わる save」があり、学べることに「フラグ引数」「Extract Method」が出る
2. 開くと初期点が80点で、`save` と `deactivate` が行数超過。コード表示で、分岐の処理の各行に `if (isNew) ` / `if (!isNew) ` が付いている
3. 「新規なら…」の2つを選んで抽出すると、名前の候補が `registerNewUser` になり、`save` に「registerNewUser() を呼び出す(isNew が true のとき)」が残る。
   コード表示は `if (isNew) registerNewUser(user);` で、`registerNewUser` の引数は `User user` だけ、中身に `if` が無い
4. 新規と更新の処理をまとめて抽出すると、抜き出したメソッドに `bool isNew` が付き、点数の内訳に「責務の混ざったメソッド」が出る
5. 模範解答の手順どおりに操作すると100点になる。解答例の再生でも最後に100点になる。ソースのダウンロード(C#)ができる
6. 100点のあと、変更依頼「新規登録の特典を変えて」で `registerNewUser` に部品を置くと置き方が100点になる。2件目の依頼にはうわさ(PMの鈴木さん)が先に出る
7. ストーリーをオンにすると、中級12のあとに「true / false で動きが変わる save」の章が出る
8. 既存の全ステージの点数・コード表示・抽出の結果が変わらない(既存ステージに guard を持つ処理は無い)
9. `docs/stages/report.md` が再生成され、新ステージの行がある
10. `npm run check` と `npm run test:e2e` が通る

E2E(`e2e/flag-argument.spec.ts`): 新ステージを開き、`save` のメソッドエディタで「新規なら、登録日を記録してユーザーを追加する」
「新規なら、ウェルカムメールと初回ポイントを付ける」にチェックを入れて抽出する → `save` に「registerNewUser() を呼び出す(isNew が true のとき)」のブロックが出る。
続けて残り3つの分岐を抽出すると、点数が100点になる。ステージの開き方・抽出の操作は既存の中級ステージの E2E と同じ手順(ヘルパー)を使う。

## スコープ外

- 呼び出し元(画面・バッチ)を `registerNewUser` などへ付け替える操作、フラグ引数のメソッド(`save`)を消すこと。呼び出し先の付け替えは上級3・上級9と同じ既知の制約
- 「フラグ引数を分ける」専用の新しい操作・メニュー
- 新しい採点ルール(「フラグ引数のメソッド」の減点など)。行数と既存の `mixed-method` で十分
- 条件の入れ子・`else` ・3値以上の分岐(enum・文字列)の表現。`guard` は bool 1つの true / false だけ
- Merge Methods での `guard` の扱い(このステージはクラスが1つで統合できない。guard を持つ処理を統合できるステージを作るときに、guard の一致を形の一致に含める)
- 抽出したメソッドを public にすること(採点に関係しないので求めない)
- ボス・extend の変更依頼
- 既存ステージのデータの変更(`guard` を既存ステージに足すことを含む)
- `docs/feature-ideas/IDEAS.md` の更新(仕様の確定後に呼び出し元が行う)
