# 重複メソッドの統合(Merge Methods)

## 背景・目的

上級1「通知クラスの共通処理を基底クラスへ集める」(`advanced-notifier-hierarchy`)の模範解答を検証したところ、`EmailNotifier.buildEmailBody`/`logEmailNotification` と `SmsNotifier.buildSmsBody`/`logSmsNotification` を Extract Method → Move Method で `NotifierBase` へ移すだけの手順になっていた。結果、`NotifierBase` は「EmailNotifier専用の2メソッド」と「SmsNotifier専用の2メソッド」を物理的に同じ箱に同居させただけで、1行も実装を共有していない。可視性(private→protected自動昇格)は正しく効くが、Template Method的な「本物の共通化」にはなっていない。

このステージのコードをよく見ると、2種類の処理が混在している。

- `frag-log-email`(24行)と`frag-log-sms`(22行): ラベル「送信ログを記録する」・責務`logging`が完全に同じで、行数も近い。**コピペで生まれた本物の重複コード**であり、1つにまとめられるべき。
- `frag-build-body-email`(32行)と`frag-build-body-sms`(30行): ラベル「通知文を組み立てる」・責務`formatting`も同じだが、メール文面とSMS文面は**中身が本質的に異なる**(チャネルごとの違いそのもの)。まとめるべきではなく、各クラスに残すのが正しい。

つまり、このステージを本当の意味で解決するには「重複した2つの実装を1つに統合する」操作が要る。一方で「抽象メソッドの宣言」は、`fragments: []`(処理本体を持たない契約メソッド)という表現が`advanced-payment-gateway-interface`(`PaymentGateway.charge`)・`advanced-discount-strategy`(`DiscountStrategy.calculate`)ですでに使われており、ステージ作者がコードベースの初期状態として用意する分には**既存の型でそのまま表現できる**。新しく足りないのは「統合する」操作だけ。

## 検討: 抽象メソッドの宣言は新しい操作として要るか(YAGNI)

**要らない。** 現状の`Method.fragments: []`は「処理本体を持たない契約メソッド」としてすでに機能しており(`Codebase.ts`のコメント参照)、プレイヤーが目にするのは常にステージ作者が最初から用意した状態(`advanced-payment-gateway-interface`・`advanced-discount-strategy`)。今回の`advanced-notifier-hierarchy`の作り直しでも、抽象メソッドをプレイヤー自身が「宣言する」場面は出てこない(共通実装をどの箱にまとめるかを操作するだけで解決できる)。

もし将来、プレイヤー自身に「このメソッドを空の契約にする」操作をさせたいステージが出てきたら、そのときに`addClass`/`addMethod`的な最小の新規操作を改めて検討する。今回はスコープ外とする。

## 検討: 「2つの実装を1つに統合する」の設計

### なぜ「責務(responsibility)が同じ」だけでは判定できないか

Fragmentは`id`/`label`/`lines`/`responsibility`/`uses`/`suggestedName`しか持たず、コードの中身(文字列)を持たない。上の例で示した通り、**「本物の重複」(ログ記録)と「同じ責務だが別物」(通知文の組み立て)は、`responsibility`も`label`も両方とも一致してしまい、既存フィールドだけでは区別できない**。responsibilityだけを条件にすると、`buildEmailBody`/`buildSmsBody`まで誤って統合候補になってしまい、チャネルごとの違いを消してしまう(設計ミス)。さらに、他ステージ(`advanced-payment-gateway-interface`の`StripeGateway.charge`/`PaypalGateway.charge`は`['gateway-integration','payment-logging']`という同じ責務列を持つ)にも同じ誤爆が起こり、意図しない統合(=減点逃れの抜け道)を許してしまうおそれがある。

### 採用する設計: Fragmentに`duplicateGroup`という隠しタグを追加する

`responsibility`と同じ粒度で、**ステージ作者が「この処理は別クラスのあの処理と文字通り同じ実装(コピペ)である」と明示するための隠しタグ**を1つ追加する。値が省略されている(`undefined`)処理は、他のどの処理とも統合できない。既存6ステージ+中級3はこのタグを一切使わないため、影響ゼロで安全に導入できる。

これにより、`mergeMethods`の「統合してよいか」の判定は「responsibilityが同じ」ではなく「`duplicateGroup`が同じ値で、かつ両方に設定されている」になる。ステージ作者が明示的に opt-in した処理同士だけが統合候補になるので、既存ステージへの誤爆(意図しない減点逃れ)が起こらない。

## 検討: ワンオフか汎用機能か

`mergeMethods`/`findMergeCandidates`はどのステージのコードベースにも使える汎用の純粋関数にする(ステージ固有の分岐を書かない)。`duplicateGroup`はステージ作者がデータで opt-in するだけなので、将来別のステージで「2クラスにまたがる重複コードを1つにまとめる」教材を作りたくなったら、コードベース定義に`duplicateGroup`を足すだけで再利用できる。過剰な汎用化(統合先クラスを選ぶUIなど)は作らない(後述)。

## 検討: UIへの影響

新しいドラッグ操作は作らない。既存のドラッグ(Move Method)で十分に「統合した後、望むクラスへ動かす」が表現できるため、`mergeMethods`は**統合先クラスを選ばせず、常にメソッドAの所属クラスへ統合結果を置く**(メソッドAの位置に置き換わる)。統合後に別クラスへ動かしたければ、既存のMove Methodドラッグをそのまま使う。これはExtract Method(常に同じクラスのprivateメソッドとして切り出し、動かすのは別操作)と全く同じ考え方。

統合のトリガーは、既存の「メソッドエディタ」(`MethodEditor.tsx`、選択中メソッドの操作パネル)に「似た処理を持つメソッド」セクションを足すボタン操作にする。dnd-kitの新しいドロップターゲット(メソッド同士の重ね合わせ判定)は作らない(D&Dの複雑化・当たり判定の重なりで壊れやすくなるのを避ける。ponytail: 頼まれていない当たり判定の追加はしない)。

## ponytailチェック

1. YAGNI: 「抽象メソッドの宣言」は新規操作を作らない(既存の`fragments: []`を再利用)。統合の受け皿クラスを選ぶUIも作らない(Move Methodを再利用)。
2. 既存の再利用: `mapClasses`・`Result`型・`callFragmentId`のようなID命名パターン・`suggestMethodName`(統合後の名前のデフォルト候補に流用)・`findClassOfMethod`/`findClass`をそのまま使う。
3. 標準機能: `Set`での重複排除・配列操作のみ。新しい依存(npmパッケージ)は不要。

## 変更対象ファイル一覧

### 新規

| パス | 層 | 役割 |
| --- | --- | --- |
| `src/domain/codebase/mergeMethods.ts` | domain | `mergeMethods`(統合の実行)・`findMergeCandidates`(統合できる相手を探す)・関連する型 |
| `src/domain/codebase/mergeMethods.test.ts` | domain(test) | 上記のAAAユニットテスト |

### 変更

| パス | 層 | 変更内容 |
| --- | --- | --- |
| `src/domain/codebase/Codebase.ts` | domain | `Fragment`に`duplicateGroup?: string`を追加(コメントで隠しタグである旨を明記) |
| `src/infrastructure/stages/advancedStages.ts` | infrastructure | `frag-log-email`・`frag-log-sms`に`duplicateGroup: 'notification-log'`を追加。`description`/`goal`の文言を、ログ記録は重複コード・通知文の組み立てはチャネルごとの違いである、という区別が伝わるように更新する(文言は後述の案を参考に実装者の裁量で調整してよい) |
| `src/domain/stage/sampleAnswer.ts` | domain | `SolutionStep`に`merge`のバリアントを追加。`applyStep`に対応を追加。`sampleAnswerSteps['advanced-notifier-hierarchy']`を後述の新しい手順に置き換える |
| `src/application/RefactorUseCases.ts` | application | `mergeMethodsUseCase`・`MergeMethodsInput`・`describeMergeError`・エラーメッセージの`Record`を追加 |
| `src/application/RefactorUseCases.test.ts` | application(test) | `mergeMethodsUseCase`のテストを追加(既存テストは変更不要) |
| `src/presentation/store/useGameStore.ts` | presentation | `mergeMethods: (methodAId, methodBId, newMethodName) => boolean`アクションを追加 |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 選択中メソッドに統合候補があるときだけ「似た処理を持つメソッド」セクションを表示し、統合を実行するボタンを足す |
| `e2e/refactor.spec.ts` | presentation(e2e) | 統合の一連の操作(抽出→統合→メソッドが1つになる)を確認するE2Eテストを追加。既存の上級1のE2Eテスト(継承の矢印を確認するテスト)は変更不要(統合を経由しない手順のままでも成立する) |

`stageCatalog.test.ts`は変更しない(ステージ横断の共通テストであり、`sampleAnswerSteps`の中身が変わるだけで、テストコード自体は触らずに通る設計にしている)。

## データ/型の変更

```ts
// src/domain/codebase/Codebase.ts
export type Fragment = {
  readonly id: string;
  readonly label: string;
  readonly lines: number;
  readonly responsibility: string;
  readonly uses?: readonly string[];
  readonly suggestedName?: string;
  /**
   * この処理が、別クラスの処理と文字通り同じ実装(コピペによる重複)であることを示す隠しタグ。
   * 同じ値を持つ処理同士だけが Merge Methods で統合できる。responsibility と同じくプレイヤーには表示しない。
   * 省略時はどの処理とも統合できない(既存ステージはこのタグを使わないため影響しない)。
   */
  readonly duplicateGroup?: string;
};
```

```ts
// src/domain/codebase/mergeMethods.ts
export type MergeMethodsRequest = {
  readonly methodAId: string;
  readonly methodBId: string;
  readonly newMethodId: string;
  readonly newMethodName: string;
};

export type MergeMethodsError =
  | 'method-not-found'
  | 'same-method'
  | 'same-class'
  | 'not-private'
  | 'shape-mismatch'
  | 'empty-method-name'
  | 'duplicate-method-name';

export function mergeMethods(codebase: Codebase, request: MergeMethodsRequest): Result<Codebase, MergeMethodsError>;

export type MergeCandidate = {
  readonly method: Method;
  readonly ownerClassId: string;
};

/** 選んだメソッドと処理の形(duplicateGroupの並び)が一致する、別クラスのprivateメソッドを列挙する。 */
export function findMergeCandidates(codebase: Codebase, methodId: string): MergeCandidate[];
```

```ts
// src/application/RefactorUseCases.ts
export type MergeMethodsInput = {
  readonly methodAId: string;
  readonly methodBId: string;
  readonly newMethodName: string;
};

export function mergeMethodsUseCase(
  codebase: Codebase,
  input: MergeMethodsInput,
  generateId: IdGenerator,
): Result<Codebase, MergeMethodsError>;

export function describeMergeError(error: MergeMethodsError): string;
```

```ts
// src/domain/stage/sampleAnswer.ts(SolutionStepに追加するバリアント)
| {
    readonly merge: {
      readonly methodA: string;
      readonly methodAClass?: string;
      readonly methodB: string;
      readonly methodBClass?: string;
      readonly name: string;
    };
  }
```

## `mergeMethods`の仕様

1. `methodAId`・`methodBId`のメソッドと所属クラス(`ownerA`/`ownerB`)を探す。どちらか見つからなければ`method-not-found`。
2. `methodAId === methodBId`なら`same-method`。
3. `ownerA.id === ownerB.id`なら`same-class`(同じクラス内の統合はExtract Methodの範囲であり不要)。
4. どちらかの`visibility`が`'private'`でなければ`not-private`(公開APIやインターフェース実装メソッド(`charge`・`calculate`など)を誤って統合できないようにする安全策。`duplicateGroup`のopt-in制と合わせた二重の安全策)。
5. 「形が同じ」かどうかを見る: `methodA.fragments`と`methodB.fragments`の**個数が同じ**、かつ**同じ位置の`duplicateGroup`が両方定義されていて同じ値**であること。1つでも満たさなければ`shape-mismatch`。
6. `newMethodName.trim()`が空なら`empty-method-name`。
7. `ownerA`の中に(`methodA`自身を除いて)同名メソッドがあれば`duplicate-method-name`。
8. 成立したら、統合後のメソッドを組み立てて`ownerA`の`methodA`があった位置に置き換え、`ownerB`から`methodB`を取り除く。統合後のFragmentは、位置ごとに:
   - `id`: `${newMethodId}:merge${index}`(`extractMethod`の`callFragmentId`と同じ考え方の決め打ちID)
   - `label`・`responsibility`・`suggestedName`: A側の値をそのまま使う
   - `lines`: `Math.max(fragmentA.lines, fragmentB.lines)`(重複コードの中でも大きいほうに合わせる、という簡易な見積もり)
   - `uses`: AとBの`uses`の和集合(重複排除)。空になるなら`undefined`
   - `duplicateGroup`: 引き継がない(`undefined`)。統合済みで重複が解消されたことを表す
9. コードベース全体を走査し、`methodAId`または`methodBId`を`uses`に含む処理があれば、その値を`newMethodId`に書き換える(同じ`uses`配列内に両方が含まれていた場合は重複排除する)。これにより、AやBを呼んでいた元の呼び出し元は自動的に統合後のメソッドを指すようになる(Move Methodがクラス間の依存を生むのと同じ仕組み)。
10. 元のCodebaseは変更しない(他の操作と同じ)。

## `findMergeCandidates`の仕様

- 指定したメソッドと**別クラス**にあり、`visibility === 'private'`で、上記5.の「形が同じ」条件を満たすメソッドを、見つかった順にすべて返す。
- 同じクラス内のメソッド、`duplicateGroup`が設定されていない(または一部だけ設定されている)メソッドは候補にしない。

## TDD対象の純粋関数

### `mergeMethods`(`src/domain/codebase/mergeMethods.ts`)

1. 正常系: 別クラスにある形の一致した2つのprivateメソッドを統合すると、Aのクラスでは元のAの位置に新メソッドが入り、Bのクラスからは元のメソッドが消える。
2. 正常系: 統合後のFragmentの`lines`はA/Bの大きいほうになり、`label`/`responsibility`はA側を引き継ぐ。
3. 正常系: 統合前にAを呼んでいた呼び出し元(`uses: [methodAId]`を持つ別の処理)が、統合後は`uses: [newMethodId]`になる。Bを呼んでいた呼び出し元も同様に書き換わる。
4. 異常系: 存在しない`methodAId`/`methodBId` → `method-not-found`。
5. 異常系: `methodAId === methodBId` → `same-method`。
6. 異常系: 同じクラスの中の2メソッド → `same-class`。
7. 異常系: どちらかが`public`(または`protected`) → `not-private`。
8. 異常系: `duplicateGroup`が一方にしか設定されていない、または値が違う → `shape-mismatch`。
9. 異常系: **`responsibility`と`label`が完全に一致していても`duplicateGroup`が無ければ`shape-mismatch`になる**(誤爆防止の設計意図そのものを確認する回帰テスト。`advanced-notifier-hierarchy`の`buildEmailBody`/`buildSmsBody`相当の状況を再現する)。
10. 異常系: Fragmentの個数が違う → `shape-mismatch`。
11. 異常系: 新しい名前が空白だけ → `empty-method-name`。
12. 異常系: 統合先(Aの所属クラス)に同名メソッドがすでにある(A自身は除く) → `duplicate-method-name`。
13. 元のCodebaseは変更しない。

### `findMergeCandidates`(`src/domain/codebase/mergeMethods.ts`)

1. 正常系: `duplicateGroup`が一致する別クラスのprivateメソッドが1件返る。
2. 除外: 同じクラス内のメソッドは候補にしない。
3. 除外: `public`メソッドは候補にしない。
4. 除外: `duplicateGroup`が設定されていないメソッドは候補にしない(responsibilityが同じでも)。
5. 複数: 一致する候補が複数クラスにあれば見つかった順に全部返る。

### `mergeMethodsUseCase`(`src/application/RefactorUseCases.ts`)

- 注入したIDジェネレーターで新しいメソッドIDを採番して`mergeMethods`を呼ぶだけであることを確認する薄いテスト(既存の`extractMethodUseCase`のテストと同じ形)。

## 既存ステージへの影響(重要)

- `Fragment.duplicateGroup`はoptionalで、既存6ステージ+中級3のどのFragmentにも設定しない。`findMergeCandidates`は常に空配列を返すため、MethodEditorに新セクションは出ない。既存の模範解答・採点(`stageCatalog.test.ts`)への影響はない。
- `advanced-notifier-hierarchy`だけ、`frag-log-email`/`frag-log-sms`に`duplicateGroup: 'notification-log'`を追加する(初期コードベースの構造・行数・responsibility・limitsは変更しない)。

### `advanced-notifier-hierarchy`の新しい模範解答

```ts
'advanced-notifier-hierarchy': [
  { extract: { from: 'notifyByEmail', fragmentIds: ['frag-build-body-email'], name: 'buildEmailBody' } },
  { extract: { from: 'notifyByEmail', fragmentIds: ['frag-log-email'], name: 'logEmailNotification' } },
  { extract: { from: 'notifyBySms', fragmentIds: ['frag-build-body-sms'], name: 'buildSmsBody' } },
  { extract: { from: 'notifyBySms', fragmentIds: ['frag-log-sms'], name: 'logSmsNotification' } },
  { merge: { methodA: 'logEmailNotification', methodB: 'logSmsNotification', name: 'logNotification' } },
  { move: { method: 'logNotification', toClass: 'NotifierBase' } },
  { setSuperclass: { class: 'EmailNotifier', superclass: 'NotifierBase' } },
  { setSuperclass: { class: 'SmsNotifier', superclass: 'NotifierBase' } },
],
```

`buildEmailBody`・`buildSmsBody`はどちらのクラスにも残したまま(統合も移動もしない)にする点が、これまでの模範解答との違い。`NotifierBase`には統合済みの`logNotification`だけが残り、1行も無駄なく共有される実装になる。

このコードベース・limits(`method: 60, class: 220, file: 350`、`dependencyLimit: 2`、`responsibilityLimit: 2`)は変更しなくても、新しい手順で100点になることを仕様設計段階で試算済み(下記の内訳)。実装時に`stageCatalog.test.ts`で必ず確認し、ズレていたらFragmentの行数ではなくlimits側を調整する(既存の他ステージと同じ方針)。

- `EmailNotifier`: `notifyByEmail`(呼び出し2行+送信34行=36行)・`buildEmailBody`(32行)。責務は`formatting`・`email-delivery`の2種(上限ちょうど)。依存先は`NotifierBase`1つ。
- `SmsNotifier`: 同様に34行・30行、責務2種、依存先1つ。
- `NotifierBase`: `logNotification`(24行、`max(24, 22)`)。責務1種、依存先0。
- 循環依存なし、行数上限違反なし → `line-limit` / `coupling` / `cycle` / `responsibility` いずれも0件で100点。

変更依頼(`req-notification-format`・`req-notification-log`)の変更容易性も、初期状態(平均50点)より模範解答後(平均90点、特に`req-notification-log`は`classesTouched`が2→1に改善しripple 2件は残るが`entangled`/`limit-break`が消える)のほうが上がることを試算済み。責務の内訳(`formatting`は`buildEmailBody`/`buildSmsBody`にそのまま残る)は変えていないため、`allRequestsHaveSites`も引き続き満たす。

### `description`/`goal`の文言案(実装者の裁量で調整可)

- `description`案: 「会員登録時にメールで知らせる EmailNotifier と、SMSで知らせる SmsNotifier。どちらも「送信ログを記録する」処理はコピペしたように全く同じ内容で、「通知文を組み立てる」処理はチャネルごとに内容そのものが違う。空の基底クラス NotifierBase は用意されているが、まだどちらのクラスとも継承関係で結ばれていない。」
- `goal`案: 「重複した「送信ログを記録する」処理をExtract Methodで取り出し、メソッドエディタの「似た処理を持つメソッド」から統合してNotifierBaseへ移そう。「通知文を組み立てる」処理はチャネルごとに違う本物の実装なので、それぞれのクラスに残したままでよい。最後にEmailNotifier・SmsNotifierの継承元をNotifierBaseに設定しよう。メソッドは60行以内、1クラスの責務は2種類まで」

## 画面(presentation)

- `MethodEditor.tsx`の`MethodEditorBody`に、`findMergeCandidates(codebase, method.id)`が1件以上あるときだけ表示するセクションを追加する。
  - 各候補は「所属クラス名.メソッド名()」を表示するボタン(`data-testid="merge-candidate-<候補のメソッド名>"`)。
  - 統合後の名前は、Extract Methodの名前欄と同じ考え方でテキスト入力(`aria-label="統合後のメソッド名"`)にし、デフォルトはメソッドA(選択中のメソッド)の名前にする。プレイヤーが編集したらその名前を優先する。
  - ボタンを押すと`useGameStore`の`mergeMethods(selectedMethodId, candidate.method.id, name)`を呼ぶ。成功したら選択状態を維持する(統合後もメソッドAの位置に新メソッドがいるため、`selectedMethodId`を更新する必要があれば`extractMethod`と同様に呼び出し元で対応する)。
- 新しいCSSクラス名・具体的なレイアウトは実装者の裁量。既存の`method-editor__extract`と同じ並び(見出し・入力・ボタン)を踏襲する。

## 受け入れ基準

1. `mergeMethods`・`findMergeCandidates`について、上記ケースを含むAAAパターンのユニットテストがある(特に「responsibility/labelが同じでもduplicateGroupが無ければ統合できない」ケースを含む)。
2. `mergeMethodsUseCase`のユニットテストがある。
3. `stageCatalog.test.ts`(無変更のテストコード)が、新しい`sampleAnswerSteps['advanced-notifier-hierarchy']`で引き続き全ケース通る(模範解答で100点、変更容易性が上がる、クラス数が悪化しない、他)。既存の他6ステージの結果に変化がないことも確認する。
4. E2E: 上級1ステージで、`notifyByEmail`/`notifyBySms`から「送信ログを記録する」処理をそれぞれExtract Methodで取り出したあと、片方のメソッドを選択すると`merge-candidate-<もう片方のメソッド名>`ボタンが表示され、押すと片方のメソッドが消えて統合後のメソッドが1つだけ残る。
5. E2E: 既存の上級1のテスト(継承の矢印確認)が無変更のまま通る。
6. `npm run check`と`npm run test:e2e`が通る。

## スコープ外

- 「抽象メソッドの宣言」をプレイヤーが行える新しい操作(現状は`fragments: []`をステージ作者が用意するだけで十分。本当に必要になったときに改めて検討する)。
- メソッド同士をドラッグ&ドロップで重ねて統合するUI(当たり判定が複雑になり壊れやすいため、既存のMove Methodドラッグ + メソッドエディタのボタンで代替する)。
- 統合先クラスを選べるUI(常にメソッドAの所属クラスに統合し、動かしたければ既存のMove Methodを使う)。
- 3つ以上のメソッドを一度に統合するUI・ドメイン関数(今回は2つずつ)。
- 「重複コードが残っている」ことを検出して減点する新しい採点ルール(`duplicateGroup`は統合できるかどうかのタグであり、採点には使わない)。
- `duplicateGroup`が一部のFragmentにしか付いていない部分一致(例: 3つのFragmentのうち1つだけ重複)の統合(全Fragmentの形が完全一致するときだけ統合できる)。

## 未決事項

- `description`/`goal`の文言は仮案。実装・評価の過程で違和感があれば変えてよい(振る舞いに影響しないため仕様変更は不要)。
- 統合ボタンを押した直後に`selectedMethodId`をどう扱うか(統合後のメソッドを選択し続けるか、選択を外すか)は実装者の裁量とする。既存の`extractMethod`ストアアクションが選択状態を変えていないのと同じ扱いでよい。
