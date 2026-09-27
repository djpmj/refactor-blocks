# 仕様草案: 初級3「何でも入った CommonUtils」を責務ごとのクラスとファイルへ分ける

- slug: `utils-class-split-stage`
- 元: `docs/pipeline/utils-class-split-stage/01-discovered.md`
- ステージID: `beginner-common-utils`

## 1. 背景・目的

- 初級は2件(初級1: 用意されたクラスへ移す/初級2: 「クラスを追加」して受け皿を作る)しかない。「ファイル分け」を練習できるのは
  中級2(`intermediate-god-file`)だけで、しかも private メソッドを持ち主へ返す話と組み合わさっている。初級2の模範解答も、新しいクラスを
  `InvoiceService.ts` に置いたまま100点になる。
- 新卒〜4年目がいちばんやりがちな「共通っぽい処理はとりあえず `CommonUtils` に置く」を題材に、**クラスを分けたらファイルも分ける**を
  初級のうちに1回通しで練習させる。
- 変更依頼の結果では、既存の初級にない**「呼ばれる側を分けると波及(`rippleClasses`)が減る」**を見せる。Utils を触ると Utils を呼んでいる
  全クラスが波及先になるが、責務ごとに分ければ、その責務を使っているクラスにしか波及しない(下の3.4で試算。4クラス → 2クラス)。

### 本当に新しい仕組みが要るか(ponytail)

- 要らない。ステージデータ1件と模範解答1件だけで作る。`domain`/`application` のロジック、採点ルール(`score.ts`・`RULE_LABEL`)、
  操作、UI、`SolutionStep` の種類は変更しない。使う操作(ファイルを追加・クラスを追加・Move Method・ファイル削除)と、模範解答のステップ
  (`addFile`・`addClass`・`move`・`deleteFile`、未決事項1のBなら `renameClass`・`renameFile`)は揃っている。
- 「ファイル分けが必須」は、新しいルールではなく**ファイルの行数上限**で作る(同じファイルにクラスを3つ並べても、ファイルの合計行数が上限を超えるようにする)。
- 変更依頼は2件(日付・金額)で足りる。入力チェックの依頼を3件目に足しても同じ形の結果が並ぶだけなので足さない。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 変更 | `src/infrastructure/stages/beginnerStages.ts` | infrastructure | 初級3のステージデータ `commonUtilsStage` を追加し、`beginnerStages` の**末尾**に並べる(中級1より前に出る) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps` に `'beginner-common-utils'` を追加。**`'beginner-invoice-service'` の直後**に置く(`template-method-stage`・`inline-method-stage` の追加位置と離して衝突を避ける) |
| 新規 | `src/infrastructure/stages/commonUtilsStage.test.ts` | infrastructure(test) | このステージ固有のテスト(4.1)。近道もここに書く |

- `stageCatalog.test.ts` は**変更しない**(全ステージ共通の制約はそのまま新ステージにも回る)。近道を共通の `shortcuts` 配列ではなく
  ステージ固有のテストに書くのは、`duplicate-code-scoring` なども同じ配列に追記する予定で、衝突しやすいため(中級8の `extractClassStage.test.ts` に前例あり)。
- `score.ts`・`describeSolutionStep.ts`・`comparisonQuizzes.ts`・`stageCatalog.ts`・`intermediateStages.ts`・`advancedStages.ts` は変更しない。

## 3. データ/型の変更

型・永続化スキーマの変更は無い。`Stage` を1件足すだけ。以下は推奨案(未決事項1〜3すべてA)の数値。

### 3.1 ステージの基本情報

| 項目 | 値 |
|---|---|
| `id` | `'beginner-common-utils'` |
| `level` | `'beginner'` |
| `title` | `'初級3: 何でも入った CommonUtils'` |
| `description` | 「注文・会員登録・売上レポート・問い合わせの4つのサービスが、"共通処理" として CommonUtils を呼んでいる。日付の整形・金額の計算・入力チェックが1クラス1ファイルに溜まっていて、日付の表示を変えるだけでも、日付を使っていないサービスまで影響を受ける。」 |
| `goal` | 「ファイルは120行・クラスは100行以内、1クラスの責務は1種類まで、依存先は2クラスまで。「ファイルを追加」して、責務ごとのクラスを別々のファイルに分けよう」 |
| `limits` | `{ method: 90, class: 100, file: 120 }` |
| `dependencyLimit` | `2` |
| `responsibilityLimit` | `1` |
| `visibilityEnforced` | 省略(false) |

### 3.2 初期のコードベース

呼び出しは中級2(`intermediate-god-file`)と同じ「呼び出し行」の形(`lines: 1`、`responsibility: 'call'`、`uses: [<メソッドID>]`)で書く。
ID は `<id>:call` の形に**しない**(`frag-...` にする。Extract Method の呼び出し行と区別し、Inline Method・`deleteFile` の自動インラインの対象にしない)。
全メソッド `visibility: 'public'`、フィールド・継承・`duplicateGroup` は無し。各処理には既存ステージと同じく `suggestedName` を付ける(値は実装者に任せる)。

**`src/common/CommonUtils.ts`**(`file-common-utils`)/ クラス `CommonUtils`(`class-common-utils`)

| メソッドID / 名前 | 処理ID | ラベル | 行 | responsibility |
|---|---|---|---|---|
| `method-format-date` / `formatDate` | `frag-format-date` | 日付を「2026/09/27」形式の文字列にする | 20 | `date-format` |
| `method-format-date-time` / `formatDateTime` | `frag-format-date-time` | 日時を「2026/09/27 14:05」形式の文字列にする | 18 | `date-format` |
| `method-calculate-tax-included` / `calculateTaxIncluded` | `frag-calculate-tax-included` | 税抜き金額から税込み金額を計算する | 22 | `price` |
| `method-round-yen` / `roundYen` | `frag-round-yen` | 1円未満の端数を切り捨てる | 16 | `price` |
| `method-is-valid-email` / `isValidEmail` | `frag-is-valid-email` | メールアドレスの形式をチェックする | 20 | `validation` |
| `method-is-valid-phone-number` / `isValidPhoneNumber` | `frag-is-valid-phone-number` | 電話番号の形式をチェックする | 18 | `validation` |

→ メソッド 22/20/24/18/22/20 行、クラス128行、ファイル128行。

**呼び出し元(4クラス、各1ファイル・1メソッド)**

`src/order/OrderService.ts`(`file-order-service`)/ `OrderService`(`class-order-service`)/ `placeOrder`(`method-place-order`)

| 処理ID | ラベル | 行 | responsibility | uses |
|---|---|---|---|---|
| `frag-order-call-email` | isValidEmail() を呼び出す | 1 | `call` | `method-is-valid-email` |
| `frag-build-order-lines` | カートの商品から注文明細を作る | 34 | `order` | |
| `frag-order-call-tax` | calculateTaxIncluded() を呼び出す | 1 | `call` | `method-calculate-tax-included` |
| `frag-order-call-round` | roundYen() を呼び出す | 1 | `call` | `method-round-yen` |
| `frag-decide-order-number` | 注文番号を採番して受付状態にする | 26 | `order` | |
| `frag-order-summary` | 注文確認画面に出す内容をまとめる | 20 | `order` | |

→ メソッド85行(**80行以上のメソッドはこれ**。上限90なので減点はない)、クラス87行。

`src/user/UserService.ts`(`file-user-service`)/ `UserService`(`class-user-service`)/ `registerUser`(`method-register-member`)

| 処理ID | ラベル | 行 | responsibility | uses |
|---|---|---|---|---|
| `frag-user-call-email` | isValidEmail() を呼び出す | 1 | `call` | `method-is-valid-email` |
| `frag-user-call-phone` | isValidPhoneNumber() を呼び出す | 1 | `call` | `method-is-valid-phone-number` |
| `frag-build-member` | 入力から会員情報を組み立てる | 28 | `user` | |
| `frag-user-call-date-time` | formatDateTime() を呼び出す | 1 | `call` | `method-format-date-time` |
| `frag-registration-result` | 登録完了画面に出す内容をまとめる | 14 | `user` | |

→ メソッド47行、クラス49行。

`src/report/SalesReportService.ts`(`file-sales-report-service`)/ `SalesReportService`(`class-sales-report-service`)/ `buildDailyReport`(`method-build-daily-report`)

| 処理ID | ラベル | 行 | responsibility | uses |
|---|---|---|---|---|
| `frag-aggregate-daily-sales` | 1日分の注文を商品ごとに集計する | 30 | `report` | |
| `frag-report-call-tax` | calculateTaxIncluded() を呼び出す | 1 | `call` | `method-calculate-tax-included` |
| `frag-report-call-date` | formatDate() を呼び出す | 1 | `call` | `method-format-date` |
| `frag-layout-report` | レポートの表を組み立てる | 24 | `report` | |

→ メソッド58行、クラス60行。

`src/inquiry/InquiryService.ts`(`file-inquiry-service`)/ `InquiryService`(`class-inquiry-service`)/ `receiveInquiry`(`method-receive-inquiry`)

| 処理ID | ラベル | 行 | responsibility | uses |
|---|---|---|---|---|
| `frag-inquiry-call-email` | isValidEmail() を呼び出す | 1 | `call` | `method-is-valid-email` |
| `frag-inquiry-call-phone` | isValidPhoneNumber() を呼び出す | 1 | `call` | `method-is-valid-phone-number` |
| `frag-build-inquiry-ticket` | 問い合わせ内容を受付票にまとめる | 26 | `inquiry` | |

→ メソッド30行、クラス32行。

- ファイルの並び順は `CommonUtils.ts` → `OrderService.ts` → `UserService.ts` → `SalesReportService.ts` → `InquiryService.ts`。
- メソッドIDは `method-register-user`(初級1)と重ならなくてもよい(ID の重複検査はステージ内だけ)が、読み違いを避けるため `method-register-member` にしている。
- **呼び出し元を4クラスにする理由:** 問い合わせ(入力チェックだけを使う)と注文(日付を使わない)があることで、日付の変更の波及が
  「4クラス → 2クラス」と半分になり、分けた効果が数字で見える。3クラスだと「3 → 2」で差が小さい。
- 依存先: 初期はどの呼び出し元も `CommonUtils` 1つ。分けた後は Order(金額・入力チェック)・User(入力チェック・日付)・Report(日付・金額)が2つ、
  Inquiry(入力チェック)が1つで、`dependencyLimit: 2` にちょうど収まる。

### 3.3 変更依頼(どちらも `kind` 省略 = modify)

| id | title | description | responsibility | linesPerSite | partName |
|---|---|---|---|---|---|
| `req-japanese-date` | 日付を「2026年9月27日」の形で表示して | 画面やレポートに出す日付・日時を、スラッシュ区切りから「年・月・日」の表記に変える。 | `date-format` | 4 | `formatJapaneseDate` |
| `req-reduced-tax` | 軽減税率(8%)に対応して | 食品は税率8%で税込み金額を計算し、端数の扱いも税率ごとに分ける。 | `price` | 6 | `applyReducedTaxRate` |

`partName` は初期コードのどのメソッド名とも重ならない(`stageCatalog.test.ts` の検査)。

### 3.4 試算(推奨案の模範解答で)

**採点(`scoreCodebase`)**

| 状態 | 減点 | 合計 |
|---|---|---|
| 初期 | `line-limit` 2件(`CommonUtils` クラス128 > 100、`CommonUtils.ts` 128 > 120)、`responsibility` 1件(`CommonUtils` が3種類) | 70点 |
| 模範解答後 | なし(`DateFormatter`・`PriceCalculator`・`InputValidator` は各44行・責務1種類、呼び出し元の依存先は最大2) | 100点 |

**変更依頼(`measureChange` → `scoreChange`)**

| 依頼 | 初期 | 模範解答後 |
|---|---|---|
| `req-japanese-date` | 触るクラス1、波及4(Order・User・Report・Inquiry)-20、上限超え2(クラス136・ファイル136)-20 → **60点** | 触るクラス1、波及2(User・Report)-10 → **90点** |
| `req-reduced-tax` | 触るクラス1、波及4 -20、上限超え2(クラス140・ファイル140)-20 → **60点** | 触るクラス1、波及2(Order・Report)-10 → **90点** |

- `stageCatalog.test.ts` の「変更容易性が上がる」(平均60 → 90)、「変更が必要なクラス数が増えない」(1 → 1)を満たす。
- 巻き込み(`mixedResponsibilities`)は、Utils の各メソッドが1責務なので初期から0。この題材は「巻き込み」ではなく「波及」と「上限超え」で差が出る。

### 3.5 模範解答(`sampleAnswerSteps['beginner-common-utils']`、未決事項1のA)

```ts
'beginner-common-utils': [
  { addFile: 'src/common/DateFormatter.ts' },
  { addFile: 'src/common/PriceCalculator.ts' },
  { addFile: 'src/common/InputValidator.ts' },
  { addClass: { name: 'DateFormatter', file: 'src/common/DateFormatter.ts' } },
  { addClass: { name: 'PriceCalculator', file: 'src/common/PriceCalculator.ts' } },
  { addClass: { name: 'InputValidator', file: 'src/common/InputValidator.ts' } },
  { move: { method: 'formatDate', toClass: 'DateFormatter' } },
  { move: { method: 'formatDateTime', toClass: 'DateFormatter' } },
  { move: { method: 'calculateTaxIncluded', toClass: 'PriceCalculator' } },
  { move: { method: 'roundYen', toClass: 'PriceCalculator' } },
  { move: { method: 'isValidEmail', toClass: 'InputValidator' } },
  { move: { method: 'isValidPhoneNumber', toClass: 'InputValidator' } },
  { deleteFile: 'src/common/CommonUtils.ts' },
],
```

- 最後の `deleteFile` は、空になった `CommonUtils` クラスごとファイルを消す(`deleteFile` はフィールドの無いクラスを含むファイルも消せる。
  `CommonUtils` には `<id>:call` の呼び出し元を持つメソッドが残っていないので自動インラインも起きない)。
- **Extract Method を使わない。** 模範解答後のコードに private メソッドと `<id>:call` の呼び出し行が1つも無い(下の3.6の理由)。
- クラス名・ファイルの置き場所はプレイヤーの自由(採点は名前やパスを見ない)。模範解答は `src/common/` の下にクラス名と同じファイル名で置く。

未決事項1をBにした場合の模範解答(10手):

```ts
'beginner-common-utils': [
  { addFile: 'src/common/PriceCalculator.ts' },
  { addFile: 'src/common/InputValidator.ts' },
  { addClass: { name: 'PriceCalculator', file: 'src/common/PriceCalculator.ts' } },
  { addClass: { name: 'InputValidator', file: 'src/common/InputValidator.ts' } },
  { move: { method: 'calculateTaxIncluded', toClass: 'PriceCalculator' } },
  { move: { method: 'roundYen', toClass: 'PriceCalculator' } },
  { move: { method: 'isValidEmail', toClass: 'InputValidator' } },
  { move: { method: 'isValidPhoneNumber', toClass: 'InputValidator' } },
  { renameClass: { name: 'CommonUtils', newName: 'DateFormatter' } },
  { renameFile: { path: 'src/common/CommonUtils.ts', newPath: 'src/common/DateFormatter.ts' } },
],
```

最終形の行数・依存・責務はAと同じなので、3.4の試算はどちらでも変わらない。

### 3.6 進行中パイプラインとの関係(どちらが先にマージされても模範解答が100点のまま)

- **`duplicate-code-scoring`**(`duplicateGroup` を数える `duplicate-code` を追加): このステージは `duplicateGroup` を1つも持たないので、初期・模範解答・近道のどれにも影響しない。
- **`inline-method-stage`**(「分けすぎ」の減点を追加予定。定義は未確定): このステージの模範解答後のコードは、
  - private メソッドが0個、Extract Method の呼び出し行(`<id>:call`)が0個(Inline Method で直せる形が1つも無い)
  - 分けた3クラスはどれも**メソッド2つ・44行**で、1メソッドだけ・数行だけのクラスは無い
  
  なので、「Inline Method で戻せるもの」(private かつ `<id>:call` の呼び出し元が1つ)を数える定義なら影響しない。`inlineMethod` は public を戻せない
  (`'not-private'`)ので、public メソッドを「分けすぎ」と数える定義はプレイヤーが直せない減点になり、そもそも採られない前提とする。
  それでも定義しだいで当たった場合は、`stageCatalog.test.ts` の「模範解答どおりに操作すると100点になる」が全ステージに回っているので、
  **後からマージする側のCIで必ず落ちて気づける**(このステージは `score.ts` を触らない)。
- **`template-method-stage`**(`dependencies.ts` で「親の抽象宣言経由の呼び出し」を依存から外す予定): このステージには継承も抽象宣言も無いので、依存の数え方は変わらない。
- `sampleAnswer.ts` への追加位置は `'beginner-invoice-service'` の直後。`template-method-stage` は `'advanced-...'` のキー、`inline-method-stage` は中級のキーを足す予定で、行が隣り合わない。

## 4. TDD対象の純粋関数

`domain`/`application` に新しい関数は作らない。代わりに、**ステージデータを書く前に** ステージ固有のテストを書き(Red)、データと模範解答を足して通す(Green)。

### 4.1 `src/infrastructure/stages/commonUtilsStage.test.ts`(AAA)

`extractClassStage.test.ts` と同じ形(`stages.find` で取り出し、`sampleAnswerSteps` を適用)。**点数の合計ではなく、ルールごとの件数と `rippleClasses` で固定する**
(他のパイプラインが新しい減点ルールを足しても、このテストが無関係に落ちないようにするため)。

1. 初期状態: `line-limit` が2件(`class-common-utils` と `file-common-utils`)、`responsibility` が1件、`coupling` が0件
2. 模範解答後: `scoreCodebase(...).total` が100(これは `stageCatalog.test.ts` と重なるが、題材の意図として明示する。不要なら省いてよい)
3. 波及: `req-japanese-date` の `rippleClasses` が、初期は `['class-order-service', 'class-user-service', 'class-sales-report-service', 'class-inquiry-service']`(順不同で比較)、
   模範解答後は `class-user-service`・`class-sales-report-service` の2つ
4. 波及: `req-reduced-tax` の `rippleClasses` が、初期は4クラス、模範解答後は `class-order-service`・`class-sales-report-service` の2つ
5. 変更依頼の点数: 初期 `[60, 60]`、模範解答後 `[90, 90]`(`scoreChange` の点数。`score.ts` とは独立)
6. 近道(それぞれ `scoreCodebase(...).total` が100未満。可能なら、効いているルールも確かめる):
   - (a) 「責務ごとに3クラスへ分けたが、ファイルは CommonUtils.ts のまま」: `PriceCalculator`・`InputValidator` を `src/common/CommonUtils.ts` に `addClass` → 金額・入力チェックの4メソッドを move →
     `renameClass` で `CommonUtils` → `DateFormatter`(ファイルはそのまま)。ファイル132行 > 120 の `line-limit` 1件だけで90点
   - (b) 「日付だけ別ファイルへ分け、金額と入力チェックは CommonUtils に残す」: `responsibility` 1件で90点
   - (c) 「Utils のメソッドを使う側のクラスへ全部移して CommonUtils.ts を消す」(`formatDate`→`SalesReportService`、`formatDateTime`・`isValidEmail`→`UserService`、
     `calculateTaxIncluded`・`roundYen`→`OrderService`、`isValidPhoneNumber`→`InquiryService`、`deleteFile`): 呼び出し元4クラスの `responsibility` と、`OrderService` の行数上限で減点
   - (d)(未決事項3がAのとき)「メソッド1つにつき1クラス・1ファイル(6つ)に分けて CommonUtils.ts を消す」: `OrderService`・`UserService` の依存先が3つになり `coupling` 2件で80点
   - 取りこぼし防止: 「3クラス3ファイルに分けたが、空になった CommonUtils を消さない」: `empty` 1件で90点

実装者は、近道の点数が上の見込みと違ったら、見込みを実測に合わせてテスト名を直し、PRの説明に書く(中級8の前例と同じ扱い)。

## 5. 受け入れ基準

1. ステージ選択で「初級2: クラスを自分で作る」の次、「中級1」の前に「初級3: 何でも入った CommonUtils」が出る
2. `stageCatalog.test.ts` の全ステージ共通のテストが、新ステージに対しても変更なしで通る(80行以上のメソッド・上限の大小・初期減点あり・模範解答で100点・
   変更依頼2件以上・partName・変更容易性が上がる・触るクラス数が増えない・IDの重複なし)
3. `commonUtilsStage.test.ts` の4.1のケースが通る(波及が4クラス → 2クラスに減ることを含む)
4. 行き詰まりヒント(`HintPanel`)で、模範解答の各手が既存の文言で表示される(`describeSolutionStep.ts` は変更しない)
5. `score.ts`・`stageCatalog.test.ts`・`intermediateStages.ts`・`advancedStages.ts` に差分が無い
6. `npm run check` が通る。E2E は未決事項5で決めたとおり(Aなら既存の `npm run test:e2e` がそのまま通ること)

## 6. スコープ外

- 採点ルール・操作・UI・`SolutionStep` の追加や変更
- 「分けすぎて依存が増える」を主題にした続編ステージ(未決事項3のAなら、この初級でも依存の上限で軽く止まる)
- 行き詰まりヒントの言い回しの調整(`deleteFile` のヒントは「空になったファイル …を削除しよう」。中身が空のクラスだけ残ったファイルにもそのまま使う)
- 設計くらべクイズ(`comparisonQuizzes.ts`)への追加
- 入力チェック(`validation`)の変更依頼・機能追加(`extend`)の依頼
- 名前(`CommonUtils` のまま等)やディレクトリ構成を採点すること
- 既存の初級1・2の数値や模範解答の見直し(初級2の模範解答が同じファイルのまま100点になる件も含む)

## 未決事項

### 未決事項1: 模範解答で CommonUtils をどう片付けるか

- 選択肢A(推奨): 3つの責務すべてを新しいクラス・ファイルへ移し、空になった `CommonUtils.ts` を削除する(13手)。「Utils という何でも置き場そのものを残さない」がはっきり伝わる。ヒントは既存の「空になったファイルを削除しよう」がそのまま使える
- 選択肢B: 日付の2メソッドを残し、`CommonUtils` を `DateFormatter` に、ファイルを `DateFormatter.ts` に名前変更する(10手)。手数が少なく「名前を責務に合わせる」も練習できるが、初級で名前変更の操作(右クリック)を初めて使うことになる

(どちらを選んでも採点は同じで、プレイヤーはどちらの解き方でも100点になる。行き詰まりヒントに出る手順だけが変わる)

### 未決事項2: 「80行以上のメソッドが1つ以上ある」をどう満たすか

- 選択肢A(推奨): 呼び出し元の `OrderService.placeOrder` を85行にし、メソッドの上限を90行にする(抽出は不要)。ステージの手数と論点を「クラス分け・ファイル分け」に絞れる。模範解答に private メソッドができないので、`inline-method-stage` の「分けすぎ」減点とも干渉しない
- 選択肢B: `CommonUtils` に日付と金額が混ざった80行超のメソッド(例: `formatPriceLabel`)を1つ置き、メソッドの上限を50行にして Extract Method も必須にする。初級1・2と同じく抽出も練習できるが、手数が増え、抽出で private メソッドと `<id>:call` ができるため、`inline-method-stage` の定義しだいで模範解答が減点される恐れが出る

### 未決事項3: 依存先の上限(`dependencyLimit`)をいくつにするか

- 選択肢A(推奨): 2。責務ごとに3つに分ければちょうど収まり、メソッド1つごとにクラスを作る「分けすぎ」は `OrderService`・`UserService` の依存先が3つになって減点される(近道(d))。goal に「依存先は2クラスまで」と書く
- 選択肢B: 3。分けすぎても減点されない。「分けすぎると依存が増える」は完全に中級以降の論点として残す。goal に依存の上限を書かなくてよい

### 未決事項4: `inline-method-stage` との順序の守り方

- 選択肢A(推奨): 3.6のとおり設計で避ける(Extract Method を使わない・private を作らない・分けた各クラスは2メソッド44行)。万一当たっても `stageCatalog.test.ts` の「模範解答で100点」が後からマージする側のCIで落ちるので、それを安全網にする。追加のテストは書かない
- 選択肢B: Aに加えて、`commonUtilsStage.test.ts` に「模範解答後に private メソッドと `<id>:call` の呼び出し行が無い」を固定するテストを足し、前提を明示する
- 選択肢C: このステージの実装を `inline-method-stage` のマージ後まで待ち、確定した定義で数値を確かめてから実装する

### 未決事項5: E2E を足すか

- 選択肢A(推奨): 足さない。新しい操作・UIは無く、ステージの並びと解けることは `stageCatalog.test.ts` と `commonUtilsStage.test.ts` で守られる。使う操作(ファイル追加・クラス追加・メソッドのドラッグ・ファイル削除)のE2Eは既存
- 選択肢B: ステージ選択欄で「初級3: 何でも入った CommonUtils」を選ぶと見出しと5つのファイルが表示される、という軽いE2Eを `e2e/refactor.spec.ts` に1件足す
