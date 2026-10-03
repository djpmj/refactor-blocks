# 複数インターフェースの実装と、上級6「太ったインターフェースを役割ごとに分ける」(ISP)

## 背景・目的

上級2(DIP)・上級3(Strategy)で「インターフェースを実装する」形は練習できる。ただ、インターフェースを**大きくしすぎたとき**の
痛みはまだ体験できない。実務でよく見るのは、1つのインターフェースに役割の違うメソッドを詰め込み、実装クラスが使わない
メソッドを「未対応」の例外や空実装で潰している状態。インターフェースのメソッドが1つ変わるたびに、それを使わないクラスまで直すことになる。

インターフェース分離の原則(ISP)は次の2つで表す。

- **実装クラスに使わないメソッドを書かせない**: 役割ごとの小さいインターフェースに分け、両方の役割を持つクラスは**両方を実装する**
- **クライアントには必要なインターフェースだけに依存させる**: チャットだけ使うクライアントはチャットのインターフェースに、タスク管理だけ使うクライアントはタスク管理のインターフェースに依存する

1つ目の後半(1クラスが複数のインターフェースを実装する)は今のモデル(`superclassId` が1つだけ)では表せない。
ユーザーの決定により、**1クラスが extends 1つ + implements 複数を持てるようにモデルを広げる**。

### 決定事項(ユーザー確認済み)

1. 複数実装にモデルを広げる(影響範囲はすべて対象)
2. 空実装(`stub`)の減点は1件 -10。上級6の初期は50点
3. 約束違反(`contract`)ルールは**全ステージで有効**。ステージ単位のフラグは作らない

## 実装の段階

規模が大きいので3段階に分ける。**どの段階も終えた時点で `npm run check` と `npm run test:e2e` が通る**こと。

| 段階 | 内容 | ステージの見た目の変化 |
| --- | --- | --- |
| **A. 複数実装のモデルとUI** | `interfaceIds` の導入、既存データ・テスト・解答例の移行、実装の追加/解除の操作、ホバーサブメニューのチェック式、ラベル・矢印・講評データ | なし(既存ステージの点数・模範解答は変わらない) |
| **B. 空実装・Delete Method・約束違反** | `Fragment.stub`、`stub` ルール、Delete Method、`contract` ルール(全ステージ)、上級2 PayPay 依頼の部品名の変更 | 上級2の初期点が下がる(下の一覧) |
| **C. 上級6ステージ** | ステージ定義・模範解答・ヒント・変更依頼・近道テスト・E2E | 上級6が増える |

---

## A. 複数実装のモデルとUI

### データ表現の比較(推奨: 案1)

| 案 | 形 | 良い点 | 悪い点 |
| --- | --- | --- | --- |
| **1. 分ける(推奨)** | `superclassId?: string`(extends 専用)+ `interfaceIds?: readonly string[]`(implements)。`superclassKind` は削除 | 「extends は1つまで・implements は複数」が型でそのまま表せる。extends しか見ない処理(`loneSuperclass`・`promoteCalledPrivateMethods`)は `superclassId` だけ見ればよい | 既存の `superclassKind` の読み書きをすべて置き換える(型エラーで漏れなく見つかる) |
| 2. 今の形 + 追加フィールド | `superclassId` + `superclassKind` はそのまま、`extraInterfaceIds` を足す | 既存コードの変更が少なく見える | implements が2か所(`superclassKind: 'implements'` の `superclassId` と `extraInterfaceIds`)に分かれ、読む側が毎回両方を合わせる必要がある。どちらに入れるかの規則も要る |
| 3. 親の配列 | `parents: readonly { id: string; kind: 'extends' \| 'implements' }[]` | 一般的 | 「extends は1つまで」を型で表せず、すべての操作で検証が要る。読む側が毎回 kind で絞る |

案2は「implements の表し方が2通りある」状態を作り、将来のバグの元になる。案3は制約を型で守れない。**案1を採る。**

### 型の変更(`domain/codebase/Codebase.ts`)

```ts
export type CodeClass = {
  readonly id: string;
  readonly name: string;
  readonly methods: readonly Method[];
  /** 継承元(extends)のクラスID。継承なしなら省略する。 */
  readonly superclassId?: string;
  /** 実装しているインターフェース(implements)のクラスID。宣言順。省略は [] と同じ。 */
  readonly interfaceIds?: readonly string[];
};
```

`superclassKind` は削除する。足すヘルパー:

```ts
/** 親(継承元 → 実装先の宣言順)のID。存在しないIDもそのまま返す(呼び出し側で findClass して捨てる)。 */
export function parentIds(codeClass: CodeClass): string[];

/** 実装しているインターフェース。削除済みで見つからないIDは飛ばす。 */
export function findInterfaces(codebase: Codebase, classId: string): CodeClass[];

/** インターフェース役 = メソッドが1つ以上あり、すべて public で中身(Fragment)がない。 */
export function isInterfaceLike(codeClass: CodeClass): boolean;
```

- `findSuperclass` は変えない(`superclassId` だけを見る。これで「継承元」の意味になる)
- `isInterfaceLike` は `domain/change/measurePlacement.ts` からここへ移し、条件に「すべて public」を足す(インターフェースに private メソッドはないため。
  `score.test.ts` のフィクスチャの「中身のない private メソッドだけのクラス」が、B の約束違反に引っかからないようにする効果もある)。
  `measurePlacement.ts`・`sampleImplementation.ts` は import 先を変える

### 既存データの移行

| 対象 | 今 | 移行後 |
| --- | --- | --- |
| `infrastructure/stages/advancedStages.ts` 上級5 `CsvExporter` | `superclassId` + `superclassKind: 'extends'` | `superclassKind` の行を消す |
| 初期状態で implements を使うステージ | なし(上級2・3は模範解答で implements する。上級4は継承を使わない) | — |
| `domain/stage/sampleAnswer.ts` 上級2・上級3 | `setSuperclass: { ..., kind: 'implements' }` | `addInterface: { class, interface }` |
| `infrastructure/stages/stageCatalog.test.ts` の上級5の近道「継承を implements に書き換える」 | `setSuperclass: { ..., kind: 'implements' }` | `setSuperclass: { ..., superclass: null }` と `addInterface` の2手 |
| `domain/change/sampleImplementation.ts`(変更依頼の解答例) | 新クラスに `setSuperclass(..., 'implements')` | `addInterface` |
| 白紙設計の問題(`infrastructure/blankDesigns/`)・設計くらべ(`infrastructure/quizzes/`) | 継承・実装を使っていない | 変更なし |
| 進捗の保存(`infrastructure/progress/`) | stage.id と点数だけでコードは保存しない | 移行不要 |
| テストのフィクスチャ(`superclassKind` を書いているもの) | `superclassKind: 'implements'` | `interfaceIds: [...]`。`'extends'` は行を消す |

`superclassKind` を型から消せば、読み書きしている箇所は `npm run typecheck` ですべて出る。

### 操作(`domain/codebase/`)

#### `setSuperclass`(変更: extends 専用にする)

```ts
export type SetSuperclassError = 'class-not-found' | 'superclass-not-found' | 'self-inheritance' | 'inheritance-cycle' | 'already-related';
export function setSuperclass(codebase: Codebase, classId: string, superclassName: string | null): Result<Codebase, SetSuperclassError>;
```

- 第4引数 `kind` を削除する。`superclassId` だけを設定・解除する
- 相手がすでに `interfaceIds` に入っている → `err('already-related')`(同じクラスを extends と implements の両方にはしない)
- 循環の判定(`reachesSelf`)は `parentIds` をすべてたどる(深さ優先・訪問済みで止める)。「A が B を実装し、B が A を継承」も輪として弾く
- `promoteCalledPrivateMethods` は今までどおり(extends のときだけ)

#### `addInterface` / `removeInterface`(新規。`setSuperclass.ts` に並べて置く)

```ts
export type AddInterfaceError = 'class-not-found' | 'interface-not-found' | 'self-inheritance' | 'inheritance-cycle' | 'already-related';
export function addInterface(codebase: Codebase, classId: string, interfaceName: string): Result<Codebase, AddInterfaceError>;

export type RemoveInterfaceError = 'class-not-found' | 'interface-not-found';
export function removeInterface(codebase: Codebase, classId: string, interfaceName: string): Result<Codebase, RemoveInterfaceError>;
```

- 相手は名前で指定する(`setSuperclass` と同じ規則。前後の空白は trim)
- `addInterface`: 末尾に足す。すでに実装しているなら `ok(codebase)`(何もしない)。相手が継承元なら `already-related`。循環なら `inheritance-cycle`
- `removeInterface`: 実装していなければ `ok(codebase)`(何もしない)。外したあと `interfaceIds` が空なら、プロパティごと消す(`classContent` の比較で「元に戻した」が同じになるように)
- 相手が `isInterfaceLike` でなくても実装できる(TypeScript はクラスを implements できる。今のE2E「`TaxCalculator` implements `OrderService`」を壊さない)

#### `availableSuperclasses` → `availableParents`(改名)

自分自身と、選ぶと輪になるクラスを除いた候補。どちらのサブメニューでも使い、画面側で「もう一方の関係の相手」を除く。

### 変更が必要な読み手

| 場所 | 変更 |
| --- | --- |
| `domain/scoring/loneSuperclass.ts` | `superclassKind` の判定を消し、`superclassId` だけで数える(意味は同じ) |
| `domain/change/measurePlacement.ts` | `classContent`: `superclassKind` の代わりに `interfaceIds` を**並べ替えて**比較に入れる(付けて外して付け直しても同じ中身)。`existingAncestors`: 一本道ではなく `parentIds` の幅優先(継承元 → 実装先の宣言順、訪問済みで止める)。「一番近い既存の先祖」はその順の先頭 |
| `domain/change/sampleImplementation.ts` | 新クラスへの `setSuperclass(..., 'implements')` を `addInterface` に |
| `domain/critique/critiqueRequest.ts` | `CritiqueClassSummary` の `superclassKind` を削除し、`superclassName`(継承元のみ)と `interfaceNames?: readonly string[]`(1つ以上あるときだけ)にする |
| `domain/stage/sampleAnswer.ts` | `setSuperclass` の `kind` を削除。`addInterface: { class, interface }` / `removeInterface: { class, interface }` を足す |
| `presentation/stage/describeSolutionStep.ts` | `addInterface`:「X が実装するインターフェースに Y を追加しよう(右クリック →「実装するインターフェースを設定」)」、`removeInterface`:「X の implements から Y を外そう」。`setSuperclass` の「(実装)/(継承)」の出し分けを消す |
| `application/RefactorUseCases.ts` | `setSuperclassUseCase` から `kind` を削除。`addInterfaceUseCase` / `removeInterfaceUseCase` とエラー文言(`already-related`:「すでに継承元または実装先になっています」、`interface-not-found`:「その名前のクラスが見つかりません」ほか既存と同じ文言)を足す |
| `presentation/store/useGameStore.ts` | `setSuperclass(classId, name)`(kind 削除)、`addInterface(classId, name)`、`removeInterface(classId, name)`。どれも `apply` を通して履歴に積む |
| `presentation/canvas/SuperclassLabel.tsx` | `{ superclassName?: string; interfaceNames: readonly string[] }` を受け、`" extends A implements B, C"` を出す(どちらか片方だけのときはその部分だけ)。名前は `RelationLabel` に変えてよい |
| `presentation/canvas/ClassNode.tsx`・`presentation/preview/PreviewClassNode.tsx` | 上のラベルに継承元と `findInterfaces` の名前を渡す |
| `presentation/canvas/layoutCodebase.ts` | `fileDependencyGraph`・`topLanesByEdgeId`・`inheritanceEdges` の3か所で `superclassId` の代わりに `parentIds` を回す(存在しないIDは今までどおり捨てる)。辺のIDは `inherit-<子>-<親>` のまま(E2Eが使っている)。見た目は継承と共通 |
| `presentation/canvas/CanvasContextMenu.tsx` | 下記 |

#### ホバーサブメニュー(`CanvasContextMenu.tsx`)

- 「継承元を設定」: 今のまま(候補は `menuitem`、今の継承元に `aria-current`、「(解除)」あり)。候補から実装先のクラスを除く
- 「実装するインターフェースを設定」: **チェック式**にする
  - 候補は `role="menuitemcheckbox"`、実装中のものは `aria-checked="true"`、見た目にもチェック(✓)を付ける。候補から継承元のクラスを除く
  - 押すと、チェックなし → `addInterface`、チェックあり → `removeInterface`。成功してもメニューは開いたままにし、続けて別のインターフェースを付け外しできるようにする(Esc・外側クリックで閉じる。ユーザー決定)
  - 「(解除)」は置かない(チェックを外せば解除になる)
  - キーボード: 今と同じく Tab / フォーカスで開き、Enter / Space で切り替えられる(ネイティブの `<button>`)

### TDD対象(段階A)

すべて Vitest・AAA でテストを先に書く。

- `parentIds`: 継承元 → 実装先の順。どちらもなければ空
- `findInterfaces`: 宣言順。削除済みのIDは飛ばす
- `isInterfaceLike`: 既存の `measurePlacement.test.ts` のケース + 「中身のない private メソッドだけのクラスは false」
- `setSuperclass`: `kind` を使っていた既存テストを `addInterface` 側へ移す。実装先を継承元にしようとすると `already-related`。実装先経由の輪を `inheritance-cycle` で弾く
- `addInterface`: 2つ目を足すと `interfaceIds` が2要素(順番どおり)/ 同じものをもう一度 → 変化なし / 継承元を指定 → `already-related` / 自分 → `self-inheritance` / 輪 → `inheritance-cycle` / 名前なし → `interface-not-found` / 元の Codebase を変更しない
- `removeInterface`: 2つのうち1つだけ外れる / 最後の1つを外すと `interfaceIds` プロパティがなくなる / 実装していない相手 → 変化なし
- `availableParents`: 実装先経由で輪になる候補を除く
- `findLoneSuperclasses`: 既存のケース(implements の子は数えない)を新しい形で書き直して通す
- `measurePlacement`: 既存ケースを新しい形で通す + 「新クラスが呼ばれていないインターフェースと呼ばれているインターフェースの両方を実装」→ 宣言順の先頭が既存の先祖になり、既存ルールどおりに判定される + 実装先の付け外しで元に戻したら触っていない扱い
- `buildCritiqueRequest`: 2つ実装しているクラスで `interfaceNames` が2要素、継承元だけのクラスでは `interfaceNames` がない
- `applySolutionSteps`: `addInterface` / `removeInterface` のステップ
- `layoutCodebase.test.ts`: 2つ実装しているクラスで `inheritanceEdges` が2本(IDは `inherit-<子>-<親>`)

### E2E(段階A)

- 既存テストの更新: 「実装するインターフェースを設定」で候補を選んでいるテスト(`implements OrderService`、`solvePaymentStage`、上級2の PayPay、ほか grep で見つかるもの)は `getByRole('menuitemcheckbox', ...)` にする
- 追加:「1つのクラスに2つのインターフェースを実装すると、"implements A, B" と矢印2本が出て、チェックを外すと1つ外れる」
  (チュートリアル2など既存ステージのクラスを使う。`aria-checked` も確かめる)

### 受け入れ基準(段階A)

- `npm run check` と `npm run test:e2e` が通る。`superclassKind` への参照が `src/` に残っていない
- 既存の全ステージで `stageCatalog.test.ts` の共通テスト(模範解答で100点・近道が100点未満ほか)が通り、初期点が変わらない

---

## B. 空実装・Delete Method・約束違反

### 型の変更

`Fragment`(`Codebase.ts`)に足す:

```ts
/**
 * インターフェースの都合で書かされただけの空実装(何もせず return する・「未対応」の例外を投げるだけ)であることを示す隠しタグ。
 * responsibility・duplicateGroup と同じくプレイヤーには表示しない(ラベルに「未対応: …」と書く)。省略時は通常の処理。
 */
readonly stub?: boolean;
```

`responsibility` は本物の処理と同じ値にする(インターフェースの引数が変われば空実装も直すので、変更依頼の変更箇所に数えるのが実態どおり)。

`Codebase.ts` に足す:

```ts
/** 空実装のメソッド = 処理が1つ以上あり、すべて stub。中身のない契約メソッド(fragments: [])は空実装ではない。 */
export function isStubMethod(method: Method): boolean;
```

`ScoreRule`(`score.ts`)に `'stub' | 'contract'` を足す。並びは `'lone-superclass'` の後ろに `'stub'`、`'contract'`。どちらも1件 -10。フラグなしで全ステージ。

`SolutionStep`(`sampleAnswer.ts`)に足す:

```ts
| { readonly move: { readonly method: string; readonly toClass: string; /** 同名メソッドが複数クラスにあるときの移動元 */ readonly fromClass?: string } }
| { readonly deleteMethod: { readonly method: string; readonly fromClass: string } }
```

`CritiqueMethodSummary` に `readonly stub?: true`(空実装のときだけ付ける)。

### TDD対象(段階B)

#### `isStubMethod`

- すべて stub → true / stub と通常が混在 → false / `fragments: []` → false

#### `deleteMethod(codebase, methodId): Result<Codebase, DeleteMethodError>`(新規 `domain/codebase/deleteMethod.ts`)

`DeleteMethodError = 'method-not-found' | 'not-stub'`

- 空実装を消せる。他は変わらない。元の Codebase を変更しない
- 存在しないID → `method-not-found`
- 通常の処理を持つ・契約メソッド(`fragments: []`) → `not-stub`(本物の処理を消して行数・責務の減点を逃れる抜け道を塞ぐ)

「インターフェースが要求しているので消せない」ガードは作らない。実装先の付け外しで簡単にすり抜けられるので、操作ではなく状態(`contract` の実装漏れ)で判定する。
空実装は呼ばれない前提(クライアントは契約メソッドを呼ぶ)なので、呼ばれているかは見ない。上級6の定義で空実装が `uses` に出てこないことをステージのテストで確かめる。

#### `findStubMethods(codebase): string[]`(新規 `domain/scoring/interfaceContracts.ts`)

`isStubMethod` なメソッドのIDを出現順に返す。

#### `findContractViolations(codebase): string[]`(同ファイル)

次の3種類をまとめて返す(1件 = 1要素。`fileDeductions` が持ち主のファイルを引けるIDにする)。3種類ごとに小さな関数に分ける。

1. **実装漏れ**: クラスが `interfaceIds` で実装している `isInterfaceLike` なクラスのメソッド名のうち、自分と extends の先祖のどれも同名のメソッドを持たないもの1つにつき、**実装クラスのID**。
   空実装も「持っている」に数える(空実装は `stub` で数える)
2. **インターフェースの外の契約メソッド**: `isInterfaceLike` でないクラスが持つ、public で `fragments: []` のメソッドのID
   (契約メソッドを具象クラスへドラッグして、実装クラス側の要求を消す抜け道を塞ぐ)
3. **実装の宣言漏れ**: `isInterfaceLike` でないクラスが、ある `isInterfaceLike` なクラスの契約メソッドと同名の public メソッドを持つのに、
   `parentIds` をたどってもそのインターフェースに届かないとき、1インターフェースにつき**そのクラスのID**
   (「implements を外して空実装を消す」「両方の役割を持つのに片方しか実装しない」を捕まえる)

`// ponytail: 実装しているかは名前だけで見る(引数の型は持っていない)。別々のインターフェースに同名の契約があると過剰に数える。そういう題材を作るときに見直す` を残す。

ケース:

- 実装先の契約をすべて同名で持つ → 空
- 契約2つのうち1つがない → 実装クラスのIDが1つ。空実装で持っていれば数えない。extends の親が持っていれば数えない
- `isInterfaceLike` でない相手を実装 → 実装漏れを見ない(今のE2Eの `TaxCalculator implements OrderService` のような形)
- 具象クラスの public な中身なしメソッド → そのメソッドID。private なら数えない
- 契約と同名の public メソッドを持つのにそのインターフェースを実装していない → そのクラスのID。継承元がそのインターフェースを実装していれば数えない
- インターフェース役のクラス自身は 3 の対象にしない
- 削除済みの実装先IDは無視する(落ちない)

#### `scoreCodebase` / `fileDeductions` / `buildCritiqueRequest` / `applySolutionSteps` / `deleteMethodUseCase`

- `scoreCodebase`: 空実装1つで `stub` -10、実装漏れ1つで `contract` -10。内訳の並びの期待値を10ルールに更新
- `fileDeductions`: `stub` と `contract` を含める(空実装はそのメソッドのファイル、実装漏れ・宣言漏れは実装クラスのファイル)
- `buildCritiqueRequest`: 空実装だけ `stub: true`、ほかはキーなし
- `applySolutionSteps`: `move.fromClass` で同名メソッドのうち指定クラスのものが移る / `deleteMethod` で指定クラスの空実装が消える
- `deleteMethodUseCase`: 薄いラッパー。`describeDeleteMethodError`: `method-not-found` →「削除するメソッドが見つかりません」、`not-stub` →「中身のあるメソッドは削除できません。削除できるのは空実装のメソッドだけです」

### 画面(段階B)

- `MethodEditor.tsx`: 選択中のメソッドが `isStubMethod` のときだけ「空実装のメソッドを削除」ボタン(`<button type="button">`)を「呼び出し元へ戻す」と同じ並びに出す。失敗時は既存の `message`(`role="alert"`)
- `useGameStore.ts`: `deleteMethod(methodId)`。`apply` を通して履歴に積む(Ctrl+Z で戻せる)。消したメソッドが選択中なら `selectedMethodId` を `null` にする
- `describeScore.ts`: `stub: '使わないメソッドの空実装'`、`contract: 'インターフェースの約束違反'`
- `describeSolutionStep.ts`: `move.fromClass` があるとき「X の m をMove Methodで Y へ移そう」、`deleteMethod`:「X の m はもう実装しなくてよい空実装なので、メソッドエディタの『空実装のメソッドを削除』で消そう」

### `contract` を全ステージで有効にしたときの影響

#### 既存ステージの初期点と100点到達(実装時に実測して表を直す)

`stub` タグは上級6にしかない。`contract` が反応するのは `isInterfaceLike` なクラス(上級2の `PaymentGateway`、上級3の `DiscountStrategy`)があるステージか、
プレイヤーが中身なしメソッドを動かしたときだけ。

| ステージ | 初期点(今 → 後) | 理由 | 模範解答で100点 |
| --- | --- | --- | --- |
| 上級2 決済ゲートウェイ | 80 → **60** | `StripeGateway`・`PaypalGateway` が `PaymentGateway` と同名の `charge` を持つのに実装を宣言していない(宣言漏れ ×2)。このステージの狙いそのものなので、減点として見えるのは正しい | ○(両方 `PaymentGateway` を実装し `charge` を持つ) |
| 上級3 割引 Strategy | 変わらない | 初期に `calculate` を持つ具象クラスがない。途中で `calculate` を抽出して実装を宣言するまでは宣言漏れが出る(正しい途中経過) | ○ |
| 上級5 継承を畳む | 変わらない | `BaseExporter` はインターフェース役ではない。近道「implements に書き換える」は循環依存で100点未満のまま | ○ |
| チュートリアル・初級・中級・上級1・上級4 | 変わらない | インターフェース役のクラスがない | ○ |
| 白紙設計・設計くらべ | 変わらない | 問題にインターフェース役がない(プレイヤーが作れば判定される) | — |

`stageCatalog.test.ts`・`advancedStages.test.ts`・`volatilityStages.test.ts` で上級2の初期点を固定値で見ているテストがあれば更新する(実装者が grep で確認)。
`score.test.ts` の「中身のない private メソッド」のフィクスチャは、`isInterfaceLike` が public を条件にし、2 が public だけを数えるので影響しない。

#### 上級2「PayPayでも払えるようにして」(extend)で正解の置き方に ⚠ が出る問題

今の部品名は `chargeWithPaypay`。新クラスで `PaymentGateway` を実装すると、`charge` の実装漏れになり、キャンバスのファイルに ⚠ が出る
(置き方の点数は100点なのに、コードとしては実装漏れ、という食い違い)。

**対処: 部品名を契約メソッドと同じ `charge` にする。** 本当のコードでも PayPay の実装クラスは `charge` を実装するので、これが正しい形。

- `advancedStages.ts`: `req-add-paypay` の `partName` を `'charge'` に
- `stageCatalog.test.ts`:「`partName` が初期コードのメソッド名と重ならない」を **modify の依頼だけ**に絞る。extend の依頼は「初期コードのどれかのインターフェース役の契約名と同じか、どのメソッド名とも重ならない」を確かめる
- 副作用(どれも望ましい方向):
  - 部品を `StripeGateway`・`PaypalGateway`・`PaymentGateway` に落とすと「同じ名前のメソッドがあります」で止まる。`implement-change-request.md` の未決事項「部品を `PaymentGateway` に直接置くと90点」の抜け道も塞がる
  - `sampleImplementation` の候補から上の3クラスが外れる(`moveMethod` が失敗して飛ばされる)。解答例は変わらず「PaymentGateway を実装する新しいクラス」
- `advancedStages.test.ts` の「`StripeGateway` へ置くと `open-closed` が1」を「`PaymentService` へ置くと `open-closed` が1」に書き換える
- E2E: `method-chargeWithPaypay` を使っている2本(PayPay の依頼、依頼の積み重ね)は、同名の `charge` が複数あるので `class-部品置き場` / `class-NewClass` の中に絞って指定する。
  `dragToEmptyCanvas` は testId 文字列しか受けないので、Locator も受けられるようにする(または部品置き場のクラスで絞った testId を使う)

却下した対処: 「変更依頼の実装中はファイルの ⚠ を出さない」は、他の違反の印まで消えて手がかりが減る。「部品は約束違反の判定から外す」は、ドメインの採点が変更依頼の事情を知ることになり層がにごる。

#### 変更依頼の途中の状態

- 画面上部の点数と進捗は今までどおり挑戦前のコード(`changeSession.base`)で数えるので、実装中の途中状態で点数や進捗は変わらない
- キャンバスのファイルの ⚠(`FileNode`)は実装中のコードで数えるので、「部品を余白に出したが、まだ実装を宣言していない」間は、部品名が契約名と同じなら宣言漏れの ⚠ が出る。
  宣言すれば消える。途中経過として正しいので、そのままにする
- 置き方の採点(`scorePlacement`)には `contract` を入れない(スコープ外)

### E2E(段階B)

段階Cの上級6で行う(空実装を持つステージが上級6だけのため)。段階Bでは上の PayPay の2本の更新だけ。

### 受け入れ基準(段階B)

- `npm run check` と `npm run test:e2e` が通る
- 上の影響一覧のとおり、上級2以外の既存ステージの初期点が変わらず、全ステージが模範解答で100点、既存の近道が100点未満のまま
- 上級2の PayPay の依頼で、新クラスに `PaymentGateway` を実装すると置き方100点で、キャンバスに ⚠ が出ない

---

## C. 上級6ステージ

### 題材

障害対応の連絡を自動化するため、チャット(Slack・Teams)と課題管理(Backlog)と、その両方ができる Chatwork をまとめて扱う
`CollaborationTool` インターフェースを作った。

- `SlackClient`・`TeamsClient` はタスク管理ができないので `createTask`・`completeTask` を「未対応」で潰している
- `BacklogClient` はチャットに投稿できないので `postMessage` を空実装で潰している
- `ChatworkClient` はメッセージもタスクも本当に扱える(**分けたあと2つのインターフェースを実装するクラス**)
- クライアントの `AlertNotifier` は投稿だけ、`IncidentService` はタスク管理だけを使うのに、どちらも太った `CollaborationTool` に依存している

プレイヤーは `CollaborationTool` を `ChatClient`(投稿)と `TaskTracker`(タスク管理)に分け、各クラスに必要なものだけを実装させ
(Chatwork は両方)、空実装を消す。Move Method で契約メソッドを動かすと、`AlertNotifier → ChatClient`・`IncidentService → TaskTracker` に依存が自動で分かれる。

### ステージ定義(`advancedStages.ts` の末尾)

- id: `advanced-interface-segregation`、level: `'advanced'`、title: `上級6: 太ったインターフェースを役割ごとに分ける`
- ファイル冒頭のコメントに、上級2・3との対比(インターフェースを使う側から、インターフェースの大きさへ)を一言
- description:
  「障害対応の連絡を自動化するため、Slack・Teams・Backlog・Chatwork をまとめて扱う CollaborationTool インターフェースを作った。
  ところが Slack と Teams はタスク管理ができず createTask・completeTask を『未対応』の例外で潰し、Backlog はチャットに投稿できず postMessage を空実装で潰している。
  投稿しか使わない AlertNotifier も、タスクしか使わない IncidentService も、同じ太いインターフェースに依存している。」
- goal:
  「CollaborationTool を、投稿の役割(ChatClient)とタスク管理の役割(TaskTracker)に分けよう。各クラスには本当に使うインターフェースだけを実装させ、
  両方できる ChatworkClient には両方を実装させよう。要らなくなった空実装は、メソッドエディタの『空実装のメソッドを削除』で消そう。依存先は1クラスまで」
- `limits: { method: 90, class: 200, file: 300 }`、`dependencyLimit: 1`、`responsibilityLimit: 3`
  - 3にするのは、空実装の責務で `responsibility` と `stub` が二重に減点されないようにするため(実装クラスは空実装込みで最大3種類)

### 初期コード

| ファイル | クラス | メソッド | 処理(行数, responsibility, その他) |
| --- | --- | --- | --- |
| `src/alert/AlertNotifier.ts` | `AlertNotifier` | `notifyAlert` | アラートの内容から通知文を組み立てる(40, `alert-format`)/ チャットへ投稿する(8, `alert-dispatch`, uses: `method-tool-post-message`) |
| `src/incident/IncidentService.ts` | `IncidentService` | `reportIncident` | 障害の影響範囲と重要度を判定する(60, `triage`)/ 対応タスクを登録する(12, `incident-dispatch`, uses: `method-tool-create-task`)/ 復旧したらタスクを完了にする(10, `incident-dispatch`, uses: `method-tool-complete-task`) |
| `src/integration/CollaborationTool.ts` | `CollaborationTool` | `postMessage` / `createTask` / `completeTask`(public・`fragments: []`、ID `method-tool-post-message` / `method-tool-create-task` / `method-tool-complete-task`) | — |
| `src/integration/SlackClient.ts` | `SlackClient`(`interfaceIds: [CollaborationTool]`) | `postMessage` | Slack APIでチャンネルに投稿する(36, `chat-post`) |
| | | `createTask` / `completeTask` | 未対応: UnsupportedOperationError を投げるだけ(3, `task-create` / `task-complete`, `stub: true`) |
| `src/integration/TeamsClient.ts` | `TeamsClient`(同上) | `postMessage` | Teams のWebhookでチャネルに投稿する(30, `chat-post`) |
| | | `createTask` / `completeTask` | SlackClient と同じ形の空実装(3行ずつ、`stub: true`) |
| `src/integration/BacklogClient.ts` | `BacklogClient`(同上) | `postMessage` | 未対応: 何もせず return する空実装(2, `chat-post`, `stub: true`) |
| | | `createTask` | Backlog APIで課題を登録する(40, `task-create`) |
| | | `completeTask` | Backlog APIで課題の状態を完了にする(20, `task-complete`) |
| `src/integration/ChatworkClient.ts` | `ChatworkClient`(同上) | `postMessage` | Chatwork APIでルームに投稿する(32, `chat-post`) |
| | | `createTask` | Chatwork APIでタスクを登録する(18, `task-create`) |
| | | `completeTask` | Chatwork APIでタスクを完了にする(10, `task-complete`) |

- メソッド・Fragment のIDは既存の命名(`method-…` / `frag-…`)でステージ内に重複させない。空実装のラベルは同じ文言でよい
- すべて public。`reportIncident` は 82 + 2 = 84行で「80行以上のメソッドがある」を満たす
- 初期の減点(実測で確かめる): `stub` 5件のみ → **50点**。結合度は各クライアント1、責務は最大3、`contract` は0(全員が `CollaborationTool` を実装し、契約名を空実装込みで持つ)

### 変更依頼(2件とも modify)

| id | title / description | responsibility | linesPerSite | partName |
| --- | --- | --- | --- | --- |
| `req-task-assignee` | 「障害の対応タスクに担当者を割り当てて」/ タスクを登録するときに担当者を指定できるようにしたい(createTask の引数が増える) | `task-create` | 4 | `assignTaskOwner` |
| `req-thread-reply` | 「アラートをスレッドにまとめて投稿して」/ 同じ障害の続報は、最初の投稿のスレッドに返信したい(postMessage にスレッドIDを渡す) | `chat-post` | 5 | `replyInThread` |

期待値(`measureChange` → `scoreChange`。実測で表を直す):

| 依頼 | 初期 | 模範解答のあと |
| --- | --- | --- |
| `req-task-assignee` | 4クラス(Slack・Teams の空実装 + Backlog + Chatwork)→ 散らばり -30 → 70点 | Backlog・Chatwork → 90点 |
| `req-thread-reply` | 4クラス(Slack・Teams・Chatwork + Backlog の空実装)→ 70点 | Slack・Teams・Chatwork → 80点 |

変更容易性スコア 70 → 85。`classesTouched` [4, 4] → [2, 3](増えない)。
「使わないメソッドでも、インターフェースに付き合わされて直す」ことが散らばりの差として見える。

### 模範解答(`sampleAnswerSteps['advanced-interface-segregation']`)

太ったインターフェースを投稿用に絞って名前を変え、タスク管理を切り出す(Extract Interface)。

```ts
[
  { renameClass: { name: 'CollaborationTool', newName: 'ChatClient' } },
  { renameFile: { path: 'src/integration/CollaborationTool.ts', newPath: 'src/integration/ChatClient.ts' } },
  { addFile: 'src/integration/TaskTracker.ts' },
  { addClass: { name: 'TaskTracker', file: 'src/integration/TaskTracker.ts' } },
  { move: { method: 'createTask', fromClass: 'ChatClient', toClass: 'TaskTracker' } },
  { move: { method: 'completeTask', fromClass: 'ChatClient', toClass: 'TaskTracker' } },
  { addInterface: { class: 'BacklogClient', interface: 'TaskTracker' } },
  { removeInterface: { class: 'BacklogClient', interface: 'ChatClient' } },
  { addInterface: { class: 'ChatworkClient', interface: 'TaskTracker' } },
  { deleteMethod: { method: 'createTask', fromClass: 'SlackClient' } },
  { deleteMethod: { method: 'completeTask', fromClass: 'SlackClient' } },
  { deleteMethod: { method: 'createTask', fromClass: 'TeamsClient' } },
  { deleteMethod: { method: 'completeTask', fromClass: 'TeamsClient' } },
  { deleteMethod: { method: 'postMessage', fromClass: 'BacklogClient' } },
]
```

`SolutionStep` に `renameClass: { name, newName }` / `renameFile: { path, newPath }` を足す(既存の `renameClass` / `renameFile` を呼ぶだけ。ヒント文は
「CollaborationTool の名前を ChatClient に変えよう」「ファイル … の名前を … に変えよう」)。

完成形: `AlertNotifier → ChatClient`、`IncidentService → TaskTracker`。Slack・Teams は `implements ChatClient`、Backlog は `implements TaskTracker`、
Chatwork は `implements ChatClient, TaskTracker`。空実装0・約束違反0で100点。

新しいファイルを2つ作って `CollaborationTool` を消す解き方も100点になる(構造は同じで名前の問題なので許容)。

### ヒント

既存の `HintPanel`(模範解答を1手ずつ `describeSolutionStep` で文にする)をそのまま使う。14手。

### `stageCatalog.test.ts` の `shortcuts` に足すもの(どれも100点未満)

1. インターフェースを分けて実装先も付け替えたが、空実装を消さない(1〜9手)→ `stub`
2. インターフェースを分けずに空実装だけ消す(`deleteMethod` 5手)→ 実装漏れ
3. Slack・Teams・Backlog の `CollaborationTool` の実装を外して空実装を消す(Chatwork だけが実装し続ける)→ 宣言漏れ
4. 分けたが、Chatwork には `ChatClient` しか実装させない(1〜8手 + 空実装の削除)→ 宣言漏れ(Chatwork が `TaskTracker` の契約名を持つ)。**複数実装が必要なことの確認**
5. 契約メソッド `createTask`・`completeTask` を `IncidentService` へ移し、Slack・Teams の空実装を消す → インターフェースの外の契約メソッド
6. Backlog の空実装 `postMessage` を新しいファイルのクラスへ移してからそのファイルを消す → 実装漏れ

### ステージのテスト(`advancedStages.test.ts` に `describe('advanced-interface-segregation')`)

- 初期状態の減点は `stub` の5件だけで50点
- 模範解答のあと: `AlertNotifier` の依存先は `ChatClient` だけ、`IncidentService` は `TaskTracker` だけ
- 模範解答のあと: `findInterfaces` で Chatwork が `['ChatClient', 'TaskTracker']`、Slack・Teams が `['ChatClient']`、Backlog が `['TaskTracker']`。空実装0
- 初期状態で `deleteMethod` を `SlackClient.postMessage`(本物の処理)に当てると `not-stub`
- 空実装のメソッドのIDが、どの Fragment の `uses` にも出てこない
- 変更依頼2件の `classesTouched` が上の表どおり

### E2E(段階C、`e2e/refactor.spec.ts`)

「上級6: 空実装を削除するとまだ要求しているインターフェースへの約束違反になり、取り消すと戻る。実装の宣言を外すと宣言漏れになる」

- 上級6を選ぶと `score` に「使わないメソッドの空実装 -50」
- `class-SlackClient` の `method-postMessage` をクリックすると「空実装のメソッドを削除」ボタンが出ない
- `class-BacklogClient` の `method-postMessage` をクリック → ボタンを押す → そのメソッドが0件、`score` に「空実装 -40」と「インターフェースの約束違反 -10」(実装漏れ)
- Ctrl+Z → `class-BacklogClient` の `method-postMessage` が戻り、`score` が「空実装 -50」で「インターフェースの約束違反」を含まない
- `class-header-BacklogClient` を右クリック →「実装するインターフェースを設定」→ `menuitemcheckbox` の `CollaborationTool` が `aria-checked="true"` → 押す →
  `class-BacklogClient` から `implements CollaborationTool` が消え、`score` に「インターフェースの約束違反 -10」(Backlog が `createTask` などを持つのに実装を宣言していない = 宣言漏れ)

(複数実装の付け外しそのものは段階AのE2Eで守る)

### 受け入れ基準(段階C)

- `npm run check` と `npm run test:e2e` が通る
- 上級6で `stageCatalog.test.ts` の共通テストが変更なしで通り、追加した近道6件が100点未満
- 解答例の図(`sampleAnswerCodebase`)が上級6でも例外なく作れ、Chatwork に `implements ChatClient, TaskTracker` と矢印2本が出る
- lint: `as`・`!`・`enum` を使わない。関数60行・循環的複雑度12・引数4つまで

---

## 変更対象ファイル一覧(まとめ)

| パス | 層 | 段階 | 新規/変更 |
| --- | --- | --- | --- |
| `src/domain/codebase/Codebase.ts`・`.test.ts` | domain | A, B | 変更(`interfaceIds`・`parentIds`・`findInterfaces`・`isInterfaceLike` の移動 / `stub`・`isStubMethod`) |
| `src/domain/codebase/setSuperclass.ts`・`.test.ts` | domain | A | 変更(extends 専用、`addInterface`・`removeInterface`・`availableParents`) |
| `src/domain/codebase/deleteMethod.ts`・`.test.ts` | domain | B | 新規 |
| `src/domain/scoring/loneSuperclass.ts`・`.test.ts` | domain | A | 変更 |
| `src/domain/scoring/interfaceContracts.ts`・`.test.ts` | domain | B | 新規 |
| `src/domain/scoring/score.ts`・`fileScores.ts` と各テスト | domain | B | 変更 |
| `src/domain/change/measurePlacement.ts`・`sampleImplementation.ts` と各テスト | domain | A | 変更 |
| `src/domain/critique/critiqueRequest.ts`・`.test.ts` | domain | A, B | 変更 |
| `src/domain/stage/sampleAnswer.ts`・`.test.ts` | domain | A, B, C | 変更 |
| `src/application/RefactorUseCases.ts`・`.test.ts` | application | A, B | 変更 |
| `src/presentation/store/useGameStore.ts` | presentation | A, B | 変更 |
| `src/presentation/canvas/CanvasContextMenu.tsx`・`SuperclassLabel.tsx`・`ClassNode.tsx`・`layoutCodebase.ts`(+ `.test.ts`) | presentation | A | 変更 |
| `src/presentation/preview/PreviewClassNode.tsx` | presentation | A | 変更 |
| `src/presentation/editor/MethodEditor.tsx`・`stage/describeScore.ts` | presentation | B | 変更 |
| `src/presentation/stage/describeSolutionStep.ts` | presentation | A, B, C | 変更 |
| `src/infrastructure/stages/advancedStages.ts`・`advancedStages.test.ts`・`stageCatalog.test.ts` | infrastructure | A, B, C | 変更 |
| `e2e/refactor.spec.ts` | E2E | A, B, C | 変更 |

## スコープ外

- **implements の矢印を破線など別の見た目にすること**: 継承と同じ見た目のまま(ラベルで区別できる)
- **インターフェース同士の extends の特別扱い**(`lone-superclass` の例外): 使う題材ができたら
- **置き方の採点(`scorePlacement`)への約束違反の反映**: 変更依頼の実装で空実装を増やす置き方を減点したくなったら足す
- **上級6への extend の依頼**(「LINE WORKS にも投稿できるようにして」など): 太ったインターフェースを実装した新クラスが空実装を抱えることを置き方の採点で測れないため
- **Delete Method を空実装以外に広げること**: 行数・責務の減点を逃れる抜け道になる
- **クラス・ファイル削除時に、他クラスの `superclassId` / `interfaceIds` の参照を掃除すること**: 今も継承元の削除で参照が残るのを許容しており(読む側で捨てる)、同じ扱いにする
- **キャンバス上で空実装を色などで区別する表示**、**メソッドの右クリックメニューからの削除**

## 決定済み(ユーザー確認)

- チェック式サブメニューは選んでも閉じない(Esc・外側クリックで閉じる)。E2Eの「閉じる」確認はこれに合わせて直す
- 上級2の説明文(description / goal)に「実装を宣言していないと約束違反になる」を一言足す(段階B)
- AI講評の `workers/` 側は `superclassKind` を参照していないので、入力の形の変更に対応は不要

## 未決事項

- **ヒント14手**: 前半の「名前を変える・切り出す」をまとめるかはプレイを見て決める
- **`contract` の3種類が1つのルール名**: 内訳ではどれに当たったか分からない。分かりにくければ、ファイルの ⚠ の説明を出すかルールを分ける
- **宣言漏れの名前判定**: 別々のインターフェースに同名の契約があると過剰に数える(今のステージにはない)
