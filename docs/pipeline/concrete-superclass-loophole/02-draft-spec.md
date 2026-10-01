# 仕様書(草案): 具象クラスを extends して契約の実装を「借りる」抜け道を塞ぐ

- slug: `concrete-superclass-loophole`
- 元になった探索: `docs/pipeline/concrete-superclass-loophole/01-discovered.md`
- 前例・再現手順の出どころ: `docs/specs/extends-interface-loophole.md`(1章「別の抜け道」・6章)

## 1. 背景・目的

上級6「太ったインターフェースを役割ごとに分ける」(`advanced-interface-segregation`)で、インターフェースを一切分けずに
次の8手を踏むと満点になる見込み(`extends-interface-loophole.md` 1章の手計算を、今のコードで読み直した)。

1. `deleteMethod` ×5: Slack・Teams の `createTask`・`completeTask`、Backlog の `postMessage`(どれも `isStubMethod`)
2. `setSuperclass` ×3: SlackClient・TeamsClient・BacklogClient の継承元を **ChatworkClient** にする(implements はそのまま)
   - `setSuperclass.ts` 49〜68行目: 自己継承でも、`interfaceIds` に Chatwork を含むのでもなく(`already-related` にならない)、
     Chatwork → 子 に戻れない(`inheritance-cycle` にならない)ので通る

| ルール | 8手後 | 根拠 |
|---|---|---|
| `contract` 実装漏れ | 0 | `extendsChainMethodNames`(`interfaceContracts.ts` 12〜22行目)が先祖 Chatwork の3メソッド名を「持っている」に数える |
| `contract` 宣言漏れ・外の契約 | 0 / 0 | 3クラスとも implements のまま。CollaborationTool はインターフェース役のまま |
| `lone-superclass` | 0 | Chatwork の子は3つ |
| `coupling` / `cycle` | 0 / 0 | 継承は依存に数えない |
| `stub` | 0 | 5つとも消した |
| その他 | 0 | 行数・責務・可視性・フィールド系は初期状態から変わらない |

→ **100点**(見込み)。実際のコードでは「Slack が Chatwork のタスク登録を継承する」誤った is-a(Refused Bequest)で、ISP の狙いも果たしていない。
対象プレイヤー(新卒〜4年目)に「実装が足りなければ全部持っている具象クラスを継承すればよい」を満点で教えてしまうので、**採点で**塞ぐ
(操作側のガードは `extends-interface-loophole` と同じ理由で採らない。継承元が具象かどうかは moveMethod などで変わる「状態」なので)。

### 調査で分かったこと

**判定の線引き。** 今のモデルには `abstract` を表す項目が無く、「抽象役」を表せるのは次の2つだけ。

- `isInterfaceLike`(`Codebase.ts` 115行目): メソッドがすべて public で中身なし
- `isAbstractLike`(`Codebase.ts` 187行目): protected の空宣言を1つ以上持つ(Template Method の基底)

このどちらでもないクラス = **具象クラス**とみなし、「インターフェースの契約メソッドを、自分では持たず**具象の先祖から**受け継いでいる」を「借用」と呼ぶ。

**既存ステージ・テストへの影響(読んだ範囲、手計算)。**

- 継承を使うステージ(上級1 NotifierBase、上級5 BaseExporter、上級8 OrderImporter)は、どれも**インターフェース役が絡まない**(`interfaceIds` を持つのは上級6の4クラスだけ。
  上級2・3は模範解答で `addInterface` するだけで extends を使わない)。借用の判定はインターフェースの契約メソッドしか見ないので、初期点・模範解答100点・`stageCatalog.test.ts` の `shortcuts` は変わらない
- 上級6の模範解答は extends を使わないので変わらない
- 白紙設計(`blankDesignProblems.ts`)には継承・インターフェースが無い
- **`interfaceContracts.test.ts` 89〜112行目「extendsの先祖が持っていれば数えない」だけが当たる。** Base(具象、I を implements、`a`・`b` を持つ)を
  C が extends し、C は `a` だけ持って `b` を Base から受け継ぐ。これは本件の8手後の Slack と**構造がまったく同じ**で、データからは区別できない。
  このため「正当な使い方」を残すには、テストの Base を抽象役(`isAbstractLike`)として書き直す必要がある(未決事項3)
- 同じファイル 172〜188行目(G extends 具象 Base、G は `x` を自分で上書き)は、借用していないので当たらない
- `extends-interface-loophole`(最終仕様済み・未実装)との関係: あちらは「先祖がインターフェース役」、本件は「先祖が具象」で、契約メソッドの名前を
  最も近くで持つ先祖の種類で分かれるので**重ならない**。本件は `findMissingImplementations` を触らず、別の関数を足すだけにするので、どちらが先にマージされても動く

**上級6以外で同じ形の手が通るか(手計算)。**

- 上級2(決済): PaypalGateway extends StripeGateway にして PaypalGateway の `addInterface` を省くと、Stripe の子が1つなので `lone-superclass` で既に減点される(抜け道にならない)
- 上級3(割引): Premium・Vip を Regular の子にして2つの `addInterface` を省くと、Regular の子が2つで `lone-superclass` 0、宣言漏れも Regular 経由で0 → 100点の見込み。
  ただし Premium・Vip は `calculate` を自分で持つ(借用ではない)ので本件の判定では塞がらない。手数も模範解答と同じで「近道」ではない。未決事項1の選択肢Bを選んだときだけ塞がる

### 本当に新しい仕組みが要るか(ponytail)

- 階段の2段目で止まる。`isInterfaceLike`・`isAbstractLike`・`extendsChainIds` 相当の鎖のたどり方・`reachableParentIds`(`interfaceContracts.ts` 53〜66行目)は既にある。
  新しい型・新しい依存・UI変更・操作側のガードは要らない
- ルール名を増やすかは未決事項2(推奨は既存の `contract` に数える。新しいルール名は `ScoreRule`・`score.ts` の並び・`describeScore.ts` の文言・講評まで波及するため)
- Refused Bequest 一般(親のメソッドを使わない継承)の採点は、上級6の再現手順を塞ぐのに要らないので作らない(6章)

## 2. 変更対象ファイル一覧

(未決事項がすべて推奨案で確定した場合)

| 新規/変更 | パス | 層 | 役割 |
|---|---|---|---|
| 変更 | `src/domain/scoring/interfaceContracts.ts` | domain | 借用の判定 `findBorrowedContracts`(非公開)を足し、`findContractViolations` の末尾に連結する。JSDoc を更新 |
| 変更 | `src/domain/scoring/interfaceContracts.test.ts` | domain(テスト) | 4.1のケースを**先に**追加。89〜112行目のテストの Base を抽象役に書き直す(未決事項3) |
| 変更 | `src/infrastructure/stages/advancedStages.test.ts` | infrastructure(テスト) | `describe('advanced-interface-segregation')` の末尾に回帰テストを追加(4.2) |

**読むだけで変更しないファイル**: `src/domain/codebase/Codebase.ts`、`src/domain/codebase/setSuperclass.ts`、`src/domain/scoring/score.ts`、
`src/domain/stage/sampleAnswer.ts`、`src/infrastructure/stages/advancedStages.ts`。

**触らないファイル**: `src/application/**`、`src/presentation/**`(未決事項2で新ルール名を選んだ場合は `describeScore.ts` が加わる)、`e2e/**`、
`stageCatalog.test.ts`、ステージ定義本体、`docs/specs/` の既存仕様書。

## 3. データ/型の変更

なし(推奨案の場合)。`Codebase`・`CodeClass`・`ScoreRule`・`findContractViolations` の戻り値の形(`string[]`、1件 = 1要素)はそのまま。
借用1件は**借りている子クラスのID**で表す(実装漏れと同じ。`score-deduction-locations` の内訳表示にそのまま出る)。

未決事項2で新ルール名を選んだ場合のみ: `ScoreRule` に `'borrowed-contract'` を足し、`scoreCodebase` の並びは `'contract'` の直後、
`describeScore.ts` の文言は「具象クラスからの実装の借用」。

## 4. TDD対象の純粋関数

### 4.1 借用の判定 — `interfaceContracts.ts`

外から見える関数は `findContractViolations` のまま(未決事項2が推奨案の場合)。非公開の `findBorrowedContracts(codebase): string[]` を足す。規則:

- 対象: `isInterfaceLike` でないクラス C(出現順)
- 調べる契約: C から `parentIds`(extends + implements)をたどって届く先祖のうち `isInterfaceLike` なもの(既存の `reachableParentIds` を使う)の契約メソッド名。
  同じ名前は1回だけ数える(重複除去)
- 各契約名 m について:
  - C 自身が m を持てば対象外(上書き・実装している)
  - C の extends の先祖(C自身を除く、近い順)で、m を最初に持つクラス P を探す。見つからなければ対象外(実装漏れの担当)
  - P が `isInterfaceLike` なら対象外(`extends-interface-loophole` の担当)、`isAbstractLike` なら対象外(抽象の基底から受け継ぐのは正当)
  - それ以外(P が具象)なら **C のIDを1件**
- 並び: クラスの出現順 → 契約名の初出順
- 輪になった extends・削除済みの `superclassId` は訪問済み/見つからないで止まり、落ちない
- 次のコメントを残す:
  `// ponytail: 抽象かどうかは isInterfaceLike / isAbstractLike で推すだけ(abstract を表す項目が無い)。protected の空宣言を足して抽象役に見せかける手は塞がない。abstract を表せるようになったらそれで見る`

実装の目安(拘束しない): 鎖を近い順に歩いて「m を最初に持つ先祖」を返す小さな関数(例: `nearestOwnerOf(codebase, classId, name): CodeClass | undefined`)を足し、
ループはそれを呼ぶだけにする。lint(循環的複雑度12・ネスト4段・60行)に収める。`as`・`!` は使わない。

テスト(`describe('findContractViolations')` に追加。既存ヘルパー `contractMethod`・`realMethod`・`codebaseOf` を使う。AAA):

1. **正常系(本件の中心、今は Red)**: I(`a`・`b`)、具象 P(I を implements、`a`・`b` を持つ)、C(P を extends、I を implements、`a` だけ持つ)→ `['class-c']`
2. 正常系(今は Red): 1 で C が implements を持たない(P 経由で I に届く)→ `['class-c']`
3. 正常系(今は Red): C が `a`・`b` どちらも持たない → `['class-c', 'class-c']`
4. 正常系: C が `a`・`b` を両方自分で持つ → `[]`(上書きは借用ではない。172〜188行目と同じ向き)
5. 正常系: P が抽象役(`isAbstractLike`。protected の空メソッドを1つ持つ)なら、C が `b` を受け継いでも `[]`
6. 境界(今は Red): `C extends Q extends P`、Q は具象で `a` だけ、P は具象で `a`・`b`、C は何も持たない → C は `a`(Q から)・`b`(P から)の2件、Q は `b`(P から)の1件。
   並びは出現順(`codebaseOf` に渡した順)で確かめる
7. 境界: m を最初に持つ先祖が抽象役で、さらに遠い先祖が具象でも同名を持つ → 数えない(近い方で決める)
8. 境界: 先祖のどれも m を持たない → 借用では数えない(実装漏れ1件だけ出る)
9. 境界: 契約に関係ない具象の親のメソッド(`run` など)を受け継ぐだけ → `[]`(上級1・5の形)
10. 異常系: `superclassId` が削除済みのIDを指す / extends が輪になっている → 落ちずに終わる
11. 既存テストは 89〜112行目(未決事項3で書き直す)を除き、**変更せずに**通る

### 4.2 上級6の回帰テスト — `advancedStages.test.ts`

`describe('advanced-interface-segregation')` の末尾に1件。`applySolutionSteps`(`sampleAnswer.ts`)と `SolutionStep` で書く。

- テスト名(例): 「空実装を消して ChatworkClient を継承元にしても、具象クラスからの借用で100点にならない」
- Arrange: 1章の8手(`deleteMethod` ×5 → `setSuperclass` ×3、継承元は `ChatworkClient`)
- Assert(推奨案の場合): `total` が **50**、`count > 0` の内訳が `[{ rule: 'contract', count: 5, points: 50 }]` だけ
  (Slack・Teams が2件ずつ、Backlog が1件。初期状態のテスト 428〜438行目と同じ書き方)
- **実装より先に書いて走らせ、今の実装では `total: 100` で落ちることを確かめる**(抜け道の実測。PRの説明に結果を書く)

## 5. 受け入れ基準

- [ ] 4.1・4.2のテストが先に追加され、修正前は 4.1 の1・2・3・6 と 4.2 が落ち、4.2 の失敗メッセージで今の実装が100点を返すことを確かめている(PRの説明に記載)
- [ ] 修正後、`npm run check` が通る。`domain` のカバレッジ閾値を割らない
- [ ] 上級6で1章の8手を踏むと50点(`contract` 5件)になる
- [ ] `stageCatalog.test.ts` の全ステージの「初期状態では減点がある」「模範解答どおりに操作すると100点になる」と `shortcuts` 全件、
      `advancedStages.test.ts` の既存テストが**書き換えずに**通る
- [ ] `findContractViolations` の JSDoc に「具象の先祖からの契約の借用」が加わっている。4.1 の `// ponytail:` コメントが残っている
- [ ] `src/application/`・`src/presentation/`・`e2e/`・`stageCatalog.test.ts`・ステージ定義本体に差分が無い(推奨案の場合)
- [ ] 操作・画面を変えないので E2E は追加しない

## 6. スコープ外

- Refused Bequest 一般(親のメソッドを使わない・上書きしてばかりの継承)の採点
- 上級3で Premium・Vip を Regular の子にして implements を省く形(借用ではない。未決事項1で B を選んだ場合のみ扱う)
- protected の空宣言を足して具象クラスを抽象役に見せかける手(4.1 の `// ponytail:` コメント。abstract を表す項目ができたら見直す)
- 操作側のガード(`setSuperclass`・`availableParents` で具象クラスを継承元に選べなくする)、ヒント表示
- `extends-interface-loophole` の実装内容(本件は `findMissingImplementations` を触らない)
- 講評(`workers/critique/`)・`describeScore.ts` の文言の変更(未決事項2で新ルール名を選んだ場合を除く)
- `stageCatalog.test.ts` の `shortcuts` への追記(回帰テストは `advancedStages.test.ts` に置く)

## 7. 衝突・意味上の依存

| 件 | 影響 |
|---|---|
| `extends-interface-loophole`(未実装) | 同じ `interfaceContracts.ts` を触るが、あちらは `findMissingImplementations`・`extendsChainMethodNames`、本件は新しい関数の追加と `findContractViolations` の連結だけ。判定も「最も近く m を持つ先祖がインターフェース役か具象か」で分かれて二重に数えない。どちらが先でもテキスト衝突は `findContractViolations` の1行程度 |
| `template-method-stage` | OrderImporter は `isAbstractLike` で、インターフェースも絡まないので影響なし |
| `score-deduction-locations` | 戻り値の形を変えないので、借用(子クラスID)はそのまま内訳に出る |

## 未決事項

### 未決事項1: 何を「借用」として減点するか

- 選択肢A(推奨): **契約メソッドを具象の先祖から受け継いでいる**ときだけ、借りた契約メソッド1つにつき1件。上級6の8手が50点になる。上級1・5・8には当たらない
- 選択肢B: Aに加えて、**同じインターフェースを実装する具象クラスを継承している**クラスも1件(Premium extends Regular のような「兄弟を親にする」形)。上級3の形も塞がるが、
  `interfaceContracts.test.ts` 172〜188行目(G extends 具象 Base、x を上書き)も減点に変わり、正当な「具象の基底を部分的に上書き」まで減点する
- 選択肢C: 1クラスにつき1件(借りた契約メソッドの数によらない)。上級6の8手は 3件 = 70点

### 未決事項2: 既存の `contract` に数えるか、新しいルール名にするか

- 選択肢A(推奨): 既存の `contract`(インターフェースの約束違反)に数える。型・画面・講評の変更なし。内訳では実装漏れと区別できない
- 選択肢B: 新しいルール `'borrowed-contract'`(「具象クラスからの実装の借用」)を足す。内訳で理由が分かるが、`ScoreRule`・`score.ts`・`describeScore.ts`・`score.test.ts` まで変更が広がる

### 未決事項3: `interfaceContracts.test.ts` 89〜112行目「extendsの先祖が持っていれば数えない」をどう扱うか

本件の8手後と構造が同じため、そのままでは必ず落ちる。

- 選択肢A(推奨): テストの Base に protected の空メソッドを1つ足して抽象役(`isAbstractLike`)にし、期待値 `[]` と意図(抽象の基底からの受け継ぎは正当)を残す。具象の場合は4.1の1で減点を確かめる
- 選択肢B: Base は具象のまま期待値を `['class-c']` に変え、抽象役のケースは4.1の5だけで確かめる
- 選択肢C: 判定を全ステージ共通にせず、ステージに「具象クラスの継承を借用として見る」項目を足して上級6だけで有効にする(既存テストは変えずに済むが、`Stage` 型・ステージ定義に変更が広がる)
