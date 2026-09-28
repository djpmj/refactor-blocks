# 仕様書: インターフェース役を extends にすると「実装漏れ」の採点をすり抜ける抜け道を塞ぐ

- slug: `extends-interface-loophole`
- 元になった探索: `docs/pipeline/extends-interface-loophole/01-discovered.md`
- 元になった草案: `docs/pipeline/extends-interface-loophole/02-draft-spec.md`
- 確定した回答: `docs/pipeline/extends-interface-loophole/03-confirmed-answers.md`

## 確定した方針(要約)

- 抜け道は**採点で塞ぐ**。`contract` の実装漏れが、implements したインターフェース役に加えて extends の先祖のインターフェース役も調べる。
  `interfaceContracts.ts` とテストだけの変更で、操作・画面・E2E は変わらない
- 同じ上級6の「具象クラス ChatworkClient を extends して空実装を消す」抜け道は**今回は扱わない**(再現手順だけ1章に残す)
- 上級6の回帰テストは `advancedStages.test.ts` の `describe('advanced-interface-segregation')` に置き、点数と内訳まで確かめる
- extends の途中のクラス(`C extends B extends I` の B)も、契約の一部を持たなければ**実装漏れに数える**(`// ponytail:` コメントを残す)

## 1. 背景・目的

`src/domain/scoring/interfaceContracts.ts` の `findMissingImplementations`(28〜41行目)は、`interfaceIds`(implements)に書かれた
インターフェース役(`isInterfaceLike`)の契約しか調べない。一方 `findUndeclaredImplementations`(76〜89行目)は `parentIds`(extends + implements)を
たどってインターフェース役に届けば「宣言済み」とみなす。このため**インターフェース役を extends すると、「実装を宣言した」扱いにはなるのに
「実装漏れ」は調べられない**。`setSuperclass`(`setSuperclass.ts` 49〜68行目)・`availableParents`(106〜108行目)はインターフェース役を継承元に選ぶことを
拒まないので、右クリックメニューの「継承元を設定」からそのまま作れる。

上級6「太ったインターフェースを役割ごとに分ける」では、インターフェースを一切分けずに 50点 → 100点になる(下の「調査で分かったこと」)。
ISP のステージで「困ったら extends に付け替えて空実装を消せば満点」と教えてしまい、対象プレイヤー(新卒〜4年目)に誤った癖を付けるので塞ぐ。

**直し方は「採点で直す」。** 上級6の仕様書が既に「操作ではなく状態(`contract` の実装漏れ)で判定する。実装先の付け外しで簡単にすり抜けられるので」
(`docs/specs/interface-segregation-stage.md` 231行目)と決めており、同じ理由で操作側のガードだけでは塞ぎきれない(下の「操作で塞ぐ案の抜け穴」)。

### 調査で分かったこと

**抜け道の点数(手計算)。** 仕様設計の時点ではシェル実行の手段が無く、`npm test` での実測はできなかった。以下はコードを読んだ手計算で、
実装者は4.2のテストを**実装より先に**書いて走らせ(Red)、失敗メッセージで今の実装が `total: 100` を返すこと(=抜け道が実在すること)を確かめてPRに書く。

上級6(`advancedStages.ts` 489〜731行目)の初期状態は `stub` 5件だけで50点(`advancedStages.test.ts` 428〜438行目で固定済み)。次の11手を踏む。

1. `removeInterface` ×3: SlackClient・TeamsClient・BacklogClient から `CollaborationTool` を外す(`interfaceIds` は `undefined` になる)
2. `setSuperclass` ×3: 同じ3クラスの継承元を `CollaborationTool` にする(implements を外した後なので `already-related` にならない。
   `reachesSelf(CollaborationTool → 子)` も false。`promoteCalledPrivateMethods` は private が無いので何もしない)
3. `deleteMethod` ×5: Slack・Teams の `createTask`・`completeTask`、Backlog の `postMessage`(どれも `isStubMethod` なので `not-stub` にならない)

| ルール | 11手後の件数 | 根拠 |
|---|---|---|
| `line-limit` | 0 | 最長は IncidentService.reportIncident の 82行(上限90)。クラス・ファイルも上限内 |
| `coupling` / `cycle` | 0 / 0 | `uses` は変わらない(AlertNotifier → CollaborationTool、IncidentService → CollaborationTool の1本ずつ、`dependencyLimit: 1`)。継承は依存に数えない(`dependencies.ts`) |
| `responsibility` | 0 | 最多は Chatwork の3種類(上限3) |
| `visibility` / `unused` | 0 / 0 | private・protected のメソッドが無い |
| `empty` | 0 | 空のクラス・ファイルは無い |
| `lone-superclass` | 0 | CollaborationTool を extends する子は3つ(`loneSuperclass.ts` はちょうど1つだけ数える) |
| `stub` | 0 | 5つとも消した |
| `contract` 実装漏れ | **0** | Slack・Teams・Backlog は `interfaceIds` が空なので見られない。Chatwork は3つとも持つ |
| `contract` 宣言漏れ | 0 | 3クラスとも `parentIds` で CollaborationTool に届く |
| `contract` インターフェースの外の契約メソッド | 0 | CollaborationTool はインターフェース役のまま |
| `feature-envy` / `encapsulation` / `cohesion` | 0 | 上級6にはフィールドが無い |

→ **100点**(見込み)。直した後は、Slack が `createTask`・`completeTask`、Teams が同じ2つ、Backlog が `postMessage` を持たないので
`contract` 5件で**50点**になる(`stub` の5件が `contract` の5件に置き換わるだけ。点は初期状態と同じ)。

**他のステージ・既存テストへの影響(読んだ範囲)。**

- 全ステージの初期状態・模範解答で `superclassId` を持つのは上級5の CsvExporter → BaseExporter と、上級1の模範解答の EmailNotifier・SmsNotifier → NotifierBase だけ。
  BaseExporter は中身のある public/protected メソッド、NotifierBase は移された中身のある `logNotification` を持つので、どちらも `isInterfaceLike` ではない。
  → 初期点・模範解答100点・`stageCatalog.test.ts` の近道は変わらない
- 白紙設計(`blankDesignProblems.ts`)にはインターフェース役・継承が無い。`reviewBlankDesign` の点は変わらない
- `interfaceContracts.test.ts`・`score.test.ts`・`fileScores.test.ts` で `superclassId` を使う既存テストの親は、どれも `isInterfaceLike` ではない。変わらない
- 上級2(`PaymentGateway`)・上級3(`DiscountStrategy`)は契約が1つずつ。途中で `StripeGateway extends PaymentGateway` のような形にしたときだけ、
  implements にしたときと同じ件数の実装漏れが出るようになる(同じ状態を implements で作ったときと揃うだけ)
- 新機能課題の置き方(`measurePlacement`・`sampleImplementation`)は `scoreCodebase` を使わないので変わらない。
  `measurePlacement.ts` 107行目が「一番近い先祖がインターフェース役なら extends でも `'abstract'`」としているのは、
  「インターフェース役 = 全メソッドが abstract の抽象クラスとしても読める」という今のモデルで、本件の直し方はこれと矛盾しない
- E2E(`e2e/refactor.spec.ts` 533〜1246行目の「継承元を設定」)は TaxCalculator → OrderService・EmailNotifier → NotifierBase で、どちらもインターフェース役ではない

**操作で塞ぐ案(`setSuperclass` がインターフェース役を拒む)だけでは塞ぎきれない(手計算)。** `isInterfaceLike` はメソッドの出し入れで変わる「状態」なので、
操作の時点で1回見るだけでは足りない。例: `moveMethod` で AlertNotifier の `notifyAlert` を CollaborationTool へ移す(中身のあるメソッドが入り、
一時的にインターフェース役でなくなる)→ `removeInterface` ×3 → `setSuperclass` ×3(ガードを通る)→ `notifyAlert` を AlertNotifier へ戻す →
空実装5つを消す。最後の状態は上の11手と同じなので100点のまま。塞ぐには `moveMethod` 側にも同じガードが要り、ガードが操作の数だけ散らばる。
このため操作側のガードは採用しない(6章)。

**同じ上級6で、本件の直し方では塞がらない別の抜け道(手計算、今回はスコープ外)。** 空実装5つを消し(`deleteMethod` ×5)、
Slack・Teams・Backlog の継承元を **ChatworkClient**(中身のある具象クラス)にする(`setSuperclass` ×3、implements はそのまま)。
3クラスとも extends の先祖 Chatwork が `postMessage`・`createTask`・`completeTask` を持つので実装漏れ0、宣言漏れ0、Chatwork の子は3つで `lone-superclass` 0、
継承は依存に数えないので `coupling` 0 → **8手で100点**の見込み。実際のコードでは「Slack が Chatwork のタスク登録を継承する」誤った is-a で、
ISP の狙いも果たしていない。ただし「extends の先祖が持っていれば実装漏れに数えない」(`interfaceContracts.test.ts` 89〜112行目)は正当な使い方でもあり、
塞ぐには「具象クラスを継承して別の実装を借りる」を判定する新しいルールの設計が要る。本件(インターフェース役を extends する穴)とは仕組みが別なので、
別件として次の機能探索に回す。将来この件を扱うときは、この再現手順を出発点にする。

### 本当に新しい仕組みが要るか(ponytail)

- 階段の2段目(このリポジトリにもうある)で止まる。新しいルール名・新しい型・新しい依存・UI変更は要らない。既存の `contract`(実装漏れ)が見る相手を
  「implements したインターフェース役」から「implements したインターフェース役 + extends の先祖のインターフェース役」へ広げるだけ。
- extends の鎖は既存の `extendsChainIds`(`Codebase.ts` 148〜157行目。自分 → 近い先祖の順、輪でも止まる)をそのまま使う。
  `interfaceContracts.ts` の `extendsChainMethodNames` は、この鎖の上でメソッド名を集める形に書き換える(同じ鎖を2回歩く実装を持たない)。
- 操作・画面・`RefactorUseCases.ts`・E2E は触らない(プレイヤーの操作は変わらない)。
- 操作側のガードも要らない。採点で最終状態が減点されるので、インターフェース役を extends しても点は上がらない。
  `class X extends <interface>` と書ける状態が残るのは表示の問題で、`codebase-code-view` 側の話(7章)。

## 2. 変更対象ファイル一覧

| 新規/変更 | パス | 層 | 役割 |
|---|---|---|---|
| 変更 | `src/domain/scoring/interfaceContracts.ts` | domain | 実装漏れの判定を extends したインターフェース役にも広げる(4.1)。`findMissingImplementations` の JSDoc を新しい規則に書き換える |
| 変更 | `src/domain/scoring/interfaceContracts.test.ts` | domain(テスト) | 4.1のケースを**先に**追加。既存12件はそのまま通す |
| 変更 | `src/infrastructure/stages/advancedStages.test.ts` | infrastructure(テスト) | `describe('advanced-interface-segregation')` の末尾に回帰テストを追加(4.2) |

**読むだけで変更しないファイル**: `src/domain/codebase/Codebase.ts`(`isInterfaceLike`・`extendsChainIds`・`parentIds`)、`src/domain/codebase/setSuperclass.ts`、
`src/domain/change/measurePlacement.ts`、`src/domain/scoring/score.ts`・`fileScores.ts`、`src/domain/stage/sampleAnswer.ts`(`applySolutionSteps` を使うだけ)、
`src/infrastructure/stages/advancedStages.ts`。

**触らないファイル**: `src/application/**`(`RefactorUseCases.ts` の `SET_SUPERCLASS_ERROR_MESSAGES` を含む)、`src/presentation/**`、`e2e/**`、
`src/infrastructure/stages/stageCatalog.test.ts`、ステージ定義本体、`docs/specs/` の既存仕様書。

## 3. データ/型の変更

なし。`Codebase`・`CodeClass`・`ScoreRule`・`findContractViolations` の戻り値の形(`string[]`、1件 = 1要素、実装漏れは実装クラスのID)はすべて今のまま。

## 4. TDD対象の純粋関数

### 4.1 `findContractViolations`(の中の実装漏れ判定)— `interfaceContracts.ts`

外から見える関数は `findContractViolations` のまま(非公開の `findMissingImplementations` を直す)。新しい実装漏れの規則:

- **調べる相手(契約の出どころ)**: クラス C について、
  (a) `C.interfaceIds` のうち `isInterfaceLike` なクラス(今のまま、宣言順)
  (b) **C が `isInterfaceLike` でないときだけ**、C の extends の先祖(C自身を除く、近い順)のうち `isInterfaceLike` なクラス
  を合わせ、同じクラスIDは1回だけにする。存在しないID(削除済み)は飛ばす。
  - (b) を C がインターフェース役のときに見ないのは、インターフェースがインターフェースを extends するのは正当だから(`interface B extends A`)
- **「持っている」メソッド名**: C 自身と extends の先祖のメソッド名。ただし **C 自身以外の `isInterfaceLike` な先祖のメソッド名は数えない**
  (中身の無い契約メソッドを「実装した」に数えない。今の `extendsChainMethodNames` が先祖の契約メソッド自身の名前を数えてしまう点の修正)。
  空実装(`stub`)は今までどおり「持っている」に数える(空実装は `stub` で減点する)。
- 調べる相手の契約メソッド名のうち「持っている」に無いもの1つにつき、C のIDを1件。並びは「クラスの出現順 → (a)(b) の順 → 契約メソッドの宣言順」。
- **extends の途中のクラス**(`C extends B extends I` の B)も、インターフェース役でなければ(b)で調べる。B が契約の一部を持たず C だけが持つとき、B を実装漏れに数える
  (今の implements 側の規則「自分と extends の先祖のどれかが持てばよい」と同じ向きで、規則が最小)。ここは意図的な単純化なので、次のコメントを残す:
  `// ponytail: extends の途中のクラスも契約をすべて持つ必要がある(抽象クラスを表す項目が無いため)。abstract を表せるようになったら、子孫が持てば数えない形に見直す`

実装の目安(拘束しない。lint の循環的複雑度12・ネスト4段・60行に収めるため、小さな関数に分ける):

- `extendsChainMethodNames(codebase, classId)` を、`extendsChainIds` の鎖を順に見て「自分以外のインターフェース役」を飛ばしながら名前を集める形に書き換える
- 「調べる相手」を返す小さな関数(例: `contractSourcesOf(codebase, codeClass): CodeClass[]`)を足し、`findMissingImplementations` のループはそれを回すだけにする
- 型ガードの `filter` と `Set` による重複除去で書ける。`as`・`!` は使わない

テスト(`interfaceContracts.test.ts` の `describe('findContractViolations')` に追加。既存のヘルパー `contractMethod`・`realMethod`・`codebaseOf` を使う。AAA):

1. **正常系(本件の中心、今は Red)**: インターフェース役 I(契約 `a`・`b`)を extends した C(`superclassId: I`、`interfaceIds` なし)が `a` だけ持つ → `['class-c']`
2. 正常系: I を extends した C が `a`・`b` を中身のある実装で持つ → `[]`
3. 正常系: I を extends した C が `b` を空実装(`stub: true`)で持つ → `[]`(空実装は `stub` の担当)
4. 正常系(今は Red): I の契約名は、I を extends した C が「持っている」に数えない。C が `run` だけ持つ → `['class-c', 'class-c']`(`a`・`b` の2件)
5. 正常系(途中のクラス、今は Red): `C extends B extends I`、B が `a` だけ、C が `b` だけ持つ → `['class-b']`(B は `b` が無い。C は B と合わせて両方ある)
6. 境界(重複除去、今は Red): C が I を extends もし、implements もしている(`superclassId: I`, `interfaceIds: [I]`。`setSuperclass` の `already-related` で作れないが壊れたデータ)で `a` だけ持つ → `['class-c']`(1件だけ)
7. 境界(インターフェースの継承): インターフェース役 J(契約 `x`)が インターフェース役 I(契約 `a`)を extends している → `[]`(J は調べない)
8. 境界: extends の先祖がインターフェース役でない(既存の「extendsの先祖が持っていれば数えない」89〜112行目)→ 今までどおり `[]`
9. 異常系: `superclassId` が削除済みのIDを指す → 落ちずに、そのクラスの extends 側は調べない(`implements` 側は今までどおり)
10. 異常系: extends が輪になっている(`A.superclassId: B`、`B.superclassId: A`、どちらもインターフェース役でない)→ 落ちずに終わる
11. 既存12件(`findStubMethods` 1件・`findContractViolations` 11件)は**変更せずに**すべて通る

### 4.2 上級6の回帰テスト — `advancedStages.test.ts`

`describe('advanced-interface-segregation')` の末尾に1件足す。手順は `applySolutionSteps`(`sampleAnswer.ts`)と `SolutionStep` を import して書く
(今この describe は `addInterface` を直接呼んでいるが、11手なので `applySolutionSteps` の方が短い)。

- テスト名(例): 「CollaborationTool の implements を extends に付け替えて空実装を消しても、実装漏れで100点にならない」
- Arrange: 1章の11手(`removeInterface` ×3 → `setSuperclass` ×3 → `deleteMethod` ×5)
- Assert: `scoreCodebase(played, stage)` の `total` が **50**、`count > 0` の内訳が `[{ rule: 'contract', count: 5, points: 50 }]` だけ
  (初期状態のテスト 428〜438行目と同じ書き方)
- **実装より先に書いて走らせ、今の実装では `total: 100`(内訳すべて0)で落ちることを確かめる。** これが抜け道の実測になる(PRの説明に結果を書く)

## 5. 受け入れ基準

- [ ] 4.1・4.2のテストが先に追加され、修正前は 4.1 の1・4・5・6 と 4.2 が落ち、4.2 の失敗メッセージで今の実装が100点を返すことを確かめている(PRの説明に記載)
- [ ] 修正後、`npm run check`(lint + typecheck + test)が通る。`domain` のカバレッジ閾値(`vite.config.ts`)を割らない
- [ ] 上級6で1章の11手を踏むと50点(`contract` 5件)になる
- [ ] 既存の `interfaceContracts.test.ts` 12件、`stageCatalog.test.ts` の全ステージの「初期状態では減点がある」「模範解答どおりに操作すると100点になる」と `shortcuts` 全件、
      `advancedStages.test.ts` の上級6「初期状態の減点は空実装5件だけで、50点になる」が、**テストを書き換えずに**通る
- [ ] `findMissingImplementations` の JSDoc が新しい規則(implements したインターフェース役と extends の先祖のインターフェース役の両方を見る。
      インターフェース役の先祖の契約名は「持っている」に数えない)を説明している
- [ ] extends の途中のクラスを実装漏れに数える箇所に、4.1 の `// ponytail:` コメントが残っている
- [ ] `src/application/`・`src/presentation/`・`e2e/`・`stageCatalog.test.ts`・ステージ定義本体に差分が無い
- [ ] `npm run test:e2e` は、操作・画面を変えないので追加しない(既存がそのまま通ればよい)

## 6. スコープ外

- **`setSuperclass`・`availableParents` でインターフェース役を継承元に選べなくする(操作側のガード)**、右クリックメニューの候補からインターフェース役を除く・無効表示にする。
  採点で点は上がらなくなるので要らない。`codebase-code-view` が `class X extends <interface>` の見え方を問題にしたら、そちらのマージ後に別件で
- **具象クラス(ChatworkClient など)を extends して契約の実装を借りる抜け道**(1章の「別の抜け道」)。別件として次の機能探索に回す。
  再現手順は1章に書いたとおり(`deleteMethod` ×5 → `setSuperclass` ×3 で Slack・Teams・Backlog → ChatworkClient)
- `changeVisibility` で、インターフェースの契約を実装しているメソッドを private/protected へ狭められる件(点は上がらないので抜け道ではない。01の後回しのまま)
- protected の抽象宣言(`template-method-stage` の `isAbstractLike`)を extends した子の実装漏れ。`template-method-stage` の02でスコープ外として先送りされたまま。
  本件は判定を「先祖が `isInterfaceLike` か」で分けておくので、あちらのマージ後に同じ関数へ `isAbstractLike` の分を足せる
- extends の途中のクラスを「抽象クラス」とみなして、子孫が契約を持てば許す扱い(抽象クラスを表す項目ができたら見直す。4.1 の `// ponytail:` コメント)
- ステージ定義の検査「`superclassId` がインターフェース役を指していないか」(`stage-reference-integrity` の02 151行目のスコープ外のまま)
- `contract` を3種類のルールに分けること、講評(`workers/critique/`)・`describeScore.ts` の文言の変更
- `stageCatalog.test.ts` の `shortcuts` への追記(回帰テストは `advancedStages.test.ts` に置く)
- `docs/specs/interface-segregation-stage.md` など既存仕様書の書き換え(本仕様書 `docs/specs/extends-interface-loophole.md` が正本になる)

## 7. 衝突・意味上の依存

| 件 | 影響 |
|---|---|
| `template-method-stage` | あちらの OrderImporter は protected の空メソッド + 中身のあるメソッドで `isInterfaceLike` ではないので、本件の(b)の対象にも「持っている」の除外にもならない。点数は変わらない。どちらが先にマージされても動く |
| `codebase-code-view` | インターフェース役を `export interface X` と書く案(同02の未決事項4)。本件では「インターフェース役を extends したクラス」を作れる状態は残る(契約をすべて実装すれば減点も無い)ので、`class X extends <interface>` と表示される場面は残る。「全メソッドが abstract の抽象クラス」として読める今のモデルと矛盾はしない。どちらが先でも動く |
| `implements-arrow-style` | 矢印の描き分けは変えない。インターフェース役への extends は実線(extends)のまま描かれる |
| `score-deduction-locations` | `findContractViolations` の戻り値の形を変えないので、増える実装漏れ(クラスID)はそのまま内訳の一覧に出る |
| `delete-class-code-guard` | 契約メソッドを持つインターフェース役の削除を `has-code` で拒む案(同02の未決事項1)。本件は削除を扱わない。仮にインターフェース役が消せても、`superclassId` が宙に浮いたクラスは(b)で飛ばすだけで落ちない(4.1のテスト9) |
| `stage-reference-integrity` | ステージ定義の検査は変えない。本件で「インターフェース役の extends は採点で見る(禁止はしない)」と決まるので、将来「`superclassId` がインターフェース役を指していないか」を検査に足す必要は無い、という判断材料になる |
| `stageCatalog.test.ts` を触る他4件(`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`) | 本件は `stageCatalog.test.ts` を触らないので衝突なし |
