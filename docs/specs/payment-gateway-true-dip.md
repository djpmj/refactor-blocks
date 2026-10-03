# 上級2 作り直し: 本物のDI/DIPを表現する決済ゲートウェイステージ

## 背景・目的

`docs/specs/advanced-payment-gateway-interface.md`(以下「旧仕様書」)で作った上級2
(`advanced-payment-gateway-interface`)は、`dependencyLimit: 1` を達成するために
`chargeStripe`/`chargePaypal` という**処理本体を丸ごと** `PaymentGateway`(インターフェース役)へ
Move Method する模範解答になっていた。レビューの結果、これは本物のDI/DIPではないと判明した。

- 実際のTypeScript/Javaの `implements` は「実装クラスが自分で処理本体を用意して契約を満たす」ものだが、
  旧仕様書の模範解答は処理本体をインターフェース側に集約し、`StripeGateway`/`PaypalGateway` には
  何も残らない。これは `extends` で基底クラスに共通処理を引き上げる(Pull Up Method)のと実質同じで、
  上級1(`NotifierBase`)と同じトリックに `implements` というラベルを貼っているだけだった。
- 依存計算(`src/domain/codebase/dependencies.ts` の `classDependencies`)は「`Fragment.uses` が指す
  メソッドIDを**今**所有しているクラス」を動的に見て依存先を決めるだけなので、`PaymentService` の依存が
  1本に見えるのは「2つの実装を物理的に1クラスへ集約したから」であり、「呼び出し元が抽象型だけを知り、
  実行時にどの具象クラスが注入されるかは外部が決める」という本来のDI/DIPとは違う。

このドキュメントは、上級2ステージ(同じステージID `advanced-payment-gateway-interface`)を、
**呼び出し元が抽象型への依存だけを持ち、具象クラス(`StripeGateway`/`PaypalGateway`)がそれぞれ
自分の処理本体を保ったまま契約を実装する**形に作り直す仕様である。

## 本物のDI/DIPをこのドメインモデルにどう表現するか(設計の比較)

### 前提として確認した既存コードの挙動

- `Fragment.uses` は「呼び出し先メソッドID」の配列で、**プレイヤー操作でその中身を書き換える手段は
  Extract Method が新しく作る呼び出し行(`callFragmentId`、`uses: [newMethodId]`)以外に存在しない**。
  しかもこの書き換えは**抽出元と同じクラスの中でしか**起きない(`extractMethod.ts` はクラス内のメソッド
  一覧を `splice` するだけで、他クラスへは触れない)。
- `moveMethod.ts` はメソッドを**丸ごと**(そのメソッドが持つ全 `Fragment` ごと)別クラスへ移すだけで、
  メソッドIDも中身も変えない。`classDependencies` はメソッドIDの「今の所有クラス」を見るので、
  Move Method で依存の矢印の指す先を変えられるが、**移した中身がそのまま持っていかれる**(旧仕様書の
  問題の直接の原因)。
- `superclassId`/`superclassKind`(`setSuperclass.ts`)は**宣言的なメタデータ**でしかなく、
  `classDependencies`/`scoreCodebase` のどちらにも一切影響しない(`docs/specs/inheritance.md` で
  明示的に決めた通り)。
- `DiscountStrategy`(上級3、`docs/specs/advanced-discount-strategy.md` で採用済み)は、
  「`fragments: []` の0行メソッド1つだけを持つクラス」で「まだ誰も実装していない契約」を表現する
  パターンを**すでに実績化**している(`advancedStages.test.ts` の
  `'初期状態では、DiscountStrategyが実装すべきメソッド calculate を1つ宣言している(処理本体はない)'`)。

### 「呼び出し元の依存が本当に1本になる」ことの成立可否(重要な検証)

`PaymentService.checkout` の依存を「2つの具象クラスへの直接依存」から「1つの抽象への依存」へ
**プレイヤー操作で遷移させる**ことが、処理本体をインターフェースへ移さずに可能かを検証した。

結論: **不可能。** 理由は次の通り。

- `checkout` の既存の `Fragment.uses` を書き換える操作が存在しない以上、`checkout` が最終的にどの
  メソッドIDを呼ぶかは**ステージ定義データとして最初から決まっているもの**でしかありえない
  (Extract Methodで新しい呼び出しを作れるのは `checkout` 自身から抽出したときだけで、その新メソッドは
  `PaymentService` 内に生まれる。それを他クラスへ移す=Move Methodであり、結局「中身ごと移す」問題に戻る)。
- 百歩譲って「`checkout` から薄い中継メソッドを抽出し、それだけを `PaymentGateway` へ移す」としても、
  その中継メソッドが実際に Stripe/PayPal のどちらを呼ぶかを決める分岐処理(`uses` が2つの具象メソッドIDを
  指す)を持たない限り決済は実行できない。その分岐処理を担うメソッドは、どこに置いても
  **2つの具象クラスへの依存を持つ**(`PaymentService` に残すか `PaymentGateway` に移すかの違いでしかない)。
  つまり、静的な呼び出しグラフ(`Fragment.uses` ベースの `classDependencies`)の中に「2つの実装のどちらかを
  選ぶコード」が存在する限り、**そのコードを持つクラスの依存は必ず2以上になる**。これは本ドメインモデルの
  制約ではなく、静的解析そのものの原理(実行時に選ばれる実装は、静的な呼び出しグラフには現れない)。
- したがって、「呼び出し元の依存が本物のDIとして1本である」ことを表現する唯一の方法は、
  **`checkout` が最初から抽象メソッド(`PaymentGateway.charge`)だけを呼ぶようにステージデータを書く**
  ことである。これは「プレイヤーの操作で違反が0になる」という他ステージの形ではなく、
  「最初から正しく作られたコードに、抽象を実装する具象クラスを後から正しく結びつける」という形になる。
  実務のDIコンテナ配線(`new StripeGateway()` をどこかに書く)は今回も引き続きモデル化しない
  (旧仕様書・上級3仕様書と同じ既知の制約)。

この結論は「結合度が1に**下がる**」という体験は作れないが、代わりに**上級3(Strategy)との対比**という、
より本質的な学びを提供する。上級3は「具象クラスが増えるほど呼び出し元の依存本数も増える」
(`dependencyLimit: 3`、`docs/specs/advanced-discount-strategy.md` のスコープ外「結合度を1に減らす表現」)。
本ステージ(作り直し後)は「具象クラスの中身がどれだけ変わっても、実装先が何個あっても、
呼び出し元の依存本数は常に1のまま」になる。**この対比こそが「本物のDI/DIPは呼び出し元を実装の数から
切り離す」という主題そのもの**であり、ステージ固有テストで直接検証する(後述)。

### 検討した設計の選択肢

1. **`Method` に `isAbstract?: boolean` を追加し、「契約メソッド」を型で明示する。** → **不採用(YAGNI)**。
   `DiscountStrategy.calculate` がすでに「`fragments: []` の空メソッド」という**同じ規約**で契約を表現し、
   ステージ固有テストで直接検証されている実績がある(上記参照)。この規約と挙動が完全に同じものを、
   わざわざ型で二重管理する理由がない。`isAbstract` を足しても `classDependencies`/`scoreCodebase` の
   計算は一切変わらない(`superclassKind` と同じく採点に影響しない宣言的メタデータになるだけ)ので、
   ponytailの階段1(そもそも要るか)で止まる。**将来、「抽象メソッドへは Move Method も Extract Method
   もできないようにする」という整合性チェックが欲しくなったときに初めて検討する。**
2. **具象メソッド(`chargeStripe`)に `abstractMethodId` のような「どの契約を満たすか」を指す
   リンクフィールドを追加する。** → **不採用**。今回の依存計算にもスコアリングにも一切使われない
   (`checkout` は `PaymentGateway.charge` だけを直接指すため、`StripeGateway`/`PaypalGateway` 側から
   リンクを辿る必要がどこにもない)。UIで「この実装はどの契約を満たすか」をジャンプ表示したくなったら
   検討する用途はあるが、今回のスコープ(依頼された「呼び出し元の依存を抽象だけにする」表現)には不要。
   `docs/specs/inheritance.md` が「メソッドのオーバーライド」の意味付けを明示的に先送りしたのと同じ判断。
3. **`Fragment.uses` の書き換え操作(Extract Interface)を新設する。** → **不採用**。旧仕様書・上級3仕様書が
   すでに検討・却下済み(他ステージでの使い道がなく、1ステージのためだけに新しいプレイヤー操作・UI・
   E2Eテストを丸ごと作ることになるため)。今回の検証([前節]参照)でも、この操作があったとしても
   「2つの実装のどちらかを選ぶコードは静的グラフ上のどこかに必ず存在する」という制約は解消できない
   (`uses` を書き換えられても、書き換えた先の分岐ロジック自体は依然として2つの具象へ依存する)ため、
   採用してもこのステージの目的(呼び出し元の依存を1本にする)には効果がないと判明した。
4. **`superclassId`/`superclassKind`(既存)をそのまま「実装(implements)」の宣言に使い、
   `PaymentGateway` に最初から `fragments: []` の契約メソッド `charge` を1つ持たせ、`PaymentService.checkout`
   はステージ定義の時点でその契約メソッドだけを呼ぶ(`uses: ['method-payment-gateway-charge']`)ようにする。
   `StripeGateway`/`PaypalGateway` は自分の処理本体を最後まで保持したまま、Set Superclass
   (`kind: 'implements'`)で `PaymentGateway` を実装したと宣言する。** → **採用**。
   新しい型・新しいドメイン関数・新しいプレイヤー操作を一切追加せずに実現できる。

**結論: ドメイン層・アプリケーション層・プレゼンテーション層のコードは一切変更しない。
変更するのは「ステージ定義データ」(`advancedStages.ts`)と「模範解答」(`sampleAnswer.ts`)、
「ステージ固有の確認テスト」(`advancedStages.test.ts`)のみ。**
旧仕様書の「新しいドメイン概念は追加しない」という結論そのものは正しかった。誤っていたのは
**ステージデータの作り方**(処理本体を移す設計)であり、それを今回のドキュメントで直す。

## 新しいドメイン操作が必要かどうかの判断(結論: 追加しない)

プレイヤーが「このクラスはこのメソッドを(抽象型経由で)呼ぶ」と設定する操作は不要と判断した。理由:

- `PaymentService.checkout` が `PaymentGateway.charge` を呼ぶという事実は、**ステージ開始時点で
  すでに正しく設定されているデータ**であり、プレイヤーがゲーム内操作で「設定する」対象ではない
  (前節の検証の通り、これをプレイヤー操作で「後から作る」ことは本ドメインモデルでは表現できない)。
- プレイヤーが実際に行う操作は「Extract Method で責務ごとに処理を分ける」「Set Superclass で
  実装関係を宣言する」の2つだけで、どちらも既存操作(`extractMethod`/`setSuperclass`)そのままで足りる。

## 変更対象ファイル一覧

### 新規

なし。

### 変更

| パス | 役割 | 層 |
|---|---|---|
| `src/infrastructure/stages/advancedStages.ts` | `paymentGatewayInterfaceStage` の `description`/`goal`/`limits`/`dependencyLimit`/`responsibilityLimit`/`changeRequests`/`codebase` を、下記「ステージ定義」の内容に置き換える(ステージID・タイトルは変更しない) | infrastructure |
| `src/domain/stage/sampleAnswer.ts` | `SolutionStep.extract` に任意項目 `fromClass?: string` を追加し、`methodIdByName` をクラス指定に対応させる(後方互換)。`sampleAnswerSteps['advanced-payment-gateway-interface']` を下記「模範解答」の4手順に置き換える | domain |
| `src/infrastructure/stages/advancedStages.test.ts` | `describe('advanced-payment-gateway-interface', ...)` ブロックを、下記「TDD対象」のアサーションに置き換える | infrastructure(テスト) |

`src/domain/codebase/*`・`src/domain/scoring/*`・`src/domain/change/*`・`src/application/*`・
`src/presentation/*` は一切変更しない。

## データ/型の変更

なし。

## `description`/`goal` の文言

タイトル(`上級2: 決済ゲートウェイをインターフェース越しに呼ぶ`)・ステージIDは変更しない。

```
description:
  'PaymentService の checkout は、共通インターフェース PaymentGateway 経由で決済を呼び出すよう最初から
   書かれている(Stripe・PayPalを名指ししない)。しかし StripeGateway・PaypalGateway はまだ
   PaymentGateway を実装(implements)したと宣言しておらず、どちらも「決済APIを呼び出す」処理と
   「決済ログを記録する」処理を1つのメソッド(charge)に詰め込んでいて、行数の上限を超えている。'
goal:
  'StripeGateway・PaypalGateway の charge を、Extract Methodで責務(API呼び出し/ログ記録)ごとに分け、
   PaymentGateway を実装(implements)するよう設定しよう。StripeGateway・PaypalGatewayの中身がどう
   変わっても、PaymentServiceの依存先は最初から最後まで PaymentGateway 1つのまま変わらない。
   上級3(方針を増やすほど依存も増える)と見比べてみよう。メソッドは90行以内、1クラスの責務は3種類まで'
```

`goal` に「上級3との対比」を明文化するのは、このステージの中心的な学び(呼び出し元の依存本数が
実装の数・中身によらず一定である、という本物のDIPの性質)を、`classDependencies` のテストだけでなく
プレイヤー自身が画面上の文章で意識できるようにするため。

## ステージ定義(具体的なシナリオ)

題材: ネットショップの決済。`PaymentService.checkout` は**最初から**共通インターフェース
`PaymentGateway` だけを呼んでいる(具象クラスを直接名指ししない、正しいDIPの形)。しかし
`StripeGateway`・`PaypalGateway` はまだ `PaymentGateway` を実装(implements)したと宣言しておらず、
どちらも「決済APIを呼び出す」処理と「決済ログを記録する」処理を1つのメソッドに詰め込んでいて、
行数の上限を超えている。

```
files:
  src/payment/PaymentService.ts
    class PaymentService
      method checkout (public, id: method-checkout)
        frag-validate-payment  "注文内容とカード情報を検証する"                lines:60 responsibility:validation
        frag-dispatch-gateway  "PaymentGateway(インターフェース)経由で決済を実行する"
                                                                          lines:12 responsibility:gateway-dispatch
                                                                          uses:[method-payment-gateway-charge]

  src/payment/StripeGateway.ts
    class StripeGateway
      method charge (public, id: method-charge-stripe)
        frag-stripe-api-call    "Stripe APIを呼び出して決済する"   lines:60 responsibility:gateway-integration
        frag-log-payment-stripe "決済ログを記録する(Stripe)"      lines:32 responsibility:payment-logging
      method configureStripeCredentials (public, id: method-configure-stripe)
        frag-configure-stripe   "Stripe APIキーを設定する"        lines:14 responsibility:stripe-config

  src/payment/PaypalGateway.ts
    class PaypalGateway
      method charge (public, id: method-charge-paypal)
        frag-paypal-api-call    "PayPal APIを呼び出して決済する"  lines:58 responsibility:gateway-integration
        frag-log-payment-paypal "決済ログを記録する(PayPal)"     lines:32 responsibility:payment-logging
      method configurePaypalCredentials (public, id: method-configure-paypal)
        frag-configure-paypal   "PayPal APIキーを設定する"        lines:14 responsibility:paypal-config

  src/payment/PaymentGateway.ts
    class PaymentGateway
      method charge (public, id: method-payment-gateway-charge)
        (fragments: 空。DiscountStrategy.calculate と同じ、処理本体を持たない契約メソッド)
```

- `limits`: `{ method: 90, class: 250, file: 400 }`(`method < class < file` を満たす)。
  - `chargeStripe` = 60+32+overhead2 = **94行 > 90**(違反)。`chargePaypal` = 58+32+2 = **92行 > 90**(違反)。
  - `checkout` = 60+12+2 = 74行(90未満、常に違反なし。「80行以上のメソッドが1つ以上」の共通チェックは
    `chargeStripe`(94行)が満たす)。
  - `configureStripeCredentials`/`configurePaypalCredentials` = 14+2 = 16行(常に違反なし)。
  - `charge`(PaymentGateway) = 0+2 = 2行(常に違反なし)。
- `dependencyLimit`: `1`。`classDependencies` の初期状態の唯一の辺は
  `PaymentService → PaymentGateway`(`checkout` の `frag-dispatch-gateway` が
  `method-payment-gateway-charge` を指し、それを所有するのは `PaymentGateway` のため)。
  **初期状態から最後まで、この依存本数は変わらない**(下記「模範解答」参照)。
- `responsibilityLimit`: `3`。`StripeGateway`/`PaypalGateway` はそれぞれ
  `{gateway-integration, payment-logging, stripe-config/paypal-config}` の3種を持つが、これは
  **意図的に違反にしない**(限度を超えさせない)。設定情報(`stripe-config`)は各ゲートウェイに残る
  正当な3つ目の責務であり、本ステージの狙い(行数の分割・実装関係の宣言・依存本数の不変性)とは
  無関係なので、責務数のトリミングは求めない(上級3が `dependencyLimit` の数値をコメント付きで
  説明したのと同じやり方)。
- `changeRequests`(旧仕様書と同じ2件、責務は初期のコードに存在する):
  - `req-payment-logging`: `responsibility: 'payment-logging'`、「決済ログに失敗時のリトライ回数を残したい」、`linesPerSite: 6`
  - `req-gateway-integration`: `responsibility: 'gateway-integration'`、「決済API呼び出しに共通のタイムアウト設定を追加したい」、`linesPerSite: 5`
  - 初期状態はどちらも `chargeStripe`/`chargePaypal` という**行数超過している同じメソッド**に
    無関係な責務が同居しているため、`entangled`(5点×2)と `limit-break`(10点×2)の両方が発生し
    (`shotgun` 10点と合わせて `scoreChange` は100→60)、模範解答適用後は
    Extract Method で責務ごとにメソッドが分かれるため `entangled`/`limit-break` がどちらも0になり
    `scoreChange` は60→90に改善する(`classesTouched` はどちらも2→2のまま、悪化しない)。

## 模範解答(`sampleAnswerSteps['advanced-payment-gateway-interface']`)

```ts
[
  { extract: { from: 'charge', fromClass: 'StripeGateway', fragmentIds: ['frag-log-payment-stripe'], name: 'logStripePayment' } },
  { extract: { from: 'charge', fromClass: 'PaypalGateway', fragmentIds: ['frag-log-payment-paypal'], name: 'logPaypalPayment' } },
  { setSuperclass: { class: 'StripeGateway', superclass: 'PaymentGateway', kind: 'implements' } },
  { setSuperclass: { class: 'PaypalGateway', superclass: 'PaymentGateway', kind: 'implements' } },
]
```

Extract Method 2回で、`StripeGateway.charge`/`PaypalGateway.charge` それぞれの中に同居していた
「決済APIを呼び出す」(`gateway-integration`)と「決済ログを記録する」(`payment-logging`)が
別々のメソッドに分かれ、行数上限違反が解消する(**どちらのメソッドも `StripeGateway`/`PaypalGateway`
自身に残ったまま**で、`PaymentGateway` へは何も移動しない。旧設計の問題の直接の修正点)。
Set Superclass(`kind: 'implements'`)2回で、`StripeGateway`・`PaypalGateway` が `PaymentGateway` を
実装したと宣言する(採点には影響しないが、キャンバス上に実装の矢印を引き、ステージの狙いを目視確認
できるようにする、旧仕様書と同じ扱い)。

`StripeGateway`/`PaypalGateway` とも、API呼び出し側のメソッド名を最初から `charge`(`PaymentGateway.charge`
と同じ名前)にしているため、模範解答を適用した後のクラス図は `PaymentGateway` に `+ charge()`、
`StripeGateway`・`PaypalGateway` にもそれぞれ `+ charge()` が並ぶ、教科書のインターフェース実現(UML)に
近い見た目になる(詳細は次節「模範解答DSLの拡張」)。

この手順を適用しても `classDependencies` 上の `PaymentService` の依存は
**引き続き `PaymentGateway` の1本だけ**(`StripeGateway`/`PaypalGateway` の中身がどう変わっても、
実装が何個あっても変化しない)。これが本ステージの中心的な学びである。

## 模範解答DSLの拡張(`SolutionStep.extract.fromClass`)

`StripeGateway.charge` と `PaypalGateway.charge` が同じ名前を持つため、`sampleAnswer.ts` の
`methodIdByName`(名前だけでクラス横断的にメソッドを探す)がそのままでは2つ目の `extract` ステップで
どちらを指すか曖昧になる(`allClasses` の走査順で最初に見つかった方に誤って解決される)。

これは**模範解答を文字列で記述するための内部DSLだけの問題**であり、実際のプレイヤー操作
(`extractMethod(codebase, { sourceMethodId, ... })`)はUI側で選択された具体的な `sourceMethodId` を
直接渡すため、この曖昧さは一切発生しない。したがって修正は `src/domain/stage/sampleAnswer.ts` の中で閉じる。

- `SolutionStep` の `extract` バリアントに、任意項目 `fromClass?: string` を追加する。
- `methodIdByName` に第3引数 `ownerClassName?: string` を追加し、指定時はそのクラス名のメソッドだけに
  絞り込んでから名前で検索する。
- `applyStep` の `extract` 分岐で `step.extract.fromClass` を渡す。

既存の全ステージの `extract` ステップは `fromClass` を指定しないため、追加前と全く同じ(クラス横断の
名前検索)動作のまま。後方互換な追加のみで、他ステージのデータ・挙動には影響しない。

## TDD対象の純粋関数

**新しい純粋関数は無い**(ドメイン層・アプリケーション層のロジックは一切追加しないため)。
今回のTDD対象は「ステージ定義データが仕様通りの採点結果・依存構造になるか」であり、以下の順で進める
(Red→Green)。AAAパターンで書く。

1. `src/infrastructure/stages/advancedStages.test.ts` の `describe('advanced-payment-gateway-interface', ...)`
   を、先に失敗するテストに書き換える。
   - 正常系: 初期状態で `classDependencies(stage.codebase)` は要素数1で、その `from` が
     `class-payment-service`、`to` が `class-payment-gateway` である
     (`PaymentService` は最初から具象クラスへ直接依存していないことの確認)。
   - 正常系: 初期状態で `findSuperclass` は `StripeGateway`・`PaypalGateway` のどちらも `undefined`
     (実装関係はまだ宣言されていない)。
   - 正常系: 初期状態で `findClass(codebase, 'class-payment-gateway')?.methods` は `['charge']` のみ、
     その `fragments` は空配列(処理本体を持たない契約メソッドであることの確認)。
   - 正常系: 初期状態で `StripeGateway`・`PaypalGateway` とも、決済API呼び出し側のメソッド名が
     `PaymentGateway.charge` と同じ `'charge'` である(`findClass(codebase, 'class-stripe-gateway')?.methods`
     に `name === 'charge'` のメソッドが存在する。`PaypalGateway` も同様)。**UML風のインターフェース実現
     (契約と実装クラスでメソッド名が一致する)を表現できているかの確認。**
   - 正常系: 模範解答適用後、`findSuperclass(solved, 'class-stripe-gateway')?.name === 'PaymentGateway'`
     かつ `findClass(solved, 'class-stripe-gateway')?.superclassKind === 'implements'`
     (`PaypalGateway` も同様)。
   - 正常系: 模範解答適用後、`findClass(solved, 'class-stripe-gateway')?.methods` の名前一覧に
     `'charge'` と `'logStripePayment'` の**両方**が含まれる(`PaypalGateway` も同様に
     `'charge'`・`'logPaypalPayment'`)。**決済処理の実体が `PaymentGateway` へ吸収されず、
     実装クラス自身に残ることの確認(旧設計のバグの再発防止テスト)。**
   - 正常系: 模範解答適用後も `findClass(solved, 'class-payment-gateway')?.methods` は `['charge']` の
     ままで変わらず、`fragments` も空のまま(インターフェースへ処理が混入していないことの確認)。
   - 正常系: 模範解答適用後、`classDependencies(solved)` は要素数1で、`from` は `class-payment-service`、
     `to` は `class-payment-gateway` のまま変化しない(**実装クラスの中身が変わっても呼び出し元の
     依存本数が変わらない、という本物のDIの性質そのものの確認**)。
   - 異常系: なし(ステージ定義データの検証であり、`extractMethod`/`setSuperclass` 自体の異常系は
     各ドメイン関数のテストで既にカバーされているため)。
2. `advancedStages.ts` のステージ定義を上記「ステージ定義」節の通りに書き換え、`sampleAnswer.ts` の
   模範解答を上記「模範解答」節の通りに書き換えてテストを通す(Green)。
3. 既存の `stageCatalog.test.ts` の `describe.each` 共通チェックは変更不要で、新しい数値にも自動的に
   以下が適用される(この仕様書の「ステージ定義」節で事前に手計算済み)。
   - ID重複なし・説明文あり・80行以上のメソッドが1つ以上ある(`StripeGateway.charge` 94行)
   - `method(90) < class(250) < file(400)`
   - 初期状態は減点がある(`line-limit` 違反2件、`score.total === 80`)
   - 模範解答どおりに操作すると100点になる
   - 変更依頼が2件以上あり、どれも初期状態に変更箇所がある
   - 模範解答にすると変更依頼のコストが下がる(`changeReadiness`: 60→90)
   - 模範解答にしても `classesTouched` は初期状態より増えない(`[2, 2]` のまま)

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。
- `advancedStages.test.ts` に書き換えた `describe('advanced-payment-gateway-interface', ...)` の
  全アサーションが通る(特に「決済処理の実体が実装クラス自身に残る」「呼び出し元の依存本数が
  実装内容によらず1のまま」の2点)。
- `stageCatalog.test.ts` の既存の `describe.each` が、書き換え後のステージ定義に対しても
  (テストファイル自体の変更なしに)全て緑になる。
- 既存の `advanced-notifier-hierarchy`(上級1)・`advanced-discount-strategy`(上級3)のID・タイトル・
  ステージ定義・模範解答・テストは一切変更しない。
- `src/domain/codebase/*`・`src/domain/scoring/*`・`src/domain/change/*`・`src/application/*`・
  `src/presentation/*` のいずれのファイルも変更されていないこと(diffで確認できる)。
- E2Eテスト(`e2e/`)の追加・変更は不要(新しいプレイヤー操作・新しいUIを追加しないため。
  既存の Extract Method・「実装するインターフェースを設定」操作は既存のE2Eで守られている)。

## 影響範囲

- **上級1(`advanced-notifier-hierarchy`)・上級3(`advanced-discount-strategy`)への影響: なし。**
  両ステージのデータ・模範解答・テストには一切触れない。ドメイン層・アプリケーション層のコードを
  変更しないため、両ステージの採点結果(`scoreCodebase`/`scoreChange`)も変わらない。
- **`stageCatalog.test.ts` への影響: なし(テストファイル自体は変更しない)。** ステージデータの数値を
  この仕様書の通りに設定すれば、既存の `describe.each` 共通チェックは自動的に緑になる。
- **`sampleAnswer.test.ts` への影響: なし。** 同ファイルは汎用フィクスチャ(`twoClassCodebase`)を
  使ったテストのみで、`advanced-payment-gateway-interface` の具体的なステップ内容に依存していない。
- **E2E(`e2e/refactor.spec.ts`)への影響: なし。** ステージのタイトル文言("上級2: ...")・IDを
  変更しないため、既存のステージ選択に関するE2Eがあれば引き続き通る(現状、上級2を名指しするE2Eは無い)。
- **プレゼンテーション層への影響: なし。** `ClassNode.tsx`・`CanvasContextMenu.tsx` は上級2用に
  何も変更しない(上級2作り直し前から存在する「実装するインターフェースを設定」UIをそのまま使う)。

## スコープ外

- **新しいドメイン概念(`Method.isAbstract` などの明示フィールド)の追加。** 上記「検討した設計の選択肢」
  の通り、`DiscountStrategy` と同じ「`fragments: []` の空メソッド」という既存の規約で十分に表現できる
  ため見送る。将来、「抽象メソッドは Move/Extract できないようにする」といった**整合性の強制**が
  欲しくなったら、そのときに改めて仕様化する。
- **具象メソッドから契約メソッドへのリンク(`abstractMethodId` 等)の追加。** 依存計算にもスコアリングにも
  使われないため見送る。「この実装はどの契約を満たすか」をUIでジャンプ表示したくなったら検討する。
- **`Fragment.uses` の書き換え操作(Extract Interface)の新設。** 旧仕様書・上級3仕様書から続く既知の
  却下理由に加え、今回の検証で「2つの実装のどちらかを選ぶコードは静的グラフ上のどこかに必ず存在する」
  という制約自体はこの操作があっても解消しないと分かったため、あらためて見送る。
- **設定情報(`stripe-config`/`paypal-config`)を別クラスへ切り出して責務数を減らすこと。** 本ステージの
  狙い(行数分割・実装関係の宣言・依存本数の不変性)とは無関係な作業が増えるだけなので、
  `responsibilityLimit: 3` として最初から違反にしない設計を選んだ(詳細は「ステージ定義」節)。
- **DIコンテナ配線・実行時のインスタンス差し替えのシミュレーション。** このドメインモデルには
  「インスタンス化」「実行時バインディング」の概念が無く、表現できない(旧仕様書・上級3仕様書と同じ
  既知の制約)。
- **「3つ目のゲートウェイ実装を追加しても依存本数が変わらない」ことをゲーム内でプレイヤーに
  操作させること。** 今回はステージ固有テスト(`classDependencies` が実装内容によらず1本のまま)で
  静的に確認するにとどめ、変更依頼(`changeRequests`)としては追加しない(既存の2件で
  `changeReadiness` の改善は十分示せるため)。

## 未決事項

- 設定情報(`stripe-config`)が最後まで「3つ目の責務」として残り続けることに、プレイヤーが
  「直し忘れた」と誤解しないか(`goal` 文言だけで十分伝わるか)はプレイテストで確認したい。
- 将来、別の上級ステージで「抽象メソッドをうっかり Move/Extract できてしまう」ことが実際に問題になったら、
  `Method.isAbstract` の追加(スコープ外で却下した案)を再検討する。
