# 仕様草案: データの持ち主を extends するだけで Feature Envy・カプセル化の破れが消える抜け道を塞ぐ

- slug: `extends-field-access-loophole`
- 入力: `docs/pipeline/extends-field-access-loophole/01-discovered.md`

## 1. 背景・目的

`src/domain/scoring/fieldAccess.ts` は「自分側」を `extendsChainIds`(自クラス + **extends の先祖すべて**)で決めている
(`findEnviedClass` 41行目、`collectClassViolations` 89行目)。先祖が宣言したフィールドは**可視性を問わず**自分のデータとして扱う。
`setSuperclass`(`setSuperclass.ts` 49〜68行目)は、フィールドしか持たないデータクラスを継承元に選ぶことを拒まない。

そのため、**データを触っているクラスにデータの持ち主を extends させるだけで、Feature Envy とカプセル化の破れがすべて消える**。
ステージが教えたい Tell, Don't Ask(処理をデータの持ち主へ移す)を一切しなくても点が上がり、中級6・中級8では100点まで届く。
「コードを共有したいから継承する」は対象プレイヤー(新卒〜4年目)がちょうど陥りやすい誤りで、それを満点で後押ししてしまうので塞ぐ。

**直し方は「採点で直す」。「自分側 = 自クラスのフィールド + extends の先祖が protected で宣言したフィールド」に変える(2章)。**
操作(`setSuperclass`)は変えない。`extends-interface-loophole` の確定(03)と同じ方針。最終確認は未決事項1。

### 1.1 調査で分かったこと(抜け道の点数)

**実測できていない。** このセッション(仕様設計者)にはシェルを実行する手段が無く、`npm test` での実測はできなかった。
以下はすべて採点ルール13種(`score.ts` 58〜72行目)を1つずつ追った手計算。実装者は 5.2 の回帰テストを**先に今の実装で**書いて走らせ、
「今の点数」列の値が出ること(=抜け道が実在すること)を確かめてから期待値を「直した後」に書き換える(5.2 の手順)。実測値はPRの説明に書く。

継承は依存に数えない(`dependencies.ts` 25〜37行目。フィールドを触れば依存になる)。`lone-superclass` は子がちょうど1つの親だけ数える(`loneSuperclass.ts`)。

| # | ステージ・手順 | 初期点 | 今の点数 | 直した後(推奨案) |
|---|---|---|---|---|
| S6-1 | 中級6: BillingService extends Subscription の1手 | 40 | **70**(行数1・責務1・子が1つの継承1) | **30**(+ Feature Envy 2・カプセル化2) |
| S6-9 | 中級6: 下の9手(処理を Subscription へ「頼む」形にしない) | 40 | **100** | **50**(Feature Envy 2・カプセル化3) |
| S7-1 | 中級7: AccountService extends Account の1手 | 40 | **70**(行数1・凝集度1・子が1つの継承1) | **30**(+ Feature Envy 2・カプセル化2) |
| S8-11 | 中級8: 下の11手(住所をデータだけの Address と、それを extends する振る舞いのクラスに分ける) | 70 | **100** | **50**(Feature Envy 2・カプセル化3) |
| U7-3 | 上級7: 3サービスとも extends Expense(01では未検討。本調査で追加) | 40 | **70**(Feature Envy 3 → 0。子が3つなので子が1つの継承の減点も付かない) | **40**(Feature Envy 3 のまま) |

**S6-9 の手順**(`SolutionStep` で書ける。01 の7手の `moveMethodToNewClass` を `addFile`・`addClass`・`move` に分けたもの):

1. `{ setSuperclass: { class: 'BillingService', superclass: 'Subscription' } }`
2. `{ addFile: 'src/billing/CancellationService.ts' }`
3. `{ addClass: { name: 'CancellationService', file: 'src/billing/CancellationService.ts' } }`
4. `{ move: { method: 'cancelSubscription', toClass: 'CancellationService' } }`
5. `{ setSuperclass: { class: 'CancellationService', superclass: 'Subscription' } }`
6. `{ moveField: { field: 'mailer', fromClass: 'BillingService', toClass: 'Subscription' } }`
7. `{ extract: { from: 'renewSubscription', fragmentIds: ['frag-charge-card'], name: 'chargeCard' } }`
8. `{ extract: { from: 'renewSubscription', fragmentIds: ['frag-send-invoice-mail'], name: 'sendInvoiceMail' } }`
9. `{ move: { method: 'sendInvoiceMail', toClass: 'Subscription' } }`

9手後(今の実装): renewSubscription 42行(12+28+呼び出し1+1)・BillingService 72行・責務 trial/pricing/payment の3種類。
CancellationService の cancelSubscription は Subscription の status・canceledAt・mailer を触るが、Subscription が先祖なので全部「自分側」。
依存は BillingService → Subscription、CancellationService → Subscription の1本ずつ。Subscription の子は2つ。
BillingService → Subscription の private な sendInvoiceMail 呼び出しは、中級6が `visibilityEnforced` でないので数えない。→ 全ルール0件で100点。

**S8-11 の手順**:

1. `{ addFile: 'src/hr/Address.ts' }`
2. `{ addClass: { name: 'Address', file: 'src/hr/Address.ts' } }`
3. `{ addClass: { name: 'MailingLabel', file: 'src/hr/Address.ts' } }`
4. `{ setSuperclass: { class: 'Employee', superclass: 'Address' } }`
5. `{ setSuperclass: { class: 'MailingLabel', superclass: 'Address' } }`
6〜8. `{ moveField: { field: 'postalCode' | 'prefecture' | 'addressLine', fromClass: 'Employee', toClass: 'Address' } }`(3手)
9. `{ move: { method: 'formatMailingAddress', toClass: 'MailingLabel' } }`
10. `{ move: { method: 'changeAddress', toClass: 'MailingLabel' } }`
11. `{ extract: { from: 'calculateMonthlyPay', fragmentIds: ['frag-withholding'], name: 'withholdTaxes' } }`

11手後(今の実装): Employee 83行(上限120)・calculateMonthlyPay 51行。MailingLabel は Address の private フィールド3つを触るが「自分側」。
Address はフィールドだけ(空ではない。メソッドが無いので凝集度の塊も無い)で子が2つ。→ 100点。
模範解答(Address にフィールドとメソッドを一緒に移す)を、**データだけのクラス + それを extends する振る舞いのクラス**(貧血ドメインモデル)に崩した形で、
TypeScript なら MailingLabel から Address の private を触るところでコンパイルエラーになる。
(01 に書かれた5手の形 = Address にフィールドを移して Employee extends Address だけ、は今の実装で70点 = 初期点と同じ。凝集度の減点が子が1つの継承の減点に置き換わるだけ。直した後は20点)

**U7-3 の手順**: `setSuperclass` を ExpenseApplicationService・ApprovalService・PayoutService の3つとも Expense に。
Expense のフィールドはすべて public、3つのメソッドはそれぞれ amount・currency の2つを触るだけで自クラスのフィールドが無いので、今は Feature Envy 3件がすべて消える。

### 1.2 他のステージ・既存テストへの影響(読んだ範囲)

- 全ステージの初期状態・模範解答で `superclassId` を持つのは上級5の CsvExporter → BaseExporter と上級1の模範解答の EmailNotifier・SmsNotifier → NotifierBase だけで、
  **どちらの親もフィールドを持たない**。→ 初期点・模範解答100点・`stageCatalog.test.ts` の近道(`setSuperclass` を使うのは上級5の4件だけ)は変わらない
- ステージ・テスト用データに **protected のフィールドは1つも無い**(grep で確認。フィールドの可視性を変える操作も無い)
- `cohesion.ts`・`visibility.ts`・`changeVisibility.ts`・`interfaceContracts.ts` は `fieldAccess.ts` の「自分側」を使わないので変わらない
- 白紙設計・E2E(`e2e/refactor.spec.ts` の「継承元を設定」はチュートリアルのフィールドの無いクラス)は変わらない
- 期待値が変わる既存のユニットテストは `fieldAccess.test.ts` の3件だけ(5.1)

## 2. 方針: 「自分側」の定義を変える(推奨)

### 2.1 新しい定義

クラス C から見て、フィールド F(クラス D が宣言)が**自分側**なのは次のどちらか:

- D = C(自クラスが宣言した)
- D が C の extends の先祖(`extendsChainIds(C)` に入る)で、**F が `protected`**

それ以外(先祖の **public**・**private**、無関係なクラスのフィールド)は、すべて「他クラス D のフィールド」として数える。
この1つの判定を Feature Envy とカプセル化の破れ(直接の読み書き・setter 越しの書き換え)の両方で使う。

理由(コードのコメントに1〜2行で書く):

- 継承で子が**新しく得る**アクセスは protected だけ。public は継承しなくても誰でも触れるので、継承しても持ち主は親のまま。
  private は子からは触れない(実際のコードではコンパイルエラー)。どちらも「無関係なクラスが触るのと同じ」に数えるのが TypeScript の意味どおり
- この定義なら、**extends してもフィールドの採点は1点も有利にならない**(今は protected フィールドを持つクラスが無いので)。
  中級6の public フィールド経由の1手目も塞がる

Lanza-Marinescu 流の Feature Envy(ATFD)は先祖の属性を自分側に数えるが、このゲームでは継承を「データに届くための近道」に使わせないことを優先する。
先祖の protected は「子に使わせるために公開した」ものなので自分側に残す(Template Method などで子が親の protected を使うのは正当)。

### 2.2 getter/setter 越しのアクセス(中級7の線引き)

**無関係なクラスと同じ線引きにする**(新しい規則は足さない)。今の `fieldAccess.ts` は、アクセサ越しに触ったフィールドを
「そのフィールドの持ち主」で数えている(`fieldCountsByClass` 20〜33行目、`collectClassViolations` 91・94行目)。判定を 2.1 に差し替えるだけで:

- 親の public な getter で親の **private** フィールドを読む → Feature Envy では親のフィールドとして数える。カプセル化の破れには数えない(無関係なクラスが getter を呼ぶのと同じ)
- 親の public な setter で親の **private** フィールドを書き換える → カプセル化の破れ1件(無関係なクラスが setter を呼ぶのと同じ)
- 親の **protected** フィールドをアクセサ越しに触る → 自分側なので数えない

これで S7-1 は Feature Envy 2・カプセル化2 が戻り30点になる。`findOpenSetters`(外から呼ばれない setter)は `extendsChainIds` を使っておらず、変えない。

### 2.3 `setSuperclass` の自動昇格は変えない

`promoteCalledPrivateMethods`(`setSuperclass.ts` 29〜42行目)は、子が呼んでいる親の private **メソッド**を protected に広げる。**フィールドは広げない(今のまま)**。

- 広げると、2.1 で protected は自分側なので、中級7・中級8の抜け道(親の private フィールドを子が触る)がそのまま戻る
- メソッドを広げるのは、Move Method が可視性を変えないため「先に親へ移してから継承する」と届かない呼び出しが残る、という操作の都合。
  フィールドの場合は「子が親の private を触る」こと自体を採点で知らせたいので、広げないのが目的に合う
- `setSuperclass.ts`・`RefactorUseCases.ts`(`SET_SUPERCLASS_ERROR_MESSAGES`)は変更しない。`extends-interface-loophole` と競合しない

未決事項2で確認する。

### 2.4 採らなかった案(01 の A〜D。手計算の結果)

| 案 | 中身 | S6-1 | S6-9 | S7-1 | S8-11 | U7-3 | 採らない理由 |
|---|---|---|---|---|---|---|---|
| 推奨(01 の A+B を1つの判定に) | 自分側 = 自クラス + 先祖の protected(Feature Envy・カプセル化とも) | 30 | 50 | 30 | 50 | 40 | ― |
| 自クラスだけ | 継承を完全に無視 | 30 | 50 | 30 | 50 | 40 | 今のステージでは推奨と同点。ただし子が親の protected を読むと「カプセル化の破れ」になり、TypeScript として正しいコードを減点する(未決事項1の選択肢B) |
| 01 の A(Feature Envy にも同じ判定を使う形) | 先祖の **private** だけ他クラス扱い(public・protected は自分側のまま) | **70** | 90 | 30 | 50 | **70** | Subscription・Expense のフィールドは public なので、中級6の1手目と上級7が残る。01 の A どおりカプセル化だけに入れると、さらに S7-1 は50点(初期40点より上)、S8-11 は70点 |
| 01 の B だけ | Feature Envy だけ先祖を他クラス扱い(カプセル化は今のまま) | 50 | 80 | 50 | 80 | 40 | 先祖のフィールドの書き換え・private の読み取りが違反にならず、1手で +10 点が残る。規則が2つに割れる |
| 01 の C | `setSuperclass` の前提条件で「データクラスの継承」を拒む | 塞がる | **100** | 塞がる | **100** | 塞がる | 判定は操作の時点の状態しか見ない。**先に空のクラス・メソッドのあるクラスを継承してから Move Field / Move Method すれば通る**(S8-11 は4・5手目の時点で Address が空なので、どんな「データクラス」判定も通る。S6-9 は9手目を先にしてから継承すれば Subscription にメソッドがある)。ガードを `moveField`・`moveMethod` にも散らす必要があり、`extends-interface-loophole` と同じ関数・`SET_SUPERCLASS_ERROR_MESSAGES` で競合する |
| 01 の D | 「子を2つ作る」経路だけ塞ぐ | 70 | ― | 70 | ― | 70 | 1手目は `lone-superclass` の -10 込みで既に +30。U7-3 は最初から子が3つ |

※ C の「塞がる」は「前提条件で `setSuperclass` 自体がエラーになる」の意味。点数はいずれも手計算。

## 3. 変更対象ファイル一覧

| 新規/変更 | パス | 層 | 役割 |
|---|---|---|---|
| 変更 | `src/domain/scoring/fieldAccess.ts` | domain | 「自分側」の判定を 2.1 に差し替える(3.1)。戻り値の型・export している関数のシグネチャは変えない |
| 変更 | `src/domain/scoring/fieldAccess.test.ts` | domain(test) | 既存3件の期待値の変更と新しいケース(5.1)。**実装より先に書く** |
| 変更 | `src/infrastructure/stages/featureEnvyStage.test.ts` | infrastructure(test) | S6-1・S6-9 の回帰テスト2件(5.2) |
| 変更 | `src/infrastructure/stages/anemicDomainModelStage.test.ts` | infrastructure(test) | S7-1 の回帰テスト1件(5.2) |
| 変更 | `src/infrastructure/stages/extractClassStage.test.ts` | infrastructure(test) | S8-11 の回帰テスト1件(5.2) |
| 変更 | `src/infrastructure/stages/valueObjectStage.test.ts` | infrastructure(test) | U7-3 の回帰テスト1件(5.2。未決事項4で外すこともある) |
| 変更 | `docs/specs/fields-and-feature-envy.md` | docs | 60行目・79行目・84〜85行目の「自分側 = 自クラス + extends の先祖」に、本件で「自クラス + 先祖の protected」に変えた旨を1行ずつ注記する(本文の書き換えはしない) |

**変更しないファイル**: `Codebase.ts`(`extendsChainIds` は `visibility.ts`・`changeVisibility.ts` と共有)・`setSuperclass.ts`・`RefactorUseCases.ts`・
`score.ts`・`cohesion.ts`・`loneSuperclass.ts`・ステージ定義(`intermediateStages.ts`・`advancedStages.ts`)・`sampleAnswer.ts`・`stageCatalog.test.ts`・
`describeScore.ts`・presentation 全体・E2E。

### 3.1 `fieldAccess.ts` の変更内容(目安。形は実装者に任せる)

- private の判定関数を1つ足す。例:

  ```ts
  /**
   * classId から見て自分側のフィールドか: 自クラスが宣言した、または extends の先祖が protected で宣言した。
   * 先祖の public は継承しなくても誰でも触れ、private は子から触れないので、継承しても持ち主は先祖のまま(他クラスと同じに数える)。
   * ponytail: protected フィールドを持つデータクラスを extends すれば、まだ減点を逃れられる。protected フィールドを持つ題材か、フィールドの可視性を変える操作を作るときに見直す
   */
  function isOwnSideField(codebase: Codebase, fieldId: string, classId: string, ancestorIds: ReadonlySet<string>): boolean;
  ```

  `ancestorIds` は今の `selfIds`(`extendsChainIds(codebase, classId)`)をクラスごとに1回だけ作って渡す(フィールドごとに作り直さない)
- `fieldCountsByClass`: 自分側のフィールドは自クラスIDのキーで、それ以外は宣言しているクラスIDのキーで数える
- `findEnviedClass`: 自分側の数 = 自クラスIDのキーの数。「うらやましい相手」の候補から外すのは**自クラスだけ**(先祖も候補に入る)。同数・閾値の規則は変えない
- `isWriteViolation`・`isReadViolation`・`collectClassViolations`: `selfIds.has(ownerClass.id)` を `isOwnSideField` に置き換える。
  読み取りは今までどおり「自分側でなく、かつ public でない」、書き換えは「自分側でない」(可視性を問わない)
- コメントの更新: 56行目 `findFeatureEnvy` の「自分側(自クラス + extends の先祖)」、68・74行目の「他クラス(自分側でない)」を新しい定義に合わせる
- lint(循環的複雑度12・引数4つまで・`as`/`!` 禁止・`no-unnecessary-condition`)に収める

## 4. データ/型の変更

なし。`Field.visibility` は既にある。`FeatureEnvy`・`EncapsulationViolation` の形も変えない(`score-deduction-locations`・`critiqueRequest.ts`・`fileScores.ts` はそのまま動く)。

## 5. TDD 対象の純粋関数とテストケース

### 5.1 `fieldAccess.test.ts`(先に書いて Red を確かめる)

**期待値を変える既存テスト(3件)**:

| 行 | 今のテスト名 | 変更後 |
|---|---|---|
| 115 | 親クラス(extends)のフィールドを2つ触る子クラスのメソッド → 空(自分側) | 親のフィールドを **protected** にして「→ 空(先祖の protected は自分側)」に直す。public のケースは下の新規ケースへ |
| 275 | 自クラスのprivateフィールドの読み書き → 空 / 親クラス(extends)のフィールドの書き換え → 空 | 2件に分ける:「自クラスの private の読み書き → 空」と「親の **private** の書き換え → `[{ fieldId: 'f-p1', accessorClassId: 'class-Child' }]`」 |
| 489 | Bの子クラスがBのsetterを呼ぶ → 空(自分側) | 「子が親の setter(**private** フィールド)を呼ぶ → 1件(`accessorClassId: 'class-Child'`)」に直す。protected のケースは下の新規ケースへ |

**新しいケース(`findFeatureEnvy`)**:

1. 親の **public** フィールドを2つ触る子のメソッド(自クラス0)→ `[{ methodId: 'method-class-Child', enviedClassId: 'class-Parent' }]`
2. 親の **private** フィールドを2つ触る子のメソッド → Feature Envy(相手は Parent)
3. 祖父母の **protected** フィールドを2つ触る孫のメソッド(`Child extends Parent extends Grand`)→ 空(先祖を2段たどる)
4. 自クラス1つ + 親の protected 1つ + 無関係なクラス B 2つ → 空(自分側2 と B 2 が同数)。先祖の protected が自分側の数に入ることの確認
5. 親の public な getter を2つ呼び、それぞれ親の private フィールドを読む → Feature Envy(相手は Parent。2.2)

**新しいケース(`findEncapsulationViolations`)**:

6. 親の **public** フィールドを書き換える → 1件 / 読むだけ → 空(無関係なクラスと同じ)
7. 親の **protected** フィールドを読む・書き換える → 空
8. 親の **private** フィールドを読む → 1件
9. 子が親の setter(**protected** フィールド)を呼ぶ → 空
10. 子が親の getter(**private** フィールド)を呼ぶ → 空(getter 越しの読み取りは、無関係なクラスと同じく数えない)

`findOpenSetters` のテストは変えない。すべて `// Arrange` `// Act` `// Assert` の AAA で書き、既存の `classOf`・`classWithMethods`・`accessorMethod`・`field` を使う。

### 5.2 ステージの回帰テスト(`infrastructure` 層。抜け道の点数を固定する)

各ファイルの `describe` の末尾に1件ずつ足す(`extractClassStage.test.ts` 66〜84行目の「近道」と同じ形。`SolutionStep` の配列を `applySolutionSteps` で適用して `scoreCodebase`)。

| ファイル | テスト名(例) | 期待値(直した後) |
|---|---|---|
| `featureEnvyStage.test.ts` | 近道: BillingService extends Subscription の1手では、Feature Envy・カプセル化の破れが消えない(30点) | `total` 30、`feature-envy` 2・`encapsulation` 2・`lone-superclass` 1 |
| `featureEnvyStage.test.ts` | 近道: Subscription を2クラスで extends し、処理を頼まずに分けても100点にならない(50点) | 1.1 の S6-9 の9手。`total` 50、`feature-envy` 2・`encapsulation` 3、それ以外0件 |
| `anemicDomainModelStage.test.ts` | 近道: AccountService extends Account の1手では、getter/setter 越しのアクセスが消えない(30点) | `total` 30、`feature-envy` 2・`encapsulation` 2・`lone-superclass` 1 |
| `extractClassStage.test.ts` | 近道: 住所をデータだけの Address と、それを extends する MailingLabel に分けても100点にならない(50点) | 1.1 の S8-11 の11手。`total` 50、`feature-envy` 2・`encapsulation` 3、それ以外0件 |
| `valueObjectStage.test.ts` | 近道: 3サービスとも Expense を extends しても Feature Envy は消えない | **合計点は書かない**(`duplicate-code-scoring` が同ファイルの初期点を変えるため)。`feature-envy` 3・`lone-superclass` 0 |

**手順(実測を兼ねる)**:

1. 上の5件を、まず**今の実装の見込み値**(1.1 の「今の点数」列: 70 / 100 / 70 / 100 / `feature-envy` 0)で書いて `npm test` を走らせ、通ることを確かめる(= 抜け道の実測)。
   手計算と違った場合は、違ったルールと件数をPRの説明に書き、原因(手計算の誤り・別のルール)を確かめてから進める
2. 期待値を「直した後」に書き換え、5.1 と合わせて Red を確かめる
3. `fieldAccess.ts` を直して Green。直した後の値が表と違った場合も、違ったルールと件数をPRの説明に書く(推奨案の結論が変わるほどなら実装を止めて報告)

## 6. 受け入れ基準

1. 5.1 の `fieldAccess.test.ts`(既存3件の変更 + 新規10件)と 5.2 の回帰テスト5件が通る
2. 1.1 の「今の点数」を 5.2 手順1で実測し、PRの説明に書いてある
3. 既存のステージテスト(`featureEnvyStage`・`anemicDomainModelStage`・`extractClassStage`・`valueObjectStage`・`advancedStages`・`volatilityStages`・`stageCatalog`)が**期待値を変えずに**通る
   (初期点・模範解答100点・既存の近道・変更依頼の点数は変わらない)
4. `score.test.ts`・`fileScores.test.ts`・`cohesion.test.ts`・`visibility.test.ts`・`critiqueRequest.test.ts`・`setSuperclass.test.ts` が変更なしで通る
5. `fieldAccess.ts` に 3.1 の `// ponytail:` コメントが1つある(`/ponytail-review debt` に出る)
6. `npm run check`(lint + typecheck + test)が通り、`domain` 層のカバレッジ閾値(`vite.config.ts`)を割らない
7. `setSuperclass.ts`・`RefactorUseCases.ts`・`Codebase.ts`・ステージ定義・presentation・E2E に差分が無い

## 7. スコープ外

- **`setSuperclass` の前提条件・右クリックメニューの候補からデータクラスを外す**: 2.4 のとおり操作では塞ぎきれない。採点で塞げば不要(YAGNI)
- **フィールドの可視性を変える操作・`setSuperclass` でのフィールドの自動昇格**: 2.3。今は protected フィールドを作る手段が無く、要らない
- **protected フィールドを持つデータクラスを extends する抜け道**: そういうクラスがどのステージにも無い。3.1 の `// ponytail:` に残す
- **凝集度(`cohesion.ts`)で継承元のフィールドを数える**: 既存の ponytail のまま。本件の点数には関係しない(S8-11 は Feature Envy・カプセル化で捕まる)
- **「具象クラスを extends して実装を借りる」抜け道**(`extends-interface-loophole` の未決事項2で別件にしたもの): 主題が違う
- **`Codebase.ts` の `extendsChainIds` の変更**: `visibility.ts`・`changeVisibility.ts` と共有しているので触らない
- **E2E の追加**: 操作・画面は変わらない(採点だけ)。CLAUDE.md の「プレイヤーの操作に関わる変更」に当たらない
- **`stageCatalog.test.ts` の `shortcuts` への追加**: 未決事項3。推奨はステージ固有のテスト

## 8. 既存パイプラインとの衝突

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 見立て |
|---|---|---|---|
| `fieldAccess.ts`・`.test.ts` | 判定の差し替え・テスト | なし(`score-deduction-locations` は戻り値を読むだけ。形は変えない) | なし |
| `featureEnvyStage.test.ts`・`anemicDomainModelStage.test.ts`・`extractClassStage.test.ts` | 末尾に1〜2件 | なし(`data-placement-quizzes` は固定済みの点数を読むだけ) | なし |
| `valueObjectStage.test.ts` | 末尾に1件(合計点なし) | `duplicate-code-scoring`(初期状態のテストの期待値を 40 → 10 点に変える) | 小。別の `it` への追記で、合計点を書かないので中身は干渉しない |
| `docs/specs/fields-and-feature-envy.md` | 3か所に1行ずつ注記 | 未確認(注記のみ) | 小 |

意味上の依存:

- `score-deduction-locations`: 本件で増える Feature Envy・カプセル化の破れも同じ形なので、そのまま内訳に出る
- `codebase-code-view`: 子が親の private フィールドを触るコード(コンパイルが通らない形)が、表示と採点でそろう
- `extends-interface-loophole`: 採点関数が別(`interfaceContracts.ts`)。本件は `setSuperclass.ts` を触らないので、どちらが先でも動く

## 9. 未決事項

### 未決事項1: 抜け道をどう塞ぐか(「自分側」の定義)

- 選択肢A(推奨): 採点で塞ぐ。自分側 = 自クラス + **先祖の protected フィールド**。先祖の public・private は無関係なクラスと同じに数える(2.1)。表の5つの経路をすべて初期点以下に戻せ、子が親の protected を使う正当な継承は減点しない
- 選択肢B: 採点で塞ぐ。自分側 = **自クラスだけ**(継承をまったく考えない)。判定が一番短く、今のステージの点数は A と同じ。ただし将来 protected フィールドの題材を作ると、子が親の protected を読むだけでカプセル化の破れになる
- 選択肢C: 採点で塞ぐ。先祖の **private** だけ他クラス扱い(01 の A)。中級7・中級8は下がるが、中級6の1手目(40 → 70)と上級7(40 → 70)は public フィールドなので残る
- 選択肢D: 操作で塞ぐ(`setSuperclass` の前提条件)。継承してから Move Field / Move Method すれば通るので塞ぎきれず、E2E・エラー文言が要り、`extends-interface-loophole` と同じ関数で競合する

### 未決事項2: `setSuperclass` で、子が触っている親の private フィールドを protected に自動で広げるか

- 選択肢A(推奨): 広げない(`setSuperclass.ts` は変更しない)。子が親の private を触るのを採点で知らせる。広げると中級7・中級8の抜け道が戻る
- 選択肢B: メソッドと同じく protected に広げる。操作の一貫性は上がるが、未決事項1でAを選ぶ場合は抜け道が戻る

### 未決事項3: 中級6〜8の回帰テストをどこに置くか

- 選択肢A(推奨): 各ステージのテスト(`featureEnvyStage.test.ts`・`anemicDomainModelStage.test.ts`・`extractClassStage.test.ts`)の末尾。点数とルールごとの件数まで確かめられ、進行中の件と衝突しない(`extractClassStage.test.ts` に前例あり)
- 選択肢B: `stageCatalog.test.ts` の `shortcuts` に足す。「100点にならない」だけを確かめる形で、`inline-method-stage` など5件が同じ配列に追記するので隣接して衝突しやすい

### 未決事項4: 上級7(3サービスとも Expense を extends すると Feature Envy 3件が消え、子が3つなので減点も付かず 40 → 70点)も今回の回帰テストに含めるか

- 選択肢A(推奨): 含める。`valueObjectStage.test.ts` に1件、合計点ではなくルールの件数(`feature-envy` 3・`lone-superclass` 0)で書く。直し方は同じなので実装は増えない
- 選択肢B: 含めない。01 の範囲(中級6〜8)だけにし、`duplicate-code-scoring` が触るファイルに手を入れない
