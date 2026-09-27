# 仕様草案: クラス・ファイルの削除で本物の処理が消えないようにする(削除で点が上がる抜け道・切り出したメソッドの取りこぼしを塞ぐ)

- slug: `delete-class-code-guard`
- 入力: `docs/pipeline/delete-class-code-guard/01-discovered.md`

## 1. 背景・目的

`deleteClass`(`src/domain/codebase/deleteClass.ts`)・`deleteFile`(`deleteFile.ts`)は、フィールドを持つクラスだけを `has-fields` で拒み、
それ以外は「切り出したメソッドを呼び出し元へ戻す(`inlineExtractedMethods`)」をしてから**クラスごと消す**。このため次の2つの問題がある。

1. **本物の処理を持つクラス・ファイルを消せてしまい、消すだけで点が上がる。** `classDependencies` は存在しないメソッドIDを無視するので、
   消したクラスへの依存・循環依存・結合度の減点が一緒に消える。`deleteMethod` は同じ抜け道を塞ぐため空実装だけに限っている(`deleteMethod.ts` 6〜9行目)のに、
   クラス・ファイル単位では素通りになっている。
2. **切り出したメソッドを呼び出し元へ戻せなかったとき、エラーにせずクラスごと消す(データ消失)。** `inlineMethod` は private しか戻さない
   (`inlineMethod.ts` 22行目 `not-private`)が、`inlineExtractedMethods` は失敗を `inlined.ok ? inlined.value : current` で黙って飛ばす(`deleteClass.ts` 17〜18行目)。
   呼び出し元も同じクラスにある切り出しメソッドは、呼び出し元ごと消える(`deleteClass.test.ts` 69〜85行目がこの挙動を固定している)。

「リファクタリングは処理を消さずに形を変える」はこのゲームの一番の前提なので、**消すと処理が失われるクラス・ファイルの削除は `Result` の `err` で拒む**。

### 調査で分かったこと

**抜け道の点数(手計算)。** 本セッションにはシェル実行の手段が無く、`npm test` での再現はできなかった。以下はコードを読んだ手計算で、
実装者は4章のテストを先に書いたとき(Red)に、`deleteFile` が今は `ok` を返してしまうこと(=抜け道が実在すること)を確かめる。

| ステージ | 操作 | 手計算の結果 |
|---|---|---|
| 中級1「循環依存を断ち切る」(`intermediateStages.ts` 8〜113行目) | 初期状態 | 60点(checkout 80行 > 50 で行数 -10、Order↔Customer の循環依存 2本 -20、Order の責務5種類 > 4 で -10。Order の依存先は Inventory・Customer の2つで上限2以内) |
| 同上 | `src/order/Order.ts` を「ファイルを削除」 | **100点**。残る Customer(getRank 18行・calculateOrderTotal 30行、責務2種類)・Inventory(20行)の `uses` は存在しないIDを指すだけになり、依存0本・循環0本。空の入れ物・未使用private・継承・フィールドの減点も無い |
| 上級2(`advanced-payment-gateway-interface`) | charge からログを2つ抽出 → `PaymentGateway.ts`(契約メソッド `charge` だけのインターフェース役)を削除 | 実装の宣言漏れ(`findUndeclaredImplementations`)は存在するインターフェース役しか見ないので、`addInterface` せずに約束違反が消える見込み(未検証) |
| 上級5(`advanced-collapse-hierarchy`) | 初期状態で `BaseExporter.ts` を削除 | CsvExporter の `superclassId` が宙に浮き、`lone-superclass`・循環依存の減点が消える見込み(未検証) |
| チュートリアル2 | `calculateTax` を抽出 → TaxCalculator へ移す → public にする → TaxCalculator を削除 | 消費税の処理が消え、placeOrder に「calculateTax() を呼び出す」行だけが残る(データ消失) |

**今の「中身のあるファイル・クラスを消す」使い方は、どれも本件の規則で拒まれない**(=変えずに通る)。

| 使っている場所 | 消す対象 | 消す時点の中身 |
|---|---|---|
| `sampleAnswer.ts` 249行目(中級3) | `TemplateEngine.ts` | renderTemplate を移し終えた空のクラス |
| `sampleAnswer.ts` 326行目(上級5) | `BaseExporter.ts` | prepareExport・escapeValue を移し終えた空のクラス |
| `stageCatalog.test.ts` 153〜162行目(上級6の近道) | `Trash.ts` | 空実装 `postMessage`(`stub: true`)だけのクラス |
| `stageCatalog.test.ts` 196〜210行目(中級6の近道) | `Subscription.ts` | フィールドを移し終えた `methods: []` のクラス |
| `e2e/refactor.spec.ts` 639〜664行目 | チュートリアル2の TaxCalculator(クラス・ファイル) | 初期状態で `methods: []` |
| `e2e/refactor.spec.ts` 666〜701行目 | 切り出した private の calculateTax だけを持つ TaxCalculator | 戻してから消すので、戻したあとは空 |
| `e2e/refactor.spec.ts` 1119〜1124行目 | 空になった `TemplateEngine.ts` | 空のクラス |
| `featureEnvyStage.test.ts` 82〜91行目 | 初期の Subscription(フィールドあり・メソッド0個) | `has-fields` のまま(判定順を `has-fields` 優先にするので変わらない) |
| `utils-class-split-stage`・`law-of-demeter-stage` の02(模範解答・近道) | `CommonUtils.ts`・`Address.ts` | どちらもメソッド・フィールドを移し終えた空のクラス |

**挙動が変わるので書き換えが要る既存テスト**(どれも本物の処理を持つクラスを消している):

- `deleteClass.test.ts` 69〜85行目「呼び出し元も削除対象の同じクラスにある場合は、戻さずそのまま消える」→ `has-code` を期待する形へ
- `deleteClass.test.ts` 115〜127行目「フィールドを移し終えたクラス(fieldsが空配列)は削除できる」→ placeOrder を持つ `class-order` を消しているので、`class-tax`(`methods: []`)に `fields: []` を付けて消す形へ
- `changePart.test.ts` 64〜78行目・`measurePlacement.test.ts` 76〜86・169〜182行目 → 5章(未決事項3のAの場合)

### 本当に新しい仕組みが要るか(ponytail)

- 階段の2段目(このリポジトリにもうある)で止まる。「消しても処理が失われない」= **`deleteMethod` で1つずつ消せるメソッド(`isStubMethod`)だけのクラス**、
  と定義すれば、既存の `isStubMethod`(`Codebase.ts` 120行目)と `Array.prototype.every` だけで判定できる(メソッド0個の空クラスも `every` で true)。
- 判定は「切り出したメソッドを戻した**あと**」のクラスに対して行う。戻せなかった切り出しメソッド(public・呼び出し元が同じクラス)は本物の処理として残るので、
  問題2は**同じ1つの判定で自然に拒まれる**。`inlineMethod` は変えない(`inline-method-stage` が private 限定を前提にしている)。
- 新しい依存・新しいUIは要らない。失敗は既存の `apply(result, describeDelete…Error)` の流れで alert に出る。
- 右クリックメニューで消せない項目を無効表示にする、は要らない(失敗メッセージで足りる。`CanvasContextMenu.tsx` を触る他の件のマージ後に必要なら足す)。

## 2. 変更対象ファイル一覧

| 区分 | パス | 層 | 役割・変更内容 |
|---|---|---|---|
| 変更 | `src/domain/codebase/deleteClass.ts` | domain | `DeleteClassError` に `'has-code'` を追加。`inlineExtractedMethods` の結果に対して「対象クラスのメソッドがすべて `isStubMethod`」を確かめ、満たさなければ `err('has-code')`。判定と戻しを1つの関数にまとめ、`deleteFile` からも使う(4.1) |
| 変更 | `src/domain/codebase/deleteFile.ts` | domain | `DeleteFileError` に `'has-code'` を追加。中の全クラスに4.1の関数を当て、1つでも処理が残れば `err('has-code')` |
| 変更 | `src/domain/codebase/deleteClass.test.ts` | domain(テスト) | 4.2のケースを先に追加。既存2件を書き換え(1章) |
| 変更 | `src/domain/codebase/deleteFile.test.ts` | domain(テスト) | 4.3のケースを先に追加 |
| 変更 | `src/application/RefactorUseCases.ts` | application | `DELETE_CLASS_ERROR_MESSAGES`・`DELETE_FILE_ERROR_MESSAGES` に `'has-code'` を1行ずつ追加(3.2) |
| 変更 | `src/application/RefactorUseCases.test.ts` | application(テスト) | 「エラーメッセージ」の網羅テスト(428〜446行目の配列と期待値)に2件追加 |
| 変更 | `src/domain/change/changePart.test.ts` | domain(テスト) | 64〜78行目の書き換え(未決事項3のAの場合。5章) |
| 変更 | `src/domain/change/measurePlacement.test.ts` | domain(テスト) | 76〜86行目の削除・169〜182行目の書き換え(未決事項3のAの場合。5章) |
| 新規 | `src/infrastructure/stages/deleteGuard.test.ts` | infrastructure(テスト) | 実ステージでの回帰テスト(4.4)。`stageCatalog.test.ts` は他の4件が触るので避ける。domain のテストから infrastructure のステージを import しない(依存の向きを守る) |
| 新規 | `e2e/delete-guard.spec.ts` | E2E | 右クリック削除が拒まれ、処理と点数が残ることを守る(4.5)。`e2e/refactor.spec.ts` には追記しない |

**読むだけ・変更しない**: `inlineMethod.ts`・`deleteMethod.ts`・`Codebase.ts`・`dependencies.ts`・`score.ts`・`tray.ts`(コメント「クラスごと削除した」は
今後届かない状態になるが、`findUnplacedParts` の判定自体は正しいのでそのまま)・`sampleAnswer.ts`・`stageCatalog.test.ts`・`useGameStore.ts`・
`CanvasContextMenu.tsx`・`describeSolutionStep.ts`・ステージ定義・`e2e/refactor.spec.ts`。

## 3. データ/型の変更

永続化スキーマ・ドメインモデル(`Codebase` の型)の変更は無い。エラーの Union type に1つずつ足すだけ。

### 3.1 型

```ts
// deleteClass.ts
export type DeleteClassError = 'class-not-found' | 'has-fields' | 'has-code';
// deleteFile.ts
export type DeleteFileError = 'file-not-found' | 'last-file' | 'has-fields' | 'has-code';
```

(未決事項2でBを選んだ場合は、`'has-code'` とは別に `'extracted-not-inlinable'` を両方に足す。)

判定の順番(既存テストの期待値を変えないため):

- `deleteClass`: `class-not-found` → `has-fields` → `has-code`
- `deleteFile`: `file-not-found` → `last-file` → `has-fields` → `has-code`

### 3.2 「消せるクラス」の定義(推奨案 = 未決事項1のA)

> 切り出したメソッド(呼び出し元が削除対象の**外**にあり、private のもの)を呼び出し元へ戻した**あと**、残ったメソッドがすべて空実装(`isStubMethod`)であるクラス。
> メソッドが0個のクラスを含む。

| クラスの中身(戻したあと) | 結果 | 理由 |
|---|---|---|
| メソッド0個 | 消せる | 何も失われない(今までどおり) |
| 空実装(`stub: true` の処理だけ)のメソッドだけ | 消せる | `deleteMethod` で1つずつ消せるものなので、まとめて消しても新しい抜け道にならない。上級6の近道「Trash.ts を消す」がそのまま通る |
| 本物の処理を持つメソッドが1つでもある | `has-code` | 問題1 |
| 戻せなかった切り出しメソッド(public にした・呼び出し元が同じクラス) | `has-code` | 問題2。戻したあとも本物の処理として残るので、上と同じ判定で拒まれる |
| 契約メソッド(`fragments: []`)がある(インターフェース役) | `has-code`(未決事項1のA) | 行数は失われないが、実装クラスの `interfaceIds` が宙に浮いて約束違反の減点が消える(上級2の見立て)。`deleteMethod` でも消せない(`not-stub`) |

`has-code` で拒んだときは、途中まで戻した Codebase を捨てて元のまま(純粋関数なので `err` を返すだけでよい)。

### 3.3 エラーの文言(推奨案 = 未決事項2のA)

`has-fields` の文言と同じ形にそろえる。

| Record | キー | 文言 |
|---|---|---|
| `DELETE_CLASS_ERROR_MESSAGES` | `'has-code'` | `処理が残っているクラスは削除できません。先にメソッドを別のクラスへ移してください` |
| `DELETE_FILE_ERROR_MESSAGES` | `'has-code'` | `処理が残っているクラスがあるファイルは削除できません。先にメソッドを別のクラスへ移してください` |

## 4. TDD対象の純粋関数

テストは AAA で書き、既存の `sampleCodebase()`・`extractMethod` を使う(`deleteClass.test.ts` の `extractedIntoOwnClass()` を再利用)。

### 4.1 判定と戻しをまとめる関数(`deleteClass.ts`)

今の `inlineExtractedMethods`(export 済み、`deleteFile.ts` だけが使う)を、判定込みの関数に置き換える。名前・引数は実装者に任せるが、形の目安:

```ts
/** 切り出したメソッドを呼び出し元へ戻したうえで、指定したクラスが空実装だけ(0個を含む)になるなら、その Codebase を返す。 */
export function inlineBeforeDelete(codebase: Codebase, classIds: readonly string[]): Result<Codebase, 'has-code'>
```

- `deleteClass` は `[classId]`、`deleteFile` はファイルの全クラスのIDを渡す(ファイル内の別クラスへ戻した処理も、そのクラスごと消えるので拒む)。
- 「呼び出し元が同じクラスにあるなら戻さない」の条件(`deleteClass.ts` 16行目)は、`deleteFile` では「削除対象のクラスのどれか」に広げてよい
  (どちらにしても戻した先が消えるので `has-code` になり、結果は同じ)。広げずに今の1クラス単位の reduce のままでもよい。
- この関数は `deleteClass`・`deleteFile` 経由でテストする(単独のテストは不要)。

### 4.2 `deleteClass`(`deleteClass.test.ts`)

正常系:

1. 空のクラス(`class-tax`、`methods: []`)は消える(既存)
2. **空実装だけのクラスは消える**: `class-tax` に `{ id: 'method-stub', name: 'stub', visibility: 'public', fragments: [{ ...fragment('f-stub', 2), stub: true }] }` を持たせて消す → `ok`、`class-tax` が無い
3. 切り出した private メソッドだけを持つクラスは、呼び出し元へ戻ってから消える(既存 51〜67行目、そのまま)
4. フィールドを移し終えたクラス(`fields: []`)は消せる(既存 115〜127行目を **`class-tax` に `fields: []` を付けて消す形**に書き換え)
5. 元の Codebase を変更しない(既存)

異常系:

6. **本物の処理を持つクラスは `has-code`**: `sampleCodebase()` の `class-order` → `{ ok: false, error: 'has-code' }`
7. **切り出したメソッドを public にしたクラスは `has-code`、処理は失われない**: `extractedIntoOwnClass()` の `method-tax` を `visibility: 'public'` にして `class-tax-logic` を消す
   → `{ ok: false, error: 'has-code' }`、入力の Codebase が変わっていない(`toEqual` で比較)
8. **呼び出し元も同じクラスにある切り出しメソッドは `has-code`**: 既存 69〜85行目の期待値を `{ ok: false, error: 'has-code' }` に書き換え(テスト名も変える)
9. **契約メソッドを持つクラス(インターフェース役)は `has-code`**(未決事項1のAの場合): `class-tax` に `fragments: []` の public メソッドを持たせて消す
10. **空実装と本物の処理が混ざっているクラスは `has-code`**
11. **フィールドと処理の両方を持つクラスは `has-fields`**(判定順): 既存 98〜113行目の `class-order`(placeOrder あり)のまま `has-fields` になることが、そのまま確認になる
12. 存在しないクラスは `class-not-found`(既存)

### 4.3 `deleteFile`(`deleteFile.test.ts`)

正常系:

1. 空のクラスだけのファイル(`file-tax`)は消える(既存)
2. 切り出した private メソッドだけのクラスがあるファイルは、戻してから消える(既存 31〜61行目、そのまま)
3. **空実装だけのクラスのファイルは消える**
4. 元の Codebase を変更しない(既存)

異常系:

5. **本物の処理を持つクラスがあるファイルは `has-code`**: `sampleCodebase()` の `file-order` → `{ ok: false, error: 'has-code' }`
6. **切り出したメソッドを public にしたクラスがあるファイルは `has-code`**、入力が変わっていない
7. **1つ目のクラスは空、2つ目のクラスに処理があるファイルは `has-code`**(全クラスを見ていること)
8. `last-file`・`has-fields` が `has-code` より先に返る(既存 74〜100行目のまま。`file-order` は処理とフィールドの両方を持つので `has-fields` のまま)
9. 存在しないファイルは `file-not-found`(既存)

### 4.4 実ステージでの回帰(`src/infrastructure/stages/deleteGuard.test.ts`、新規)

`stages`(`stageCatalog.ts`)からステージを引き、初期の Codebase に対して:

1. 中級1: `deleteFile(Order.ts の file-order)` が `{ ok: false, error: 'has-code' }`(=「消して100点」の近道が使えない)
2. 中級1: `deleteClass('class-order')` も同じく `has-code`
3. 上級2: `PaymentGateway.ts` の `deleteFile` が `has-code`(未決事項1のAの場合)
4. 上級5: 初期状態で `BaseExporter.ts` の `deleteFile` が `has-code`

模範解答・近道の `deleteFile`(`TemplateEngine.ts`・`BaseExporter.ts`・`Trash.ts`・`Subscription.ts`)が今までどおり通ることは、
`stageCatalog.test.ts` の既存テスト(`applySolutionSteps` は失敗すると例外を投げる)で守られるので、ここには書かない。

### 4.5 E2E(`e2e/delete-guard.spec.ts`、新規)

ヘルパー(`dragMethodToClass`・`stableBoundingBox` など)は `e2e/refactor.spec.ts` から export されていないので、新しい spec の中に必要な分だけ写す。

1. **中級1で Order.ts を消そうとしても消えない**: 中級1を開く → `file-src/order/Order.ts` を右クリック →「ファイルを削除」
   → `getByRole('alert')` に 3.3 のファイル用の文言、`file-src/order/Order.ts` と `class-Order` が表示されたまま、`score` に `循環依存 -20` が残る
2. **切り出して public にしたメソッドのクラスを消そうとしても、処理が消えない**: チュートリアル2で calculateTax を抽出 → TaxCalculator へドラッグ →
   メソッドエディタで `メソッド calculateTax の可視性` を `public` に → TaxCalculator を右クリック →「クラスを削除」
   → alert に 3.3 のクラス用の文言、`class-TaxCalculator` の中に `method-calculateTax` が表示されたまま

既存の削除E2E(`refactor.spec.ts` 639〜701・1113〜1124・1354〜1366行目)は変えずに通ること。

## 5. 変更依頼・白紙設計の既存テストの書き換え(推奨案 = 未決事項3のA)

部品(`changePart` が作る public メソッド、本物の処理1つ)を置いたクラスは `has-code` で消せなくなる。部品置き場(`file-blank-tray`)も、部品が残っている間は消せなくなる。
ドメインにモードの区別は持ち込まない。

- `changePart.test.ts` 64〜78行目「置き場にある間は false、クラスへ移すと true、そのクラスを消すと false」
  → 3つ目を「部品置き場のクラス(`class-blank-tray`)へ `moveMethod` で戻すと false」に書き換える(テスト名も合わせる)
- `measurePlacement.test.ts` 76〜86行目「部品のクラスごと消しても unplaced-part」
  → 今後は届かない状態なので**削除**する(`unplaced-part` の分岐は 65〜74行目のテストで引き続き通る)
- `measurePlacement.test.ts` 169〜182行目「既存クラスの継承元を変える・既存クラスを消すと、そのクラスも触った扱い」
  → 消すクラスを `class-order`(処理あり)から `class-tax`(`methods: []`)に変え、`deleted.modifiedClassIds` の期待値を `['class-tax']` にする
  (`findModifiedClassIds` は「挑戦前からあって、消えたクラス」を触った扱いにするので、空のクラスでも同じ分岐を通る)

## 6. 受け入れ基準

1. 4.2・4.3・4.4 のテストが、実装より先に書かれて Red になり(`has-code` の各ケースが今は `ok` を返すことを確認)、実装後に Green になる
2. 5章の書き換え後、`changePart.test.ts`・`measurePlacement.test.ts` が通る
3. `RefactorUseCases.test.ts` の「エラーメッセージ」テストに `describeDeleteClassError('has-code')`・`describeDeleteFileError('has-code')` が入り、3.3 の文言で通る
4. `stageCatalog.test.ts`・`featureEnvyStage.test.ts`・`advancedStages.test.ts`・`sampleAnswer.test.ts` が**変更なしで**通る(模範解答は今までどおり100点、近道は今までどおり)
5. `e2e/delete-guard.spec.ts` の2件が通り、`e2e/refactor.spec.ts` の既存の削除テストが変更なしで通る
6. `npm run check`(lint + typecheck + test)が通り、`domain`/`application` のカバレッジ閾値を割らない
7. `inlineMethod.ts`・`deleteMethod.ts`・`Codebase.ts`・`score.ts`・ステージ定義・`CanvasContextMenu.tsx` に差分が無い
8. 手動確認: 中級1で Order.ts を右クリック →「ファイルを削除」で、失敗メッセージが出て点数が変わらない。Ctrl+Z の取り消し履歴に失敗した操作が積まれない(既存の `apply` の挙動のまま)

## 7. スコープ外

- 親クラス・インターフェース役を消したときに、子の `superclassId`・`interfaceIds` を片付ける(`docs/specs/inheritance.md` の後回しのまま。
  本件で本物の処理・契約メソッドを持つ親は消せなくなるので、宙に浮くのは「空になった親」だけになる)
- 右クリックメニューで消せないクラス・ファイルの「削除」項目を無効表示(`aria-disabled`)にする(`CanvasContextMenu.tsx` を触る3件のマージ後に、必要なら別件で)
- `inlineMethod` で public の切り出しメソッドも戻せるようにする(public は他のクラスからも呼ばれうるので、戻すと別の呼び出し元の `uses` が宙に浮く。`inline-method-stage` の前提も崩れる)
- 白紙設計・変更依頼で、消したクラスの部品を部品置き場へ戻す(拒むだけで足りる。YAGNI)
- 呼び出し元の無い private メソッド(デッドコード)を消す操作。今回の規則でクラスごと消して片付ける手段も無くなるが、今そうして解くステージは無い。必要になったら `deleteMethod` の条件として別件で考える
- 確認ダイアログの追加(失敗するようになるので、誤って処理を消す場面はなくなる)
- `tray.ts` のコメント・`describeSolutionStep.ts` のヒント文言の見直し
- `operation-guide` の操作一覧に「中身が残っていると消せない」を添えること(向こうの文言の問題)

## 未決事項

### 未決事項1: 契約メソッド(`fragments: []`)だけを持つインターフェース役のクラス・ファイルを削除できるようにするか

- 選択肢A(推奨): 拒む(`has-code`)。消せるのは「空実装だけ(0個を含む)」のクラスに限る。`deleteMethod` で1つずつ消せるものだけ、とそろい、上級2で PaymentGateway.ts を消して約束違反の減点を逃れる近道も塞がる
- 選択肢B: 許す。行数(処理)は失われないので消してよい、とする。上級2などで「インターフェースを消すと約束違反が消える」近道は残る

### 未決事項2: 失敗の種類をいくつに分けるか

- 選択肢A(推奨): `has-code` 1つにまとめる。「本物の処理が残っている」も「戻せない切り出しメソッドがある」も、どちらも「先にメソッドを別のクラスへ移す」で解決できるので、文言も1つで足りる
- 選択肢B: `has-code` と、戻せない切り出しメソッド用の `extracted-not-inlinable` に分け、後者は「切り出したメソッドは private のままなら削除時に呼び出し元へ戻ります。先に呼び出し元のクラスへ戻してください」のように別の案内を出す

### 未決事項3: 変更依頼・白紙設計で、部品を置いたクラスの削除も拒むか

- 選択肢A(推奨): モードに関係なく拒む。部品は本物の処理なので、消したいときは部品置き場へドラッグで戻すのが正しい手順になる。`changePart.test.ts`・`measurePlacement.test.ts` を5章のとおり書き換える
- 選択肢B: 変更依頼・白紙設計では今までどおり消せるようにする。`deleteClass`・`deleteFile` にモードを表す引数を足し、`useGameStore.ts` から渡す(ドメインに画面のモードが入り、変更ファイルが増える)

### 未決事項4: 切り出したメソッドを public にしたクラスを削除しようとしたときの扱い

- 選択肢A(推奨): 戻せないので削除を拒む(`has-code`、未決事項2のBなら専用エラー)。`inlineMethod` は変えない
- 選択肢B: 削除のときだけ public の切り出しメソッドも呼び出し元へ戻してから消す(`inlineMethod` を通さない戻し処理を足す)。ほかのクラスからも呼ばれていると、その `uses` が宙に浮く点を別途扱う必要がある
