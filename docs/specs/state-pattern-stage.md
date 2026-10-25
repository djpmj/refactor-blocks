# state-pattern-stage: 上級9「注文の状態ごとの分岐を State パターンへ組み替える」を足す

## 背景・目的

学習者としてステージ一覧の上級を通しで遊ぶと、Strategy(上級3)・Factory(上級4)・ISP(上級6)・Value Object(上級7)・
Template Method(上級8)は練習できる。けれど「状態(未払い・支払済み・発送済み)ごとの if 分岐が、支払い・発送・取り消しの
**各メソッドに散らばっている**クラスを、**状態ごとのクラス**へ分ける」State パターンのステージが無い。

- 上級3(Strategy)は「1つの計算方式を外から差し替える」形で、1クラスが持つ処理は1つ。状態クラスが**複数の操作をまとめて持ち**、
  **次の状態へ移る判断も自分で持つ**、という State の特徴と比べられない。
- 中級10(`intermediate-member-rank-branching`)は「種類ごとの分岐を種類ごとのクラスへ」だが、種類は変わらない(会員ランクは
  注文の途中で変わらない)。注文のように**操作のたびに状態が移り変わる**処理の整理は、どのステージでも練習できない。
- `docs/feature-ideas/IDEAS.md` 2026-10-10 の「2. Stateパターンのステージ」が未仕様化のまま残っている。

上級の末尾に State パターンのステージを1つ足し、Strategy・中級10との違い(1クラスが複数の操作を持つ/次の状態をクラス自身が決める/
状態を足すと遷移元の状態クラスは直す)を、変更依頼と理解度チェックで実感させる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 新ステージ `orderStateStage`(id `advanced-order-state`)を定義し、`advancedStages` 配列の**末尾**(`templateMethodStage` の次)に足す |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-order-state']`(27手)を足す |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表 `'advanced-order-state'` を足す |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新ステージの章を末尾に足し、上級8の章から「最後の章」の文言を外す(「全ステージに章がある」「並びが stages と同じ」テストのため) |
| 新規 | `src/infrastructure/stages/orderStateStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`memberRankBranchingStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 初期違反の種類の表に1行、近道(`shortcuts`)に2件を足す |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のスナップショット) |

- domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。既存の操作
  (Add File・Add Class・Extract Method・Move Method・実装するインターフェースの設定)だけで100点になる。
- 新しい依存は足さない。

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-order-state` |
| level | `'advanced'` |
| title | `上級9: 注文の状態ごとの分岐を State パターンへ組み替える` |
| problem | `注文の状態ごとの分岐が、支払い・発送・取り消しの各メソッドに散らばっている` |
| learns | `['State', '状態遷移']` |
| limits | `{ method: 13, class: 42, file: 44 }` |
| dependencyLimit | `3`(コメントで理由を書く。下の「結合度」参照) |
| responsibilityLimit | `2` |
| conditionNotes | `{ coupling: 'このゲームでは呼び出し先を書き換えられないため、Order が3つの状態クラスを呼ぶ形を答えとして認めるため' }` |
| visibilityEnforced | 省略(移動したメソッドは自動で public になる) |

- description: `ネットショップの注文。Order の pay(支払い)・ship(発送)・cancel(取り消し)が、それぞれの中で注文の状態(未払い・支払済み・発送済み)ごとの if 分岐を重ねている。状態ごとの振る舞いと「次はどの状態へ移るか」が3つのメソッドに散らばっていて、ある状態で何ができるかを確かめるには3つとも読むことになる。注文画面の OrderController は、前任者が OrderState(インターフェース)経由で今の状態に任せる形に先に書き換えたが、状態ごとのクラスはまだ無い。取り消した注文は取り消し履歴へ移るので、取り消し済みの状態は Order には残らない。`
- goal: `状態ごとの分岐を、状態ごとの新しいクラス(UnpaidState/PaidState/ShippedState)に集めよう。Extract Methodで分岐を handlePay / handleShip / handleCancel として取り出し、Move Methodで状態のクラスへ移す。1つの状態クラスが支払い・発送・取り消しの3つをすべて持ち、次の状態もそのクラスが決める。最後に3クラスとも OrderState を実装(implements)しよう。上級3(Strategy)は1クラスが1つの計算を持って差し替わったが、State は状態そのものをクラスにする。メソッドは13行・クラスは42行・ファイルは44行以内、1クラスの責務は2種類まで、依存先は3クラスまで`
- why: `注文の状態が増えるたびに、支払い・発送・取り消しの全メソッドの分岐を読み直していました。状態ごとのクラスに分けると、1つの状態でできることと次に移る先がまとまり、状態の追加や変更で読む場所が絞れます。`
- classNames(自動命名。初期のクラス名と重ねない): `http: 'OrderActionValidator'`、`state-dispatch: 'OrderStateDispatcher'`、`state-unpaid: 'UnpaidState'`、`state-paid: 'PaidState'`、`state-shipped: 'ShippedState'`
- methodNames: `http: 'validateAction'`、`state-dispatch: 'dispatchToState'`、`state-unpaid: 'handleUnpaidOrder'`、`state-paid: 'handlePaidOrder'`、`state-shipped: 'handleShippedOrder'`

### 初期コードベース

ID は他ステージのテストが名指しする ID(`class-order`・`class-order-controller` など)と重ねない。`lines` はコードの行数と一致させる
(`stageCode.test.ts`)。1行に文は1つ。後ろに処理が続く Fragment では、行頭が `return` の行を書かない(`if (...) return ...;` は可)。

| ファイル(id) | クラス(id) | メソッド(id・可視性) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/order/OrderController.ts`(`file-order-action-controller`) | OrderController(`class-order-action-controller`) | `handleOrderAction`(`method-handle-order-action`・public) | `frag-validate-action` / 注文IDと操作を検証して注文を読み込む / 2 / `http`<br>`frag-dispatch-state` / OrderState(インターフェース)経由で今の状態に操作を任せ、次の状態を保存する / 4 / `state-dispatch` / uses `method-order-state-pay`・`method-order-state-ship`・`method-order-state-cancel` |
| `src/order/Order.ts`(`file-stateful-order`) | Order(`class-stateful-order`) | `pay`(`method-order-pay`・public) | `frag-pay-unpaid` / 未払いなら、決済して次の状態を支払済みにする / 3 / `state-unpaid` / suggestedName `handlePay`<br>`frag-pay-paid` / 支払済みなら、二重決済を防ぐためにエラーにする / 2 / `state-paid` / suggestedName `handlePay`<br>`frag-pay-shipped` / 発送済みなら、支払いを受け付けずエラーにする / 2 / `state-shipped` / suggestedName `handlePay` |
| 〃 | 〃 | `ship`(`method-order-ship`・public) | `frag-ship-unpaid` / 未払いなら、発送を受け付けずエラーにする / 2 / `state-unpaid` / suggestedName `handleShip`<br>`frag-ship-paid` / 支払済みなら、倉庫へ出荷を指示して次の状態を発送済みにする / 3 / `state-paid` / suggestedName `handleShip`<br>`frag-ship-shipped` / 発送済みなら、二重発送を防ぐためにエラーにする / 2 / `state-shipped` / suggestedName `handleShip` |
| 〃 | 〃 | `cancel`(`method-order-cancel`・public) | `frag-cancel-unpaid` / 未払いなら、在庫を戻して注文を取り消し履歴へ移す / 3 / `state-unpaid` / suggestedName `handleCancel`<br>`frag-cancel-paid` / 支払済みなら、返金して在庫を戻し、注文を取り消し履歴へ移す / 4 / `state-paid` / suggestedName `handleCancel`<br>`frag-cancel-shipped` / 発送済みなら、取り消しは受け付けず返品窓口を案内する / 2 / `state-shipped` / suggestedName `handleCancel` |
| `src/order/OrderState.ts`(`file-order-state`) | OrderState(`class-order-state`) | `handlePay`(`method-order-state-pay`)・`handleShip`(`method-order-state-ship`)・`handleCancel`(`method-order-state-cancel`)、すべて public・`fragments: []` | なし(インターフェース役) |

各 Fragment の C# コード(`code.csharp`。行数 = 上の lines):

```csharp
// frag-validate-action
if (string.IsNullOrWhiteSpace(action)) throw new ValidationException("操作が指定されていません");
var order = await _orderRepository.FindAsync(orderId, cancellationToken) ?? throw new NotFoundException(orderId);
// frag-dispatch-state
var next = action == "pay" ? order.State.handlePay(order) : null;
next ??= action == "ship" ? order.State.handleShip(order) : null;
next ??= action == "cancel" ? order.State.handleCancel(order) : throw new ValidationException("未対応の操作です");
await _orderRepository.SaveAsync(order.ChangeState(next), cancellationToken);
// frag-pay-unpaid
var charge = status == OrderStatus.Unpaid ? await _payment.ChargeAsync(id, total, cancellationToken) : null;
if (charge is { Succeeded: false }) throw new PaymentException(charge.ErrorMessage);
if (charge is not null) return OrderStatus.Paid;
// frag-pay-paid
if (status == OrderStatus.Paid) _logger.LogWarning("支払済みの注文 {OrderId} に支払いが届きました", id);
if (status == OrderStatus.Paid) throw new InvalidOperationException("支払済みの注文は二重に決済できません");
// frag-pay-shipped
_logger.LogWarning("発送済みの注文 {OrderId} に支払いが届きました", id);
throw new InvalidOperationException("発送済みの注文は支払いを受け付けません");
// frag-ship-unpaid
if (status == OrderStatus.Unpaid) _logger.LogWarning("未払いの注文 {OrderId} に発送指示が届きました", id);
if (status == OrderStatus.Unpaid) throw new InvalidOperationException("未払いの注文は発送できません");
// frag-ship-paid
var shipment = status == OrderStatus.Paid ? await _warehouse.RequestShipmentAsync(id, address, cancellationToken) : null;
if (shipment is not null) trackingNumber = shipment.TrackingNumber;
if (shipment is not null) return OrderStatus.Shipped;
// frag-ship-shipped
_logger.LogWarning("発送済みの注文 {OrderId} に発送指示が届きました", id);
throw new InvalidOperationException("発送済みの注文は二重に発送できません");
// frag-cancel-unpaid
if (status == OrderStatus.Unpaid) await _inventory.ReleaseAsync(items, cancellationToken);
if (status == OrderStatus.Unpaid) await _orderRepository.ArchiveCanceledAsync(id, cancellationToken);
if (status == OrderStatus.Unpaid) return OrderStatus.Canceled;
// frag-cancel-paid
if (status == OrderStatus.Paid) await _payment.RefundAsync(id, total, cancellationToken);
if (status == OrderStatus.Paid) await _inventory.ReleaseAsync(items, cancellationToken);
if (status == OrderStatus.Paid) await _orderRepository.ArchiveCanceledAsync(id, cancellationToken);
if (status == OrderStatus.Paid) return OrderStatus.Canceled;
// frag-cancel-shipped
_logger.LogInformation("発送済みの注文 {OrderId} の取り消しを返品窓口へ案内しました", id);
throw new InvalidOperationException("発送済みの注文は取り消せません。返品窓口へお問い合わせください");
```

### 変更依頼(changeRequests。この順に並べる)

| # | id | kind | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-add-returned-state` | `extend` | 「返品」の状態を足して | 発送済みの注文を返品として受け付けたら、「返品」の状態にしたい。返品の注文は、支払い・発送・取り消しのどれも受け付けない。 | `state-returned` | 9 | `handleReturnedOrder` | なし(最初に全文を見せる extend) |
| 2 | `req-shipped-return` | (modify) | 発送済みの注文の取り消しを、返品として受け付けて | 発送済みの注文の取り消しは、今はエラーにして返品窓口を案内している。返品として受け付け、次の状態を「返品」にしたい。 | `state-shipped` | 4 | `acceptReturnRequest` | なし(最初に全文を見せる modify) |
| 3 | `req-paid-refund-fee` | (modify) | 支払済みの注文の取り消しで、返金手数料を差し引いて | 支払済みの注文を取り消すとき、返金額から決済手数料を差し引きたい。 | `state-paid` | 4 | `deductRefundFee` | `{ from: 'PMの鈴木さん', text: '「支払いが済んだ注文」の扱いを見直したいという話が、いつか出てくるかもしれないらしいです。' }` |

- 1と2は同じ「返品」の話を、**新しい状態はクラスを足すだけ(extend)/遷移元の発送済みは1クラスだけ直す(modify)**の2面で見せる。
- ボス(`boss: true`)は付けない(ボスのあるステージを固定で列挙しているテストを変えないため)。

### 理解度チェック(checks。正解は最長の選択肢にしない・正解の位置を2問で変える)

- `check-1`(answer: 1)「Order の状態ごとの分岐を、状態ごとのクラスに分ける(State パターン)と、何が良くなる?」
  - 0: `Order の if 分岐をすべて読まないと、ある状態で何ができるかが分からなくなる` / 解説: `それは分ける前の困りごとです。分けたあとは、1つの状態のクラスを読めば済みます。`
  - 1: `ある状態でできることと次に移る先が、その状態のクラスだけを読めば分かる` / 解説: `状態ごとの振る舞いと遷移が1か所にまとまるので、状態の変更で読む場所が絞れます。`
  - 2: `状態をいくつ足しても、どのクラスも一切書き換えずに済むようになる` / 解説: `新しい状態はクラスを足して作れますが、そこへ移る元の状態のクラスは直します。変更依頼で確かめてみましょう。`
- `check-2`(answer: 2)「State パターンと Strategy パターン(上級3)の違いとして、合っているのはどれ?」
  - 0: `State はインターフェースを使うが、Strategy はインターフェースを使わず if 分岐のまま方式を切り替える` / 解説: `どちらも共通のインターフェースを実装したクラスに分けます。違いは分け方の軸です。`
  - 1: `できあがるクラスの形はほぼ同じなので、どちらの名前で呼んでも同じで、使い分けを考える必要はない` / 解説: `形が似ていても、方式を外から選ぶのか、自分の状態が移り変わるのかで、持たせる操作と遷移が変わります。`
  - 2: `State は1つのクラスが複数の操作を持ち、次の状態へ移る判断もそのクラスが持つ` / 解説: `Strategy は1つの計算方式を外から差し替え、State は状態そのものが操作と遷移を受け持ちます。`

### 模範解答(`sampleAnswerSteps['advanced-order-state']`、27手)

同じ名前(`handlePay` など)で抽出するので、`advanced-discount-strategy`・中級10と同じく「抽出→移動」を1組ずつ行う
(Extract Method は同じクラスに同名メソッドがあると失敗するため)。

```ts
'advanced-order-state': [
  // 状態ごとに: ファイルとクラスを作り、3つの操作の分岐を抽出→移動し、OrderState を実装する。
  ...(['Unpaid', 'Paid', 'Shipped'] as const).flatMap((state): SolutionStep[] => {
    const suffix = state.toLowerCase();
    const file = `src/order/${state}State.ts`;
    const toClass = `${state}State`;
    return [
      { addFile: file },
      { addClass: { name: toClass, file } },
      { extract: { from: 'pay', fragmentIds: [`frag-pay-${suffix}`], name: 'handlePay' } },
      { move: { method: 'handlePay', fromClass: 'Order', toClass } },
      { extract: { from: 'ship', fragmentIds: [`frag-ship-${suffix}`], name: 'handleShip' } },
      { move: { method: 'handleShip', fromClass: 'Order', toClass } },
      { extract: { from: 'cancel', fragmentIds: [`frag-cancel-${suffix}`], name: 'handleCancel' } },
      { move: { method: 'handleCancel', fromClass: 'Order', toClass } },
      { addInterface: { class: toClass, interface: 'OrderState' } },
    ];
  }),
],
```

方針の表(`solutionPhaseTable['advanced-order-state']`):

- `{ from: 0, title: '「未払い」の分岐を、UnpaidState にまとめる', why: '未払いのときの支払い・発送・取り消しを1つのクラスに寄せれば、未払いでできることと次に移る先が1か所で読めるため' }`
- `{ from: 9, title: '「支払済み」も同じ形で PaidState にまとめる', why: '同じ手順で作れば、どの状態も OrderState として同じように扱えるため' }`
- `{ from: 18, title: '「発送済み」も ShippedState にまとめる', why: '最後の状態も分ければ、Order に状態ごとの判断が残らなくなるため' }`

### 机上の検算(`stageCatalog.test.ts` の保証に通ること)

行数は `lineCount.ts` のとおり「コード行数+1(ラベルのコメント行)」、メソッドは +3 と Fragment 間の空行、クラスは +3 とメソッド間の空行で数える。
抽出で残る呼び出し行は `handlePay();` の1行+1 = 2行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| `Order.pay` / `ship` / `cancel` | 15 / 15 / 17(3件違反) | 呼び出し3行だけ: 11 / 11 / 11 | メソッド13 |
| `OrderController.handleOrderAction` | 12 | 12 | メソッド13 |
| 状態クラスのメソッド(最大) | — | `PaidState.handleCancel` 8 | メソッド13 |
| `Order` クラス・`Order.ts` | 52 / 52(各1件違反) | 38 / 38 | クラス42 / ファイル44 |
| `UnpaidState` / `PaidState` / `ShippedState` | — | 25 / 26 / 23 | クラス42 |
| 責務の種類 | Order 3種(1件違反)・Controller 2種 | Order 0種(呼び出しだけ)・Controller 2種・各状態クラス1種 | 2 |
| 依存 | Controller → OrderState | Controller → OrderState、Order → 3つの状態クラス | 3 |

- 初期: line-limit 5件+responsibility 1件 = **40点**。減点の種類は `['line-limit', 'responsibility']`。
- 模範解答後: **100点**。確認した規則: 循環なし(状態クラスはどこも呼ばない)/空の入れ物なし/未使用 private なし(移動で public になる)/
  約束違反なし(3クラスとも `handlePay`・`handleShip`・`handleCancel` を持ち OrderState を実装。Order・Controller の public メソッド名は契約名と重ならない)/
  極小メソッドなし(状態クラスのメソッドは最小でもコード2行+1=3行)/横流しなし(Order の各メソッドは呼び出しが3行)/混在した抽出メソッドなし/
  フィールドを持たないので Feature Envy・カプセル化・凝集度は対象外/役割タグ(`roleResponsibilities`)は使わない。
- 変更依頼(modify の変更コスト `scoreChange`):
  - `req-shipped-return`: 初期は Order の3メソッドが変更箇所で、巻き込み6(-30)+上限超え5(-50)= 20点 → 模範解答後は ShippedState の3メソッド
    (追加後 11行・クラス38行で上限内)、波及1(Order が呼ぶ。-5)= 95点。
  - `req-paid-refund-fee`: 同様に 20点 → 95点(追加後 PaidState のメソッド最大13行・クラス41行で上限内)。
  - 「はっきり楽になる」(1件目の modify): 読む行数 47 → 18(0.75倍以下)。クラス数は1→1で増えない。
- 解答例の置き方(`sampleImplementation`)はすべて100点:
  - extend `req-add-returned-state`: OrderState を実装する新しいクラスに置く。既存クラスの修正0、OrderState は Controller から呼ばれているので `'abstract'`。
  - modify 2件: ShippedState / PaidState に置く(他の責務なし・散らばりなし)。
  - よって `knownChangeRequestExceptions` に足すものはない。
- 機能の追加の痛み(`measureExtendPain`): 初期は OrderState がまだ誰にも実装されていないので入口にならず、既存クラスを1つ書き換える。
  模範解答後は書き換え0・置き先は `{ kind: 'new-class', implementing: 'OrderState' }`。
- うわさ: `rumoredRequests` は1件目の extend と1件目の modify を除くので、3件目だけがうわさを持つ。話し手は既存の章の話し手、1文、
  タイトル・partName・自動命名のクラス名/メソッド名を含まず、「かもしれない」「らしい」を含む。
- 振る舞いのテスト: 入口は `handleOrderAction`・`pay`・`ship`・`cancel`。抽出・移動・実装の設定は実行される処理の集合を変えないので、どの手の後も緑。
- 自動命名: 抽出は単独の Fragment なので `suggestedName`(`handlePay` など)がそのまま候補になり、空いた場所へドラッグして作るクラスは
  `classNames` から `UnpaidState` などと自動で付く(プレイヤーに命名させない)。

### ストーリー(`storyChapters.ts`)

- 上級8の章: title を `取り込みの手順` に、intro の先頭「1年の締めくくりだ。」を削り、outro を `3月の終わり。新しい取引先から、取り込みの相談が届きました。` にする(結びは上級8の1件目の依頼 `req-add-xml` へつなぐ)。
- 新しい章を末尾に足す: `{ stageId: 'advanced-order-state', title: '最後の章、注文の状態', speaker: TAKAHASHI, intro: 'QAの高橋です。注文の状態まわりの不具合が続いています。支払い・発送・取り消しのどれを直しても、ほかの状態の分岐まで読むことになるんです。状態ごとに、何ができて次にどこへ移るかを1か所で確かめられる形にしてください。', outro: '3月31日の夕方。最後の依頼が届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`

## 動きの仕様

- ステージ一覧の上級の末尾(上級8の次)に「上級9: 注文の状態ごとの分岐を State パターンへ組み替える」が出る。
- 初期画面: OrderController → OrderState の依存矢印が1本。Order には矢印が無く、3つのメソッドが行数超過で赤い。
- プレイヤーの操作は既存のものだけ: メソッドエディタで分岐を1つ選んで抽出(名前の候補は `handlePay` など)→ 空いた場所へドラッグして
  新しいクラス(自動で `UnpaidState` などと命名)を作る、または既存の状態クラスへドラッグ → クラスの右クリックから OrderState を実装。
- 3クラスとも OrderState を実装すると、OrderState から3本の実装の矢印が出て100点になる。
- 100点のあと、変更依頼は「返品」の状態を足す(新しいクラスで100点)→ 発送済みの取り消しを返品へ(ShippedState だけ直す)→
  支払済みの返金手数料(うわさ付き)の順に出る。

### 設計判断(確定)

1. **状態は「未払い・支払済み・発送済み」の3つにする(題材の「キャンセル」を「支払済み」に置き換える)。**
   「未払い・発送済み・キャンセル」の3つだと、支払い(pay)のあと発送(ship)へ進む間の状態が無く、遷移がつながらない。
   4状態にすると模範解答が 4×9 = 36手になり、上級で最長の上級8(21手)を大きく超えるので遊びにくい。
   取り消した注文は取り消し履歴へ移して Order から外す(コードの `ArchiveCanceledAsync`)ことにし、取り消し済みを状態クラスにしない。
2. **OrderState を呼ぶのは OrderController にし、分岐は Order に残す(中級10と同じ「移行の途中」の形)。**
   このゲームでは呼び出し先(`uses`)を書き換える操作が無く、Order の呼び出し行は具体的な状態クラスを指したままになる。
   そのままだと OrderState がどこからも呼ばれず、変更依頼「返品の状態を足して」の解答例が「どこからも呼ばれない新クラス」で80点になる。
   Controller が最初から OrderState 経由で呼ぶ形にすれば、新しい状態クラスが「呼ばれている抽象」につながり100点になる。
   中級10(CheckoutService が MemberRank を呼び、分岐は PriceCalculator 側)と同じ作りで、既存の採点に手を入れずに済む。
3. **遷移は「次の状態を返す」書き方で表し、状態クラスから Order を呼ばせない。**
   状態クラスが Order のメソッドを呼ぶ(`uses`)と Order ⇄ 状態クラスの循環依存で減点される。State パターンには
   「状態のメソッドが次の状態を返し、受け取った側が切り替える」書き方があるので、それを Fragment のコードとラベルで見せる。
4. **Order の操作名(pay/ship/cancel)と契約名(handlePay/handleShip/handleCancel)を分ける。**
   同じ名前にすると、Order が OrderState と同名の public メソッドを持つのに実装していない「実装の宣言漏れ」で、解答後も減点が残る。
   GoF の State の `Handle()` に合わせて `handle〜` にする。
5. **結合度は上限3で認め、conditionNotes で理由を出す。** 上級3と同じく、Order が3つの状態クラスを呼ぶ形は表現上避けられない。
6. **責務は「状態」単位にする(状態×操作の9種にはしない)。** 状態クラスの責務が1種類になり、「状態ごとにまとめる」ことが採点と一致する。
   操作ごとにクラスを分ける誤答(近道2)が責務の混在で100点にならない。
7. **返品は extend と modify の2件に分けて出す。** State でも新しい状態を足すと遷移元(発送済み)のクラスは直す、という正直な姿を見せる
   (理解度チェック1の誤答「一切書き換えずに済む」の解説と対応させる)。
8. **うわさのために3件目の modify を足す。** うわさは「最初に全文を見せる extend・modify 以外」にしか付けられないため。
9. **E2E は足さない。** 新しい操作・UIは無く、使う操作(抽出・移動・新しいクラス・実装の設定)は既存の E2E が守っている
   (上級3の仕様と同じ判断)。既存の E2E が通ることだけを確かめる。

## TDD対象

新しい純粋関数は無い。ステージデータが仕様どおりに採点されることを、先にテストを書いて確かめる(Red → Green)。AAA で書く。

### `orderStateStage.test.ts`(infrastructure・新規)

- 模範解答は27手である
- 初期は100点未満(40点)で、減点の種類は line-limit と responsibility だけ
- 初期の `method-order-pay`・`method-order-ship`・`method-order-cancel` がメソッドの行数上限を超える
- 模範解答を適用すると100点
- 模範解答後、UnpaidState・PaidState・ShippedState の3クラスが OrderState を `interfaceIds` に持ち、それぞれ `handlePay`・`handleShip`・`handleCancel` の3メソッドを持ち、責務は1種類だけ
- 模範解答後、Order に残る処理は呼び出し行(`call`)だけ
- 異常系: 模範解答から `addInterface` の3手を抜くと100点未満(約束違反)
- extend `req-add-returned-state`: 初期は書き換えるクラスが1以上、模範解答後は0で、置き先が `{ kind: 'new-class', implementing: 'OrderState' }`
- modify `req-shipped-return`: 初期の変更箇所は Order の3メソッド(1クラス)、模範解答後は ShippedState の3メソッド(1クラス)で、読む行数が 47 → 18
- extend が1件目・modify が2件、3件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['advanced-order-state', ['line-limit', 'responsibility']]` を足す
- 近道(`shortcuts`、どちらも100点未満):
  - `状態クラスを作って移すが、OrderState を実装しない`: 模範解答から `addInterface` の手を除いたもの
  - `状態ではなく操作ごとのクラス(PayHandler/ShipHandler/CancelHandler)に分ける`: 3つのファイルとクラスを作り、pay の3分岐を `payUnpaid`・`payPaid`・`payShipped` として抽出して PayHandler へ移す(ship・cancel も同様)。各クラスが状態の責務を3種類持つので責務の混在で減点される
- その他の全ステージ共通の検査(模範解答で100点・解答例の依頼が100点・うわさ・自動命名・ID重複など)は、コードの変更なしに新ステージにも効く

## 受け入れ基準

1. ステージ一覧を開くと、上級の末尾(上級8の次)に「上級9: 注文の状態ごとの分岐を State パターンへ組み替える」があり、学べることに「State」「状態遷移」が出る
2. 上級9を開くと初期点が40点で、Order の pay・ship・cancel が行数超過、Order が責務の混在で減点されている
3. pay の「未払いなら…」を抽出すると名前の候補が `handlePay` になり、空いた場所へドラッグすると `UnpaidState` という名前のクラスが自動でできる
4. 模範解答の手順どおり(3つの状態クラスへ分岐を移し、3クラスとも OrderState を実装)に操作すると100点になる。解答例の再生でも最後に100点になる
5. 100点のあと、変更依頼「「返品」の状態を足して」で、OrderState を実装する新しいクラスに部品を置くと置き方が100点になる。「発送済みの注文の取り消しを、返品として受け付けて」は ShippedState に置くと100点になる。3件目の依頼にはうわさ(PMの鈴木さん)が先に出る
6. ストーリーをオンにすると、上級8のあとに「最後の章、注文の状態」が出て、上級8の章はもう「最後の章」と名乗らない
7. `docs/stages/report.md` が再生成され、上級9の行がある
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 取り消し済み(キャンセル)を状態クラスにすること。4状態にすると模範解答が36手になる。必要になったら、状態を4つにした別ステージとして仕様化する
- Order の呼び出し行を「今の状態に任せる1行」に置き換える操作(呼び出し先の付け替え)。上級3の仕様(`advanced-discount-strategy.md`)と同じ既知の制約で、新しい操作は足さない
- 状態クラスが Order を呼び返す形(循環を伴う State)や、状態の Singleton 化
- 新しい採点ルール(「状態の遷移漏れ」の検出など)・新しい操作・型の変更
- 返品の状態をプレイヤーに実際に作らせて100点にする追加課題(変更依頼の部品の置き方で表すだけにする)
- ボスの変更依頼(ボスのあるステージを固定で列挙しているテストの変更が要るため)
- 既存ステージ(中級10・上級3・上級8)のデータの変更。ストーリーの上級8の章の文言だけは、最後の章でなくなるので直す
- `docs/feature-ideas/IDEAS.md` の更新(仕様化した案の片付けは、仕様の確定後に呼び出し元が行う)
