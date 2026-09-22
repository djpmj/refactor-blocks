# 上級3: if分岐をStrategyパターンへ組み替えるステージ

## 背景・目的

CLAUDE.mdの「最終的に保守しやすい形やデザインパターンへ組み替える」を具体化する上級ステージとして、
`advanced-notifier-hierarchy`(上級1: extends)・`advanced-payment-gateway-interface`(上級2: implements/DI)
に続き、if分岐で処理を切り替えている箇所をStrategyパターン(条件分岐を、共通インターフェースを実装する
複数クラスへの置き換え)へ組み替える練習ができる上級3ステージを追加する。

## Strategy/Factory/Observerのうちどれを作るか(結論: Strategyのみ。Factory/Observerは今回作らない)

このゲームのドメインモデルには「if分岐」「実行時の切り替え」「インスタンス生成」「イベント通知/購読者リスト」
を表す概念が一切無い。`Fragment` はメソッド内の処理のまとまりをフラットに並べたものでしかなく、分岐・条件式・
インスタンス化・購読登録を表すデータは無い(`src/domain/codebase/Codebase.ts` を確認した)。
クラス間の依存は `Fragment.uses`(呼ぶメソッドID)から `classDependencies`(`src/domain/codebase/dependencies.ts`)
が「そのメソッドを**今**所有しているクラス」を動的に依存先として計算するだけで、`uses` の中身自体を書き換える
プレイヤー操作は存在しない(上級2の仕様書 `docs/specs/advanced-payment-gateway-interface.md` に明記された
既知の制約で、今回も変わらない)。

3パターンを検討した結果は次の通り。

1. **Strategy** → **採用**。教科書通りの「呼び出し元のコードを変えずに実行時に実装を切り替える」ことは
   表現できないが(下記「新しい学び」参照)、「分岐していた処理を、共通インターフェースを実装する複数の
   具象クラスへ分割する」という**構造上の練習**は、既存操作(Extract Method / Move Method / Add Class /
   Add File / Set Superclass)の組み合わせだけで表現できる。上級1・上級2がそれぞれ検証した技法
   (Extract+Move、Set Superclassのkind='implements'流用)を**同時に**使う、上級のまとめとして意味がある。
2. **Factory** → **不採用(将来必要になったら検討する)**。Factoryパターンの本質は「どの具象クラスを
   `new` するかを1箇所に閉じ込める」ことだが、このドメインモデルには「インスタンス化」という概念が
   そもそも存在しない(クラスはコードの入れ物であって、実行時のオブジェクトではない)。Strategyよりさらに
   表現の土台が無く、`Fragment` に「生成」を表す新しい種類を追加しない限り教材にできない。それは新しい
   ドメイン概念の追加そのものであり、YAGNI(このステージのためだけに追加する根拠が無い)。
3. **Observer** → **不採用(将来必要になったら検討する)**。Observerパターンの本質は「1対多の購読者リストへ
   通知する」ことだが、このドメインモデルは「1つのクラスが複数のクラスを呼ぶ」ことと「購読者リストを持つ」
   ことを区別できない(`classDependencies` は単なる呼び出し先の集合で、動的な登録・解除・複数件への
   ブロードキャストという概念が無い)。Observer専用に「リスト」「通知」という新しい型を足すのは、
   今回の要求(Strategy)にとって過剰であり、Factory同様に見送る。

**結論: 今回作るのはStrategyの1ステージのみ。新しいドメイン概念・新しい操作は一切追加しない
(上級2の判断をそのまま踏襲する)。**

## Strategy固有の新しい学び(上級1・2との違い)

上級1(extends)・上級2(implements)はどちらも「複数クラスに散らばった**同じ**処理を1つの共通クラスへ
Move Methodで集約する」形だった(`NotifierBase`・`PaymentGateway` という1つの受け皿にすべて移す)。
これは実務のStrategyパターンとは違い、「具象クラスが複数残る」というStrategyの本質(方針の数だけ実装が
存在し、後から4つ目の方針を追加してもインターフェースを実装する新しいクラスを1つ足すだけで済む=OCP)を
表現できていない。

本ステージは、上級1・2と違って**受け皿を1つに集約しない**。分岐していた3つの処理を、それぞれ**新しく
作る3つの別々のクラス**(`RegularDiscount`/`PremiumDiscount`/`VipDiscount`)へ Move Method し、
その3クラスすべてが共通の空クラス `DiscountStrategy`(上級1の `NotifierBase`・上級2の `PaymentGateway`
と同じ役割の「インターフェース役」)を実装(implements)する。これにより:

- 初級(`beginner-invoice-service`)で使った「Add File + Add Classで新しいクラスを作る」技法と、
  上級1で使った「Extract MethodしてからMove Methodする」技法と、上級2で使った「Set Superclassの
  kindをimplementsにする」技法を、初めて1つのステージの中で全部組み合わせる、上級のまとめの位置づけになる。
- 呼び出し元(`DiscountService`)は、上級2のように依存先が1つに減るわけではない(3つの具象クラスを
  それぞれ呼ぶことになるため、結合度=3のまま変わらない)。これは意図的な制約であり、「本当の実行時DI
  (呼び出し元が抽象型だけを知り、具体的にどの実装を使うかは外部で注入される)はこのドメインモデルでは
  表現できない」ことを`dependencyLimit`の設計(後述)で正直に示す。**この違いこそが「Strategyでは
  上級2のように結合度を1に減らせない」という、上級2の仕様書が未決事項として残した制約を体験させる部分**。
- 代わりに改善が測れるのは、責務(`responsibility`)混在の解消と、行数上限違反の解消、そして変更依頼の
  「巻き込み(entangled: 無関係な責務が同じメソッドに同居している)」「上限超え(limit-break)」の解消。
  上級1・2が「散らばり(shotgun: 複数クラスにまたがる)」の解消を教材にしたのに対し、本ステージは
  「1つの長いメソッドに複数の分岐処理が同居している(entangled)」の解消を教材にする、**採点上の
  新しい切り口**(既存の `ScoreRule`/`ChangeRule` に手を加えず、既存の `entangled`/`limit-break` を
  初めて主役にする)。

## 変更対象ファイル一覧

### 新規

なし。

### 変更

| パス | 役割 | 層 |
|---|---|---|
| `src/infrastructure/stages/advancedStages.ts` | 新ステージ `advanced-discount-strategy` を `advancedStages` 配列に追加する | infrastructure |
| `src/infrastructure/stages/advancedStages.test.ts` | 新ステージの実装関係(3クラスすべてが`DiscountStrategy`をimplements)・責務の分散を確認する `describe` ブロックを追加する | infrastructure(テスト) |
| `src/domain/stage/sampleAnswer.ts` | `sampleAnswerSteps['advanced-discount-strategy']` に模範解答を追加する | domain |

ドメイン層(`Codebase.ts`・`setSuperclass.ts`・`extractMethod.ts`・`moveMethod.ts`・`addClass.ts`・
`addFile.ts`)・アプリケーション層(`RefactorUseCases.ts`)・プレゼンテーション層(`ClassNode.tsx`・
`CanvasContextMenu.tsx`)は一切変更しない。上級2で追加した「実装するインターフェースを設定」UIと
`superclassKind` をそのまま再利用する。

## データ/型の変更

なし。

## ステージ定義(具体的なシナリオ)

題材: ネットショップの注文合計金額の計算。`DiscountService.calculateDiscount` が、会員ランク
(通常/プレミアム/VIP)によって割引の計算方法を切り替えている(if分岐に相当する3つの処理が、
1つのメソッドの中に埋め込まれている)。共通のインターフェース役 `DiscountStrategy`(空クラス)は
用意されているが、まだどのクラスとも実装関係で結ばれていない。ランクごとの計算クラス
(`RegularDiscount`/`PremiumDiscount`/`VipDiscount`)はまだ存在しない(初級ステージの
`InvoicePdfRenderer` 等と同じく、プレイヤーが作る)。

```
files:
  src/pricing/DiscountService.ts
    class DiscountService
      method calculateDiscount (public)
        frag-validate-order    "注文内容と会員ランクを検証する"                          lines:60 responsibility:validation        suggestedName:validateOrder
        frag-branch-regular    "会員ランクが「通常」なら、割引なしで合計する"              lines:14 responsibility:discount-regular  suggestedName:calculateRegularDiscount
        frag-branch-premium    "会員ランクが「プレミアム」なら、一律10%引きで合計する"     lines:16 responsibility:discount-premium  suggestedName:calculatePremiumDiscount
        frag-branch-vip        "会員ランクが「VIP」なら、送料無料込みで合計する"           lines:18 responsibility:discount-vip      suggestedName:calculateVipDiscount

  src/pricing/DiscountStrategy.ts
    class DiscountStrategy
      (methods: 空。NotifierBase・PaymentGateway と同じ役割)
```

- `limits`: `{ method: 90, class: 250, file: 400 }`
  - 初期状態の `calculateDiscount` は 60+14+16+18+overhead2=110行 → メソッド上限(90)違反。
    `stageCatalog.test.ts` の共通チェック(80行以上のメソッドが1つ以上)も満たす。
  - 模範解答適用後の `calculateDiscount` は 60(validate)+1+1+1(呼び出し行3本)+overhead2=65行 → 上限内。
- `dependencyLimit`: `3`。初期状態は `DiscountService` の外部依存が0(分岐処理はすべて自クラス内)なので
  違反なし。模範解答適用後は `DiscountService → RegularDiscount, PremiumDiscount, VipDiscount` の3依存に
  なる。上級2と違い、ここでは結合度の「数値としての改善」は狙わない
  (「新しい学び」の節で説明した意図的な制約)。`dependencyLimit` はこの3依存が違反にならない値にする
  だけであり、コメントでその理由を明記する。
- `responsibilityLimit`: `2`。初期状態は `DiscountService` が
  `{validation, discount-regular, discount-premium, discount-vip}` の4種を持ち違反。模範解答適用後は
  `DiscountService` は `{validation}`(呼び出し行の `call` は責務として数えない)の1種のみになり、
  `RegularDiscount`/`PremiumDiscount`/`VipDiscount` はそれぞれ1種類(自分の割引ロジック)だけになる。
- `changeRequests`(2件、初期状態でどちらも `calculateDiscount` 1メソッドに同居している=巻き込み
  (entangled)が発生する形。上級1・2の「散らばり(shotgun)」とは異なる切り口):
  - `req-premium-discount`: `responsibility: 'discount-premium'`、
    「プレミアム会員の割引率を12%に変えたい」、`linesPerSite: 5`
  - `req-vip-discount`: `responsibility: 'discount-vip'`、
    「VIP会員には送料無料に加えてポイント還元率も上げたい」、`linesPerSite: 6`
  - 初期状態はどちらも変更箇所(`calculateDiscount`)に無関係な責務(validationや他の会員ランクの分岐)が
    同居しているため `entangled` 減点が発生し、かつ `calculateDiscount` 自体が行数上限を超えているため
    `limit-break` 減点も発生する。模範解答適用後は、変更箇所がそれぞれ `PremiumDiscount`/`VipDiscount`
    という単一責務のメソッドになるため、`entangled`・`limit-break` がどちらも0になる
    (`classesTouched` は1→1のまま変わらないため `shotgun` は改善しない。「模範解答にしても変更が必要な
    クラス数は初期状態より増えない」という既存の共通チェックだけを満たせばよく、減らす必要はない)。

### 模範解答(`sampleAnswerSteps['advanced-discount-strategy']`)

```ts
[
  { extract: { from: 'calculateDiscount', fragmentIds: ['frag-branch-regular'], name: 'calculateRegularDiscount' } },
  { extract: { from: 'calculateDiscount', fragmentIds: ['frag-branch-premium'], name: 'calculatePremiumDiscount' } },
  { extract: { from: 'calculateDiscount', fragmentIds: ['frag-branch-vip'], name: 'calculateVipDiscount' } },
  { addFile: 'src/pricing/RegularDiscount.ts' },
  { addFile: 'src/pricing/PremiumDiscount.ts' },
  { addFile: 'src/pricing/VipDiscount.ts' },
  { addClass: { name: 'RegularDiscount', file: 'src/pricing/RegularDiscount.ts' } },
  { addClass: { name: 'PremiumDiscount', file: 'src/pricing/PremiumDiscount.ts' } },
  { addClass: { name: 'VipDiscount', file: 'src/pricing/VipDiscount.ts' } },
  { move: { method: 'calculateRegularDiscount', toClass: 'RegularDiscount' } },
  { move: { method: 'calculatePremiumDiscount', toClass: 'PremiumDiscount' } },
  { move: { method: 'calculateVipDiscount', toClass: 'VipDiscount' } },
  { setSuperclass: { class: 'RegularDiscount', superclass: 'DiscountStrategy', kind: 'implements' } },
  { setSuperclass: { class: 'PremiumDiscount', superclass: 'DiscountStrategy', kind: 'implements' } },
  { setSuperclass: { class: 'VipDiscount', superclass: 'DiscountStrategy', kind: 'implements' } },
]
```

Extract Method 3回で、分岐していた処理がそれぞれ独立したprivateメソッドになる(この時点では
まだ `DiscountService` の中)。Add File + Add Class を3回ずつ行い、ランクごとの新しいクラスを作る
(初級ステージの `InvoicePdfRenderer` 等と同じ技法)。Move Method 3回で、抽出したメソッドをそれぞれの
新しいクラスへ移す。Set Superclass(kind: implements)を3回行い、3クラスすべてが `DiscountStrategy` を
実装するように宣言する(上級2の「実装するインターフェースを設定」UIをそのまま使う)。

## ドメイン層・プレゼンテーション層で変更が必要なファイルとその理由

**なし。** 既存の6つのドメイン操作(Extract Method・Move Method・Add File・Add Class・Move Class・
Set Superclass)と、既存の `superclassKind: 'implements'`・既存の「実装するインターフェースを設定」UIを
組み合わせるだけで本ステージの模範解答が成立するため、ドメイン層・アプリケーション層・プレゼンテーション層の
コードは一切変更しない。変更するのは `src/infrastructure/stages/advancedStages.ts`(ステージ定義データ)・
`src/domain/stage/sampleAnswer.ts`(模範解答データ)・そのテストのみ。

## TDD対象の純粋関数

**新しい純粋関数は無い**(上級2と同じ判断)。今回のTDD対象は「ステージ定義データが仕様通りの採点結果に
なるか」であり、以下の順で進める(Red→Green)。AAAパターンで書く。

1. `src/infrastructure/stages/advancedStages.test.ts` に、先に失敗するテストを書く。
   - 正常系: 初期状態では `RegularDiscount`/`PremiumDiscount`/`VipDiscount` に相当するクラスが存在しない
     (`allClasses(stage.codebase).map(c => c.name)` に含まれない)。
   - 正常系: 模範解答適用後、`findClass(solved, ...)` で見つかる `RegularDiscount`・`PremiumDiscount`・
     `VipDiscount` の3クラスすべてで `findSuperclass(solved, classId)?.name === 'DiscountStrategy'` かつ
     `superclassKind === 'implements'`。
   - 正常系: 模範解答適用後、`DiscountService` の `calculateDiscount` に残るのは検証処理と3本の呼び出し
     行だけで、`findClass(solved, 'class-discount-service')` に割引計算のFragmentが残っていない
     (`method.fragments` の `responsibility` に `discount-regular`/`discount-premium`/`discount-vip` が
     含まれない)。
   - 異常系は無し(ステージ定義データの検証であり、既存の `extractMethod`/`moveMethod`/`setSuperclass`
     自体の異常系は各ドメイン関数のテストで既にカバーされているため、ここでは重複させない)。
2. `advancedStages.ts` にステージ定義を追加し、`sampleAnswer.ts` に模範解答を追加してテストを通す。
3. 既存の `stageCatalog.test.ts`(全ステージ共通の `describe.each`)は変更不要で、新ステージにも自動的に
   以下が適用される。実装前に、上記「ステージ定義(具体的なシナリオ)」の数値がこれらを満たすことを
   手計算で確認してから `advancedStages.ts` を書く。
   - ID重複なし・説明文あり・80行以上のメソッドが1つ以上・`method < class < file` の順
   - 初期状態は減点がある(`score.total < 100`。line-limit 1件・responsibility 1件で80点になる想定)
   - 模範解答どおりに操作すると100点になる
   - 変更依頼が2件以上あり、どれも初期状態に変更箇所がある
   - 模範解答にすると変更依頼のコストが下がる(`entangled`・`limit-break` の解消により`changeReadiness`が上がる)
   - 模範解答にしても `classesTouched` は初期状態より増えない(1→1のまま)

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。
- `src/infrastructure/stages/stageCatalog.ts` 経由で新ステージ `advanced-discount-strategy` が
  `stages`(`level: 'advanced'`)に含まれる。
- `advancedStages.test.ts` に追加した、実装関係(3クラスの`superclassKind: 'implements'`)と
  責務の分散を確認するテストが通る。
- `stageCatalog.test.ts` の既存の `describe.each` が新ステージに対しても(コードの変更なしに)全て緑になる。
- 既存の `advanced-notifier-hierarchy`・`advanced-payment-gateway-interface` のID・タイトル・挙動は変更しない。
- E2Eテスト(`e2e/refactor.spec.ts`)の追加は必須にしない。本ステージは Extract Method・Move Method・
  Add File・Add Class・Set Superclass という、既存ステージですでにE2Eで守られているドラッグ&ドロップ・
  操作の組み合わせのみを使い、新しい操作・新しいUIを追加しないため(CLAUDE.mdの「D&D操作の変更には
  必ずE2E」の対象に該当しない)。

## スコープ外

- **Factoryパターンのステージ**。「インスタンス化」を表す概念がドメインモデルに無く、表現するには新しい
  `Fragment` の種類(生成を表すもの)を追加する必要があるため、今回はYAGNIで見送る。将来、生成の切り替えを
  複数ステージで教材にしたくなったら改めて仕様化する。
- **Observerパターンのステージ**。「1対多の購読者リストへの通知」を表す概念がドメインモデルに無く、単なる
  複数クラス呼び出しと区別できないため見送る。将来必要になったら改めて仕様化する。
- **結合度(coupling)を1に減らす表現**。呼び出し元(`DiscountService`)が抽象型だけを知り、実行時に
  どの具象Strategyを使うかを外部から注入される、という真のDIPはこのドメインモデルでは表現できない
  (`Fragment.uses` を書き換える操作が無いという上級2からの既知の制約)。`dependencyLimit` は3依存が
  違反にならない値に設定するにとどめ、無理に「1に減った」体裁を作らない。
- 新しい採点ルール(`ScoreRule`・`ChangeRule` への追加)。既存の `responsibility`・`line-limit`
  (`scoreCodebase`側)と `entangled`・`limit-break`(`scoreChange`側)の組み合わせで、分岐の解消効果を
  測定できるため不要と判断した。
- 4つ目以降の会員ランク(割引方針)の追加。「方針を1つ増やすだけで既存クラスに触らずに済む(OCP)」ことは
  仕様書の説明としては触れるが、実際にプレイヤーに4つ目を追加させる変更依頼は作らない(既存の
  `changeRequests` の形式で表現できる範囲を超えるため)。

## 未決事項

- ステージのタイトル・題材文言(「会員ランク別の割引」)がプレイヤーにとって「if分岐→Strategy」だと
  直感的に伝わるか(`description`/`goal` の文言だけで十分か)はプレイテストで確認したい。
- 上級1・2は「受け皿1つに集約」、本ステージは「受け皿3つに分散」という構造の違いが、ステージ選択画面の
  説明文だけでプレイヤーに伝わるか。伝わりにくいようなら、`goal` 文言に「NotifierBase/PaymentGatewayとは
  違い、今回は3つのクラスに分けたままにする」という一言を足すことを検討する(今回は追加しない)。
