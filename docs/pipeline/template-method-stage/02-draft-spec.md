# 仕様草案: 上級8「取り込みの手順を Template Method にまとめる」

- slug: `template-method-stage`
- 元: `docs/pipeline/template-method-stage/01-discovered.md`

## 1. 背景・目的

- 「処理の骨組みは同じで、1手順だけが違う」重複(CSV/JSONの取り込みなど)を、基底クラスの骨組み(テンプレートメソッド)と
  子クラスのフックに分ける上級ステージを1件足す。上級1(共通処理を基底へ集める)・上級5(子が1つの継承を畳む)と並べて、
  「集める → 手順と差分を分ける → 要らない継承は畳む」をつなげる。
- 新機能課題「XMLでも取り込めるようにして」で、子クラスを1つ足すだけで済むこと(既存クラスを触らない)を実感させる。

### 調査で分かったこと(今の表現・操作では満点の形を作れない)

01の「採点を触らずにステージデータだけで作れるか」を確かめた結果、**作れない**。理由は3つ。

1. **骨組みを基底へ引き上げる手段がない。** 骨組み(`importOrders`)は2つの子に1つずつある。片方を Move Method で基底へ移しても、
   もう片方は本物の処理(呼び出し行)を持つので `deleteMethod`(空実装のみ削除可)で消せない。統合(`mergeMethods`)は
   `private` 同士・全Fragmentに同じ `duplicateGroup` があることが条件で、public の骨組みと、Extract Method が残す呼び出し行
   (`responsibility: 'call'`、`duplicateGroup` なし)は統合できない。
2. **親が子のフックを呼ぶと、親→子の依存・protected 越境になる。** 骨組みを基底へ移すと、呼び出し行の `uses` は子の `parse` のIDを指したまま。
   `classDependencies` は `uses` だけを見るので基底が子2つに依存し(依存本数の超過)、
   `visibility.ts` は子の protected を親が呼ぶのを違反に数える(ponytail コメントの箇所)。基底に `parse` の抽象宣言
   (`protected`・`fragments: []`)を置いても、`uses` は宣言ではなく子のメソッドIDを指すので効かない。
   - 基底に抽象宣言を置くこと自体は既存の採点で問題ない: `findContractMethodsOutsideInterfaces` は public の空メソッドだけを数え、
     protected は数えない。`findUnusedPrivateMethods` も private だけ。
3. **新機能課題で「具象クラスの継承」と減点される。** `measurePlacement` は一番近い既存の先祖が `isInterfaceLike`(全メソッド public かつ空)
   のときだけ `'abstract'` にする。骨組みを持つ基底クラスは中身があるので `'concrete'` → `concrete-base` で -10点。

このため、下の未決事項1・2で「どこまでドメインを直すか」を決めてもらう。以下の本文は**推奨案(未決事項1〜4すべてA)を前提**に書く。

## 2. 変更対象ファイル一覧(推奨案の場合)

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/domain/codebase/overrides.ts`(+`.test.ts`) | domain | 「親の抽象宣言経由の呼び出し」の解決(下記4.1) |
| 変更 | `src/domain/codebase/dependencies.ts`(+テスト) | domain | 依存の算出で、4.1で自分への呼び出しと解決されたものを数えない |
| 変更 | `src/domain/scoring/visibility.ts`(+テスト) | domain | 同上。ponytail コメントを「抽象宣言のない親→子の呼び出しは違反のまま」に書き換える |
| 変更 | `src/domain/codebase/mergeMethods.ts`(+テスト) | domain | 呼び出し行だけの骨組み同士を統合できるようにする(4.2) |
| 変更 | `src/domain/codebase/Codebase.ts`(+テスト) | domain | `isAbstractLike`(4.3)を足す |
| 変更 | `src/domain/change/measurePlacement.ts`(+テスト) | domain | 先祖が `isInterfaceLike` または `isAbstractLike` なら `'abstract'` |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 上級8のステージデータを末尾に追加 |
| 新規 | `src/infrastructure/stages/templateMethodStage.test.ts` | infrastructure | 上級8の模範解答・新機能課題のテスト(`valueObjectStage.test.ts` と同じ形) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | `sampleAnswerSteps['advanced-template-method']` を追加 |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 近道(shortcuts)を追加 |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 骨組み同士を「似た処理を持つメソッド」から統合できることを1本追加 |

presentation は変更しない想定(統合候補は `findMergeCandidates` の結果をそのまま出しているため)。実装者は念のため確認すること。

## 3. データ/型の変更

型(`Codebase`・`Stage`・`ChangeRequest`)にフィールドは足さない。「抽象メソッド」は既存の表現
**`visibility: 'protected'` かつ `fragments: []`** をそのまま使う(新しい `abstract` フラグは作らない。YAGNI:
public の空メソッドがインターフェースの契約として既にある以上、protected の空メソッドを抽象フックと読むだけで足りる)。

### 上級8のステージデータ(題材は未決事項3の推奨案A)

- id: `advanced-template-method`、level: `'advanced'`、title: `上級8: 取り込みの手順を Template Method にまとめる`
- description(案): ネットショップの注文取り込み。取引先ごとに CSV と JSON で注文ファイルが届き、CsvOrderImporter と JsonOrderImporter が
  「ファイルを読み込む → 注文データに変換する → 検証する → 保存する」を、それぞれ最初から最後まで自分で持っている。
  違うのは「変換する」だけで、残りの3手順はコピペ。基底クラス OrderImporter には、変換の手順 `parse` の宣言(中身のない protected メソッド)だけが用意されている。
- goal(案): 共通の3手順は抽出して統合し OrderImporter へ移そう。変換だけは子に `parse` として残し、protected にして OrderImporter を継承させよう。
  最後に、呼び出しだけになった2つの `importOrders` も統合して OrderImporter へ移せば、手順(骨組み)は親の1か所だけになる。
  上級1(共通処理を集める)と違い、親が手順を持ち、子は違う1手順だけを書く。メソッドは60行以内、1クラスの責務は3種類まで、依存先は1クラスまで
- limits: `{ method: 60, class: 150, file: 250 }`、dependencyLimit: `1`、responsibilityLimit: `3`、visibilityEnforced: 省略

初期コードベース(行数は実装者が満点・近道テストに合わせて微調整してよい):

| ファイル | クラス | メソッド(可視性) | Fragment(id / label / lines / responsibility / その他) |
|---|---|---|---|
| `src/order/ImportController.ts` | ImportController | `upload`(public) | `frag-detect-format` / アップロードされたファイルの形式を判定する / 20 / `http`<br>`frag-dispatch-csv` / CSVなら CsvOrderImporter で取り込む / 4 / `import-dispatch` / uses `method-import-csv`<br>`frag-dispatch-json` / JSONなら JsonOrderImporter で取り込む / 4 / `import-dispatch` / uses `method-import-json` |
| `src/order/CsvOrderImporter.ts` | CsvOrderImporter | `importOrders`(public, id `method-import-csv`) | `frag-csv-read` / ファイルを開いて1行ずつ読み込む / 24 / `file-read` / dup `order-import-read`<br>`frag-csv-parse` / CSVの列を注文データに変換する / 38 / `order-parse`<br>`frag-csv-validate` / 必須項目と金額を検証する / 26 / `order-validation` / dup `order-import-validate`<br>`frag-csv-save` / 注文をまとめて保存する / 18 / `persistence` / dup `order-import-save` |
| `src/order/JsonOrderImporter.ts` | JsonOrderImporter | `importOrders`(public, id `method-import-json`) | `frag-json-read` / 同上 / 22 / `file-read` / dup `order-import-read`<br>`frag-json-parse` / JSONの項目を注文データに変換する / 34 / `order-parse`<br>`frag-json-validate` / 同上 / 26 / `order-validation` / dup `order-import-validate`<br>`frag-json-save` / 同上 / 18 / `persistence` / dup `order-import-save` |
| `src/order/OrderImporter.ts` | OrderImporter | `parse`(protected, id `method-order-importer-parse`, `fragments: []`) | なし |

- Csv/Json の `superclassId` は初期状態では付けない(上級1と同じくプレイヤーが設定する)。
- 各 Fragment に `suggestedName` を付ける(`readLines` / `parse` / `validateOrders` / `saveOrders`)。

changeRequests:

- `{ id: 'req-add-xml', title: 'XMLでも取り込めるようにして', description: '新しい取引先はXMLで注文ファイルを送ってくる。CSV・JSONの取り込みはこれまでどおり使う。', responsibility: 'order-parse', linesPerSite: 30, kind: 'extend', partName: 'parse' }`
- `{ id: 'req-order-validation', title: '注文の検証ルールを見直して', description: '注文日が未来日付の注文を取り込まないようにしたい。', responsibility: 'order-validation', linesPerSite: 5, partName: 'rejectFutureOrderDate' }`

### 模範解答(`sampleAnswerSteps['advanced-template-method']`)

1. CsvOrderImporter.importOrders から `frag-csv-read`→`readLines`、`frag-csv-validate`→`validateOrders`、`frag-csv-save`→`saveOrders`、`frag-csv-parse`→`parse` を抽出(`fromClass` 指定)
2. JsonOrderImporter も同様
3. `readLines`・`validateOrders`・`saveOrders` をそれぞれ merge(A=Csv, B=Json、名前はそのまま)
4. 両クラスの `parse` を `changeVisibility` で protected に
5. 両クラスの `setSuperclass` を OrderImporter に
6. `importOrders`(Csv)と `importOrders`(Json)を merge(名前 `importOrders`)← 4.2の拡張が必要
7. `importOrders`・`readLines`・`validateOrders`・`saveOrders` を OrderImporter へ move

最終形: ImportController → OrderImporter の依存1本。OrderImporter は骨組み4行+共通3手順+抽象 `parse`(責務3種)。
Csv/Json は `parse` だけ。4.1により OrderImporter → 子の `parse` 呼び出しは依存にも protected 越境にも数えない。

## 4. TDD対象の純粋関数

### 4.1 `resolvesToOwnDeclaration(codebase, callerClassId, methodId): boolean`(`domain/codebase/overrides.ts`)

「呼ぶ側のクラスが、呼ばれるメソッドと同名のメソッドを自分で宣言していて、呼ばれるメソッドの持ち主が呼ぶ側の子孫(extends の先祖に呼ぶ側を含む)で、
呼ばれるメソッドが private でない」とき true(=実際のコードでは `this.parse()` で、自分の抽象宣言を呼んでいるだけ)。

- 正常系: 親 P が protected 空の `parse` を持ち、子 C(extends P)の protected `parse` を P が uses → true
- 子の `parse` が public でも true(オーバーライドで可視性を広げるのは合法)
- 異常系: 子の `parse` が private → false(private はオーバーライドできない。プレイヤーに protected へ変えさせる)
- 異常系: P が同名メソッドを持たない(上級5の BaseExporter→quoteChar)→ false(既存どおり依存・違反に数える)
- 異常系: C が P を継承していない(`superclassId` なし、または `interfaceIds` だけ)→ false
- 孫: C extends B extends P で P が uses → true
- 存在しないメソッドID・クラスID → false

`dependencies.ts` の `dependencyTargets` と `visibility.ts` の `findVisibilityViolations` で、この関数が true の `uses` を飛ばす。

- `classDependencies`: P→C の `uses` が上記で true なら依存に出ない / false なら今までどおり出る
- `findVisibilityViolations`: 同上で protected 違反に出ない / 上級5の形は今までどおり `protected` 違反

### 4.2 `mergeMethods` の拡張(呼び出し行だけの骨組み同士の統合)

形の一致(`sameShape`)に、**「両方とも `responsibility: 'call'` で、`uses` の各メソッドの名前の並びが同じ」**ならその位置は一致、を足す
(`duplicateGroup` による一致は今までどおり)。可視性の条件は未決事項1で決める(推奨A: 全Fragmentが呼び出し行のメソッド同士に限り、
両方が同じ可視性なら public/protected も可。統合結果はその可視性を引き継ぐ)。

- 正常系: 呼び出し行4つ(うち3つは同じIDを uses、1つは別クラスの同名 `parse` を uses)の public メソッド2つ → 統合でき、結果は public、parse 呼び出しの uses は和集合
- 正常系: 呼び出し元(ImportController)の uses が統合後のIDへ付け替わる(既存の `rewireCallers` のまま)
- 異常系: 呼んでいるメソッド名が1つでも違う → `shape-mismatch`
- 異常系: 呼び出し行と本物の処理が混ざった public メソッド → `not-private`(今までどおり。公開APIの誤統合を防ぐ安全策は残す)
- 異常系: public と private → `not-private`
- 既存のテストはすべてそのまま通る
- `findMergeCandidates` も同じ条件で候補を返す

### 4.3 `isAbstractLike(codeClass): boolean`(`Codebase.ts`)

`protected` かつ `fragments: []` のメソッドを1つ以上持つクラス。

- 正常系: 上級8の OrderImporter(初期・模範解答後とも)→ true
- 異常系: 上級5の BaseExporter、空のクラス、インターフェース役 → false

`measurePlacement.measureAttachment` で `isInterfaceLike(nearest) || isAbstractLike(nearest)` なら `'abstract'`。

- 正常系: 模範解答後の上級8で、XmlOrderImporter(新クラス、extends OrderImporter)に部品を置く → `'abstract'`、`concrete-base` の減点なし
- 既存: 中身のある具象クラスを継承した場合は今までどおり `'concrete'`

### 4.4 ステージのテスト(`templateMethodStage.test.ts`)

- 模範解答を適用すると `scoreCodebase` が100点
- 模範解答後、ImportController の依存は OrderImporter の1本だけ・循環なし・可視性違反なし
- 初期状態は100点未満(メソッド行数・依存本数の超過)
- 新機能課題 `req-add-xml`: 模範解答後に XmlOrderImporter を足して部品を置くと、既存クラスの修正0・`attachment: 'abstract'`・置き方100点
- 新機能課題 `req-order-validation`: 模範解答後は変更箇所1か所(OrderImporter)、初期状態は2か所

`stageCatalog.test.ts` の近道(100点未満になること):

- 「共通3手順を統合して親へ移すが、骨組み(`importOrders`)は子に残す」→ ImportController の依存が2本で減点(上級1止まり)
- 「`parse` を private のまま骨組みを親へ引き上げる」→ OrderImporter が子2つに依存し、依存本数の超過で減点

## 5. 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。`domain` のカバレッジ閾値を割らない
- 上級8がステージ選択の上級の末尾に出て、模範解答どおりに操作すると100点、新機能課題「XMLでも取り込めるようにして」で子クラス1つを足すだけで置き方100点
- 既存ステージ(特に上級1・上級5・中級の可視性ステージ)の点数・模範解答・近道テストが変わらない
- `e2e/refactor.spec.ts` に、上級8で2つの `importOrders` をメソッドエディタの「似た処理を持つメソッド」から統合できる E2E が1本あり、`npm run test:e2e` が通る
- `visibility.ts` の ponytail コメントが新しい挙動に合わせて書き換わっている

## 6. スコープ外

- 抽象メソッドの「実装漏れ」(子が `parse` を持たない)の採点。インターフェースの実装漏れと同じ扱いにしたくなったら別仕様で(今は子が `parse` を持たなくても減点しない)
- `abstract` フラグなど型の追加、クラスノードでの「抽象」表示
- フック(Hook Method、中身のあるデフォルト実装を子が上書きする形)。空の抽象宣言だけを扱う
- 名前だけでオーバーライドを判定する手抜き(引数の型は見ない)。`overrides.ts` に `// ponytail:` コメントを残す
- Observer・Decorator など他のパターン、既存ステージのデータ変更

## 未決事項

### 未決事項1: 骨組み(テンプレートメソッド)を親へ引き上げる操作をどう用意するか

- 選択肢A(推奨): Merge Methods を広げる。呼び出し行だけのメソッド同士は、呼ぶメソッド名の並びが同じなら統合でき、同じ可視性なら public 同士も可(4.2)。UIは既存の「似た処理を持つメソッド」のまま、操作は増えない
- 選択肢B: 新しい操作「Pull Up Method」を作る(子の同名・同形メソッドを親へ1つにまとめ、他の子の分を消す)。Fowler の用語どおりで分かりやすいが、ドメイン関数・UI・E2E が1つずつ増える
- 選択肢C: 骨組みの引き上げはさせない(子に呼び出し4行の骨組みが残る形を満点にする)。ドメインは4.1だけ直せば済むが、上級1とほぼ同じ体験になり Template Method にならない

### 未決事項2: 新機能課題「XMLでも取り込めるようにして」(extend)で、骨組みを持つ基底クラスの継承をどう採点するか

- 選択肢A(推奨): protected の空メソッドを持つクラスを「抽象クラス」とみなし(`isAbstractLike`)、継承しても `concrete-base` で減点しない(4.3)
- 選択肢B: extend の課題は出さず、modify の課題(検証ルールの見直し)だけにする。採点は触らないが「子を1つ足すだけ」の実感がなくなる
- 選択肢C: 減点を残す(-10点)。講評で「具象クラスの継承」と言われ、ステージの狙いと矛盾する

### 未決事項3: 題材

- 選択肢A(推奨): 注文ファイルの取り込み(CSV/JSON、追加でXML)。上級1(通知)・上級4(レポート出力)・上級5(CSV出力)と「入力側」で被らない
- 選択肢B: 会計ソフトへの仕訳の連携(freee/マネーフォワード、追加で弥生)。認証→変換→送信→記録の手順。上級2(決済ゲートウェイ)と「外部APIの差し替え」で印象が近い
- 選択肢C: 月次の締めバッチ(売上締め/経費締め、追加で勤怠締め)。集計の手順が違いすぎて「1手順だけ違う」が伝わりにくい

### 未決事項4: 子の `parse` を private のまま親から呼ばせたときの扱い

- 選択肢A(推奨): 親の抽象宣言経由とはみなさず、今までどおり親→子の依存(依存本数の超過)として減点する。goal に「protected にしよう」と書いて気づかせる
- 選択肢B: private でも抽象宣言経由とみなす(減点しない)。操作は1手減るが、TypeScript では private はオーバーライドできないので実際のコードと食い違う
