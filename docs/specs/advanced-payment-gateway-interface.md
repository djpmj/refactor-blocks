# 上級2: インターフェース越しの依存(決済ゲートウェイ)ステージ

## 背景・目的

`superclassId` による継承(extends)ステージ(`advanced-notifier-hierarchy`)はすでにある。次はプレイヤーが
「インターフェース(implements)」「依存性注入(DIP: 具象クラスに直接依存する代わりに抽象に依存する)」を
体験できる上級ステージを追加したい。

このゲームのクラス間依存は `Fragment.uses`(処理が呼ぶメソッドID)から `classDependencies` が動的に計算する
(呼ばれたメソッドを**今**所有しているクラス**が依存先になる)。プレイヤーが `uses` の中身そのものを書き換える
操作は存在せず、依存の向きを変えられるのは既存の **Move Method**(メソッドの所有クラスを変える)だけである。
この制約により、「呼び出し側のコードは変えずに、具象メソッドの実体だけがどのクラスに属するかを動かす」という
形でしか依存の付け替えを表現できない。したがって、本ステージは実務のDI(コンストラクタ注入で実行時に実装を
差し替える)そのものはシミュレートしない。「クライアントが複数の具象クラスを直接名指しして呼んでいる状態から、
共通の窓口となる1クラス(インターフェース役)だけに依存する状態へ変える」という**構造上の練習**に絞る。
この割り切りは、既存の継承ステージの `NotifierBase` が実際には共通処理の実装を持つ「純粋なインターフェースでは
ない抽象クラス」であるのと同じ性質の簡略化であり、本リポジトリの前例と一貫している。

## 新しいドメイン概念を追加するか(結論: 追加しない)

検討した設計は次の3つ。

1. **`CodeClass` に `interfaceId`(や `implements` の配列)を新設し、`setInterface.ts` を `setSuperclass.ts` の
   複製として作る。** → 不採用。`superclassId`/`setSuperclass`/`findSuperclass`/`inheritanceEdges` は
   「名前で指定する単一の親を持ち、循環・自己参照を防ぐ」という挙動がそのまま使い回せる。しかも現在の採点
   (`scoreCodebase`)は継承関係を一切見ておらず(`advancedStages.test.ts` のコメントの通り)、`superclassId` は
   採点に効かない「矢印を引くための宣言的なメタデータ + ステージ固有テストでの確認用」でしかない。新しい型を
   足しても採点ロジックには何も影響しない一方、`setSuperclass.ts` とほぼ同じコードが2つ生まれる
   (ponytailの階段2「このリポジトリにもうあるか」で `superclassId` が既にある、で止まる)。
2. **`Fragment.uses` を書き換えられる新しい「呼び出し先を付け替える」操作(Extract Interfaceに相当)を作る。**
   → 不採用。これができれば「具象メソッドの実装はそのままに、呼び出し元だけ抽象のスタブメソッドを指すように
   変える」という教科書通りのDIPを表現できるが、既存のどの操作(Extract Method/Move Method/Add Class/
   Set Superclass)を組み合わせても `uses` の中身は変わらない。新規に「呼び出し先ID書き換え」という
   プレイヤー操作・UI・E2Eテストをまるごと1つ作ることになり、1ステージのためだけに追加するには重すぎる
   (YAGNI: 他のどのステージにも今のところ使い道がない)。将来複数ステージで欲しくなったら改めて検討する。
3. **既存の `superclassId`/`setSuperclass`/`inheritanceEdges` をそのまま「実装(implements)」の表現にも流用し、
   依存の付け替えは Move Method だけで表現する。** → **採用**。新しい型・新しい操作を一切追加せずに、
   「クライアントが複数の具象クラスに直接依存している(結合度違反)→ 共通クラスへ集約して依存を1つにする
   (Move Method)→ その共通クラスを実装先として宣言する(Set Superclass の流用)」という一連の流れを
   既存のドメイン操作だけで組み立てられる。

**結論: ドメイン層・アプリケーション層のコードは一切変更しない。新規に書くのは「ステージ定義データ」
(`advancedStages.ts` への追加)と、模範解答(`sampleAnswer.ts`)、ステージ固有の確認テストのみ。**

## 変更対象ファイル一覧

### 新規

- なし(既存ファイルへの追記のみ)

### 変更

| パス | 役割 | 層 |
|---|---|---|
| `src/domain/codebase/Codebase.ts` | `CodeClass` に `superclassKind?: 'extends' \| 'implements'` を追加 | domain |
| `src/domain/codebase/setSuperclass.ts` | 第4引数 `kind` を追加し、`superclassId` と同時に設定・解除する | domain |
| `src/domain/codebase/setSuperclass.test.ts` | `kind` の設定・解除・省略時デフォルトのテストを追加(TDDで先に書く) | domain(テスト) |
| `src/application/RefactorUseCases.ts` | `setSuperclassUseCase` に `kind` を追加(省略可) | application |
| `src/application/RefactorUseCases.test.ts` | `kind` 付き呼び出しのテストを追加 | application(テスト) |
| `src/presentation/store/useGameStore.ts` | `setSuperclass` アクションに `kind` を追加(省略可) | presentation |
| `src/presentation/canvas/ClassNode.tsx` | `ClassNameLabel` が `superclassKind` に応じて `extends`/`implements` を出し分ける | presentation |
| `src/presentation/canvas/CanvasContextMenu.tsx` | 「実装するインターフェースを設定」メニュー項目を追加 | presentation |
| `src/domain/stage/sampleAnswer.ts` | `SolutionStep` の `setSuperclass` に任意の `kind` を追加、新ステージの模範解答を追加 | domain |
| `src/domain/stage/sampleAnswer.test.ts` | `kind: 'implements'` を指定したステップのテストを追加 | domain(テスト) |
| `src/infrastructure/stages/advancedStages.ts` | 新ステージ `advanced-payment-gateway-interface` を `advancedStages` 配列に追加する | infrastructure |
| `src/infrastructure/stages/advancedStages.test.ts` | 新ステージの実装関係(`superclassId`/`superclassKind: 'implements'`)とメソッド集約を確認する `describe` ブロックを追加する | infrastructure(テスト) |
| `e2e/refactor.spec.ts` | 「実装するインターフェースを設定」で `implements` 表示になることを確認するE2Eを追加 | E2E |

`dependencies.ts`・`src/domain/scoring/*`・`src/presentation/canvas/layoutCodebase.ts`・`src/index.css` は変更しない
(矢印の見た目・採点は継承と共通のまま)。

## データ/型の変更

なし。`CodeClass.superclassId` をそのまま「継承元」にも「実装先インターフェース」にも使う。

## ステージ定義(具体的なシナリオ)

題材: ネットショップの決済。`PaymentService` が Stripe 用・PayPal 用の決済クラスを**名指しで直接**呼んでいる
(具象クラスへの直接依存 = DIP違反)。空の `PaymentGateway` クラス(インターフェース役)は用意されているが、
まだ誰にも使われていない(`NotifierBase` と同じ見せ方)。

```
files:
  src/payment/PaymentService.ts
    class PaymentService
      method checkout (public)
        frag-validate-payment   "注文内容とカード情報を検証する"        lines:60 responsibility:validation
        frag-dispatch-stripe    "Stripe決済ゲートウェイを直接呼び出す"   lines:12 responsibility:gateway-dispatch uses:[method-charge-stripe]
        frag-dispatch-paypal    "PayPal決済ゲートウェイを直接呼び出す"  lines:12 responsibility:gateway-dispatch uses:[method-charge-paypal]

  src/payment/StripeGateway.ts
    class StripeGateway
      method chargeStripe (public, id: method-charge-stripe)
        frag-stripe-api-call    "Stripe APIを呼び出して決済する"        lines:30 responsibility:gateway-integration
        frag-log-payment-stripe "決済ログを記録する(Stripe)"           lines:16 responsibility:payment-logging
      method configureStripeCredentials (public, id: method-configure-stripe)
        frag-configure-stripe   "Stripe APIキーを設定する"              lines:14 responsibility:stripe-config

  src/payment/PaypalGateway.ts
    class PaypalGateway
      method chargePaypal (public, id: method-charge-paypal)
        frag-paypal-api-call    "PayPal APIを呼び出して決済する"        lines:28 responsibility:gateway-integration
        frag-log-payment-paypal "決済ログを記録する(PayPal)"           lines:16 responsibility:payment-logging
      method configurePaypalCredentials (public, id: method-configure-paypal)
        frag-configure-paypal   "PayPal APIキーを設定する"              lines:14 responsibility:paypal-config

  src/payment/PaymentGateway.ts
    class PaymentGateway
      (methods: 空。NotifierBase と同じ役割)
```

- `limits`: `{ method: 90, class: 250, file: 400 }`(`checkout` は60+12+12+overhead2=86行で
  「80行以上のメソッドが1つ以上ある」という `stageCatalog.test.ts` の共通チェックを満たす。この行数は
  `checkout` 自身では手を入れないため、method上限はこれを超えない値にする)
- `dependencyLimit`: `1`(初期状態は `PaymentService → StripeGateway, PaypalGateway` の2依存で違反、
  模範解答適用後は `PaymentService → PaymentGateway` の1依存になり解消)
- `responsibilityLimit`: `2`(初期状態は `StripeGateway`/`PaypalGateway` がそれぞれ
  `{gateway-integration, payment-logging, stripe-config/paypal-config}` の3種で違反。模範解答適用後は
  `chargeStripe`/`chargePaypal` が `PaymentGateway` へ移り、`StripeGateway`/`PaypalGateway` には
  1種類(config)だけが残る)
- `changeRequests`(2件、`beginner`/`advanced-notifier-hierarchy` と同じ「重複した責務を改修する」形):
  - `req-payment-logging`: `responsibility: 'payment-logging'`、「決済ログに失敗時のリトライ回数を残したい」、`linesPerSite: 6`
  - `req-gateway-integration`: `responsibility: 'gateway-integration'`、「決済API呼び出しに共通のタイムアウト設定を追加したい」、`linesPerSite: 5`
  - 初期状態はどちらも `StripeGateway`・`PaypalGateway` の2クラスにまたがる(shotgun surgery)。模範解答適用後は
    両方とも `PaymentGateway` 1クラスに集約されるため、`classesTouched` が2→1に減り、`scoreChange` の
    `shotgun` 減点が消える(＝変更依頼のコストが下がることを、新しい採点ルールなしで既存の仕組みだけで示せる)。

### 模範解答(`sampleAnswerSteps['advanced-payment-gateway-interface']`)

```ts
[
  { move: { method: 'chargeStripe', toClass: 'PaymentGateway' } },
  { move: { method: 'chargePaypal', toClass: 'PaymentGateway' } },
  { setSuperclass: { class: 'StripeGateway', superclass: 'PaymentGateway' } },
  { setSuperclass: { class: 'PaypalGateway', superclass: 'PaymentGateway' } },
]
```

Move Method 2回で `PaymentService` の依存先が `StripeGateway`/`PaypalGateway` から `PaymentGateway` 1つに
自動で変わる(`classDependencies` はメソッドの所有クラスを動的に見るため、コード上どこにも手を入れずに
依存の矢印が付け替わる)。Set Superclass(実装関係の宣言、既存UIの「継承元を設定」をそのまま使う)は
採点には影響しないが、キャンバス上に `PaymentGateway` への矢印(`inheritanceEdges`、既存の
`edge--inheritance` スタイルをそのまま使う)を引き、ステージの「狙い」を目視確認できるようにする。

## プレゼンテーション層(2026-09-22 追記: ユーザーから「implementsの場合はimplementsと表示してほしい」との要望を受け、方針変更)

上記の「未決事項」で保留していた `relationKind` を、最小の形で追加する。矢印の見た目(実線・アクセント色)は
変えない(そこまでは要望されていない)。表示テキストのみ `extends`/`implements` を出し分ける。

- **ドメイン層**: `CodeClass` に `superclassKind?: 'extends' | 'implements'` を追加する(`superclassId` と対になる、
  省略時は `'extends'` 扱い)。`setSuperclass(codebase, classId, superclassName, kind: 'extends' | 'implements' = 'extends')`
  のように第4引数を追加し、`superclassId` と同時に `superclassKind` を設定・解除する。
  既存の呼び出し元(`sampleAnswer.ts` の `SolutionStep`、`RefactorUseCases.ts` の `setSuperclassUseCase`、
  `useGameStore.ts` の `setSuperclass` アクション)は `kind` 引数を省略でき、省略時は今まで通り `'extends'` になる
  ので後方互換。
- **プレゼンテーション層**: `ClassNode.tsx` の `ClassNameLabel` が `superclassId` の代わりに `superclassKind` も見て、
  `" extends 親クラス名"` か `" implements 親クラス名"` を出し分ける。
  `CanvasContextMenu.tsx` に新しいメニュー項目「実装するインターフェースを設定」(モード `setInterface`)を、
  既存の「継承元を設定」(モード `setSuperclass`)と並べて追加する。どちらも同じ `NameForm` を使い回し、
  送信時に渡す `kind` だけが `'extends'`/`'implements'` で異なる(同じ `superclassId` を編集する2つの入口)。
  新しいUIコンポーネント・矢印スタイルは追加しない。
- 本ステージでは `sampleAnswerSteps` の `setSuperclass` ステップに `kind: 'implements'` を指定する。

## TDD対象の純粋関数

**新しい純粋関数は無い**(ドメイン層・アプリケーション層のロジックは一切追加しないため)。
今回のTDD対象は「ステージ定義データが仕様通りの採点結果になるか」であり、以下の順で進める(Red→Green)。

1. `src/infrastructure/stages/advancedStages.test.ts` に、先に失敗するテストを書く。
   - 正常系: 初期状態では `StripeGateway`・`PaypalGateway` のどちらも `findSuperclass` が `undefined`。
   - 正常系: 模範解答適用後、`findSuperclass(solved, 'class-stripe-gateway')?.name === 'PaymentGateway'`
     かつ `findSuperclass(solved, 'class-paypal-gateway')?.name === 'PaymentGateway'`。
   - 正常系: 模範解答適用後、`findClass(solved, 'class-payment-gateway')` のメソッド名一覧が
     `['chargeStripe', 'chargePaypal']` になる(共通処理が1クラスに集まったことの確認。
     `advanced-notifier-hierarchy` の既存テストと同じ形)。
2. `advancedStages.ts` にステージ定義を追加し、`sampleAnswer.ts` に模範解答を追加してテストを通す。
3. 既存の `stageCatalog.test.ts`(全ステージ共通の `describe.each`)は変更不要で、新ステージにも自動的に
   以下が適用される。これらも実質的に「新ステージの受け入れテスト」なので先に数値(行数・上限・
   `linesPerSite`など)をこのテストが通るように逆算してから `advancedStages.ts` を書くとよい。
   - ID重複なし・説明文あり・80行以上のメソッドが1つ以上・`method < class < file` の順
   - 初期状態は減点がある(`score.total < 100`)
   - 模範解答どおりに操作すると100点になる
   - 変更依頼が2件以上あり、どれも初期状態に変更箇所がある
   - 模範解答にすると変更依頼のコストが下がる(`changeReadiness` が上がる)
   - 模範解答にしても `classesTouched` は初期状態より増えない

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。
- `src/infrastructure/stages/stageCatalog.ts` 経由で新ステージ `advanced-payment-gateway-interface` が
  `stages`(`level: 'advanced'`)に含まれる。
- `advancedStages.test.ts` に追加した、実装関係(`superclassId`)とメソッド集約を確認するテストが通る。
- `stageCatalog.test.ts` の既存の `describe.each` が新ステージに対しても(コードの変更なしに)全て緑になる。
- 既存の `advanced-notifier-hierarchy` ステージのID・タイトル・挙動は変更しない
  (`e2e/refactor.spec.ts` の `上級1: ...` を `selectOption({ label: ... })` で選ぶテストが壊れないこと)。
- (推奨・必須ではない)`e2e/refactor.spec.ts` の826行目付近にある上級ステージE2E
  (「共通処理を基底クラスへ移してから継承元を設定すると、継承の矢印が引かれる」)と同じ形で、
  新ステージ用のE2Eを追加できるとなお良い。今回はMove Method・Set Superclassという既存操作の組み合わせ
  のみで新しいドラッグ&ドロップの挙動を増やしていないため、CLAUDE.mdの「D&D操作の変更には必ずE2E」の
  対象outsideとして必須にはしない。

## スコープ外

- 「実装(implements)」を表す新しい矢印スタイル(破線など)。表示テキストの出し分け(`superclassKind`)のみ行い、
  矢印の色・線種は継承と共通のままにする。
- `Fragment.uses` の呼び出し先を書き換える新しいプレイヤー操作(Extract Interfaceに相当するもの)。
  真のDIP(呼び出し元のコードは一切変えず、具象の実装はそのままに依存だけ抽象へ差し替える)を表現するには
  これが必要だが、他ステージでの使い道がまだ無いため今回は作らない。
- 複数インターフェースの同時実装(`implements A, B`)。今回のシナリオは実装先1つで足りる。
- 新しい採点ルール(例: `ScoreRule` に `'dip'` を足す)。既存の `coupling`(直接依存する具象クラス数)と
  `responsibility`・`shotgun`(変更依頼の散らばり)の組み合わせで、DIP違反を修正した効果を測定できるため
  不要と判断した。
- 実行時のインスタンス差し替え(コンストラクタ注入でStripe/PayPal実装を切り替える、DIコンテナなど)の
  シミュレーション。このドメインモデルには「インスタンス」「実行時バインディング」の概念が無く、
  表現できない。

## 未決事項

- 「継承元を設定」というUI文言のまま「実装(implements)」のステージに使うことについて、初見のプレイヤーが
  違和感を持たないか(ステージ本文の注記だけで十分伝わるか)はプレイテストで確認したい。もし混乱が大きい
  ようなら、`Stage` に任意の表示ラベル上書き(例: `relationLabel?: string`)を足すことを検討する
  (今回は追加しない)。
- 将来、真のDIP(呼び出し元を変えずに依存を抽象へ差し替える)を複数ステージで扱いたくなった場合、
  「Extract Interface」操作(具象メソッドをコピーしてスタブ化し、元の呼び出し元の`uses`だけ新IDに向け替える)
  をドメイン層に追加するかどうかは、そのとき改めて仕様化する。
