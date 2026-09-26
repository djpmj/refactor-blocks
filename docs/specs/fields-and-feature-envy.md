# クラスのデータ(フィールド)と、中級6「他人のデータばかり触るメソッド」(Feature Envy / Tell, Don't Ask)

## 背景・目的

今のモデル(`domain/codebase/Codebase.ts`)は ファイル → クラス → メソッド → 処理(Fragment)だけで、クラスが持つデータがない。
そのため、オブジェクト指向の中心である「データと、それを扱う振る舞いを同じ場所に置く」を練習できない。

実務でよく見るのは、`XxxService` がエンティティの public フィールドを次々に読んで判定・計算し、最後に `entity.status = ...` と外から書き換える形
(データだけのクラス + 何でもやるサービス)。これを「データを持つクラスに頼む(Tell, Don't Ask)」形へ組み替える練習をしたい。

この仕様では次の3つを入れる。

1. クラスのフィールドと、処理がどのフィールドを読む・書くかのモデル。フィールドのドラッグ移動(Move Field)
2. 採点ルール「Feature Envy」と「カプセル化の破れ」
3. 中級6ステージ

中級1(循環依存)も「`Customer.calculateOrderTotal` は `Order` にいるべき」という置き場所の題材だが、メソッド呼び出し(`uses`)だけで表しており、
データも書き換えも出てこない。中級6はフィールドの読み書きと Move Field を主題にし、題材も注文ではなくサブスクリプション課金にして重ならないようにする。

## 実装の段階

規模が大きいので3段階に分ける。**どの段階も終えた時点で `npm run check` が通り、段階Cでは `npm run test:e2e` も通る**こと。

| 段階 | 内容 | 画面の変化 |
| --- | --- | --- |
| **A. フィールドのモデルと操作(domain / application)** | `Field` 型、`Fragment.reads` / `writes`、`moveField`、依存への算入、空の入れ物・削除・統合・置き方の比較の対応、`SolutionStep.moveField`、講評データの `fields` | なし(フィールドを持つステージがまだないため) |
| **B. 採点** | `feature-envy` / `encapsulation` ルール、ファイルの減点、講評データの `enviedClassName`、減点の表示名 | なし(既存ステージの点数は変わらない) |
| **C. 画面・ステージ・E2E** | フィールドの表示とドラッグ(Move Field)、メソッドエディタでの読み書きの表示、解答例の図、中級6ステージ、ヒント、近道テスト、E2E | 中級6が増える |

---

## 設計判断

### 1. Fragment のフィールド参照: `reads` / `writes` の2つに分ける(推奨)

| 案 | 形 | 良い点 | 悪い点 |
| --- | --- | --- | --- |
| **1. 読み・書きを分ける(推奨)** | `reads?: readonly string[]` と `writes?: readonly string[]`(フィールドID) | カプセル化の破れ(外からの書き換え)を判定できる。後続の Value Object(作ったあとに書き換えない)・貧血ドメインモデル(サービスがセッター代わりに書き換える)でもそのまま使える | 省略可能な配列が1つ増える。Merge Methods で両方の和集合を取る必要がある |
| 2. 1つの配列 | `fields?: readonly string[]` | 書くデータが少ない | 「読むだけ」と「書き換える」を区別できない。今回のカプセル化の採点も後続ステージも作れず、ステージデータを書き直すことになる |

Feature Envy は読み書きを区別せず「触ったフィールド」(`reads ∪ writes`)で数えるので、案1でも Feature Envy の判定は変わらない。
カプセル化の採点を今回入れる(下の判断4)ので、**案1を採る**。読み書きの両方をする処理は `writes` だけに書けばよい(`reads` と重複させなくてよい)。

### 2. フィールド参照もクラス間の依存に数える。矢印は既存の依存の矢印を共用する

- 実際のコードでも、`subscription.status` を読むクラスは `Subscription` に依存している。数えないと、フィールドしか触っていないサービスとデータクラスの間に矢印が出ず、結合度・循環依存の採点と変更依頼の波及(`measureChange` の `rippleClasses`)が実態とずれる
- 中級6で、メソッドだけを移してフィールドを置き去りにすると `Subscription → BillingService` の依存が生まれて**循環依存の赤い矢印になる**。「メソッドを移したら、それだけが使うフィールドも一緒に移す」を目で見て分かる
- 矢印はクラス対ごとに1本の既存の依存の矢印(`dep-<from>-<to>`)をそのまま使う。「メソッド呼び出しによる依存」と「フィールド参照による依存」を描き分ける必要は今はない(スコープ外)
- 既存ステージはフィールドを持たないので、依存・矢印・結合度・循環依存は変わらない

### 3. Feature Envy の判定の定義

**メソッド単位**で判定する。処理(Fragment)単位にしないのは、実際の解き方が「うらやましがっている処理を Extract Method してから Move Method する」2手だから。
メソッド単位なら、長いメソッドが他クラスのデータを触る処理を抱えている初期状態も、抽出しただけで移していない途中の状態も、どちらも減点として見える。

あるメソッド M(クラス C にある)について:

1. M の全 Fragment の `reads ∪ writes` から、**存在するフィールドのID**を重複なく集める(存在しないIDは無視。下の「削除の制限」で通常は起きない)
2. 各フィールドを、それを宣言しているクラスごとに数える
   - **自分側** = C と、C の **extends の先祖**(`superclassId` をたどる。訪問済みで止める)。継承元のフィールドは自分のデータとして扱う
   - **implements の先(インターフェース)のフィールド**は自分側に含めない。インターフェースはデータを持たない前提で、もし持っていても他クラスとして数える(今のステージに該当なし)
   - 子クラス側のフィールドを親のメソッドが触る場合も他クラスとして数える
3. 他クラスのうち、触ったフィールド数が最大のクラスを「うらやましい相手」とする。**同数なら `allClasses` の並びで先のクラス**
4. **うらやましい相手の数 ≥ 2 かつ 自分側の数より多い**なら Feature Envy。1件 -10
   - **同数は減点しない**(どちらに置くべきか決められないため。迷ったら今の置き場所のままでよい、という扱い)
   - 下限 2 は、「顧客のメールアドレスを1つ読んで送る」のような普通のコードを減点しないため。
     `// ponytail: 閾値は「他クラスのフィールドを2つ以上、かつ自分より多く」の素朴な判定。Lanza-Marinescu 式(ATFD/LAA/FDP)が必要になったら置き換える` を残す
   - 複数の他クラスを少しずつ触る「まとめ役」のメソッドは、合計ではなくクラスごとの最大で比べるので減点しない
5. メソッド呼び出し(`uses`)は数えない。`subscription.isInTrial()` を呼ぶのは Tell なので減点しない

### 4. カプセル化の破れは今回のステージで入れる

入れる理由:

- 題材の核心(`subscription.status = 'canceled'` を外から書く)がまさにこれで、Tell, Don't Ask の「聞かずに頼む」の片側を採点で表せる
- データモデルは判断1で `writes` を持つので、追加コストはルール関数1つ(20行程度)と表示名だけ
- 中級6で **Move Field が必要になる理由**の1つになる(下の近道テスト)

定義: クラス C の Fragment がフィールド F(クラス D が宣言)を参照していて、D が C の自分側(C と extends の先祖)**でなく**、次のどちらかに当たる場合、(F, C) の組1つにつき1件 -10。

- **書き換えている**(`writes` に入っている)。F の可視性は問わない
- **public でないフィールドを読んでいる**(private / protected を外から読む。実際のコードならコンパイルエラー)

自分側(extends の先祖を含む)への参照は、可視性を問わず違反にしない。
`// ponytail: 子クラスから親の private フィールドを触っても違反にしない。継承とフィールドを組み合わせたステージを作るときに見直す` を残す。

要求では「public フィールドを他クラスから書き換える」だけだったが、private の読み取りも含める。
含めないと、中級6でメソッドだけ `Subscription` へ移して private フィールド `trialDays` を `BillingService` に置き去りにした状態を、循環依存でしか捕まえられない
(`dependencyLimit` や依存の向きを変えると抜け道になる)。書き換えだけで十分かは未決事項に残す。

### 5. フィールドの可視性は変えられない(操作を作らない)

メソッドにも可視性を変える操作はない。中級6は「データクラスの public フィールドを外から触っている」初期状態を、
可視性を変えずに「外から触らない」形にすれば100点になるように作る(外から触らなくなれば、public のままでも減点しない)。
`visibilityEnforced` は中級6でも `false` のまま(抽出した private メソッドを `Subscription` へ移して `BillingService` から呼ぶので。既存ステージと同じ扱い)。

### 6. 後続ステージへの備え(今回は作らない)

- **Extract Class(凝集度・LCOM)**: メソッドごとに触るフィールドの集合が `reads ∪ writes` で取れるので、LCOM を計算できる。フィールドを新しいクラスへ出す操作(`moveFieldToNewClass`)はそのとき足す
- **Value Object**: `writes` があるので「作ったあとに書き換えない」を判定できる。フィールドの型としてクラスを指す `typeClassId?` は、そのとき省略可能な項目として足す(既存データに影響しない)
- **貧血ドメインモデル**: フィールドだけのクラスと、外から `writes` するサービスをそのまま表せる。カプセル化の採点も流用できる

どれも今回の形に省略可能な項目を足すだけで作れる。今回は型の項目も操作も先回りして足さない(YAGNI)。

---

## A. フィールドのモデルと操作

### 型の変更(`domain/codebase/Codebase.ts`)

```ts
/** クラスが持つデータ。行数は持たない(クラス・ファイルの行数は今までどおりメソッドの Fragment だけから数える)。 */
export type Field = {
  readonly id: string;
  readonly name: string;
  readonly visibility: Visibility;
};

export type Fragment = {
  // ...既存の項目
  /** この処理が読むフィールドのID。クラス間の依存・Feature Envy・カプセル化の採点の元になる。省略は [] と同じ。 */
  readonly reads?: readonly string[];
  /** この処理が書き換えるフィールドのID。読み書きの両方をするときもここだけに書けばよい。省略は [] と同じ。 */
  readonly writes?: readonly string[];
};

export type CodeClass = {
  // ...既存の項目
  /** クラスが持つフィールド。宣言順。省略は [] と同じ(既存ステージは書かない)。 */
  readonly fields?: readonly Field[];
};
```

- 型名(`typeName`)は持たない。題材の理解に必要な情報は Fragment のラベルとフィールド名で足りる。Value Object のステージで型が要るようになったら足す
- フィールドは行数に数えない(`lineCount.ts` は変更しない)。既存ステージの行数・点数を変えないため。
  `// ponytail: フィールド宣言の行数は数えない。フィールドの多いクラスの大きさを採点したくなったら lineCount に足す` を `Field` の近くに残す

足すヘルパー(`Codebase.ts`):

```ts
/** クラスのフィールド。省略時は []。 */
export function fieldsOf(codeClass: CodeClass): readonly Field[];
/** 処理が触る(読む・書く)フィールドのID。重複なし、reads → writes の順。 */
export function touchedFieldIds(fragment: Fragment): string[];
export function findField(codebase: Codebase, fieldId: string): Field | undefined;
export function findClassOfField(codebase: Codebase, fieldId: string): CodeClass | undefined;
```

### 依存への算入(`domain/codebase/dependencies.ts`)

```ts
/** 各フィールドIDから、それを宣言しているクラスのIDを引けるMapを作る。 */
export function fieldOwnerMap(codebase: Codebase): ReadonlyMap<string, string>;
```

- `dependencyTargets` は、`uses`(メソッドの持ち主)に加えて、`touchedFieldIds`(フィールドの持ち主)も依存先に数える。自クラス・存在しないIDは今までどおり無視
- `classDependencies` のコメントを「Fragment の uses と、読み書きするフィールドから算出する」に直す
- 呼び出し側(`score.ts`・`fileScores.ts`・`measureChange.ts`・`measurePlacement.ts`・`layoutCodebase.ts`・`ClassNode.tsx`)は変更不要(自動で反映される)

### Move Field(新規 `domain/codebase/moveField.ts`)

```ts
export type MoveFieldError = 'field-not-found' | 'class-not-found' | 'same-class' | 'duplicate-field-name';

/** Move Field: フィールドを別クラスへ移す。移動先の末尾に追加する。処理の reads / writes はIDで指しているので書き換えない。 */
export function moveField(codebase: Codebase, fieldId: string, targetClassId: string): Result<Codebase, MoveFieldError>;
```

- `moveMethod` と同じ形で書く(`mapClasses` を使い、元の Codebase を変更しない)
- 移動元のフィールドが空になったら、`fields` プロパティごと消す(`removeInterface` と同じ扱い。付けて外して戻したときに同じ中身になるように)
- 移動先に同名の**フィールド**があれば `duplicate-field-name`。同名のメソッドとの衝突は見ない
  (`// ponytail: フィールドとメソッドの名前の衝突は見ない。題材で問題になったら moveField / moveMethod / extractMethod の3か所で見る` を残す)
- 部品置き場のクラスへ移すことは止めない(スコープ外を参照)

### 空の入れ物・削除・統合の対応

| 場所 | 変更 | 理由 |
| --- | --- | --- |
| `domain/scoring/leftovers.ts` `findEmptyContainers` | 空のクラス = **メソッドもフィールドも**ないクラス | データだけのクラス(中級6の `Subscription` の初期状態)は「空」ではない。既存ステージはフィールドがないので結果は同じ |
| `domain/codebase/deleteClass.ts` | フィールドを持つクラスは `err('has-fields')` で削除させない | 削除を許すと、処理の `reads` / `writes` が存在しないIDを指し、Feature Envy・カプセル化の採点から外れる抜け道になる(データを消させない) |
| `domain/codebase/deleteFile.ts` | フィールドを持つクラスを含むファイルは `err('has-fields')` | 同上 |
| `domain/codebase/mergeMethods.ts` `mergeFragment` | `reads` / `writes` も `uses` と同じく和集合にする(空なら項目を付けない) | 今は項目を明示して組み立てているので、足さないと統合でフィールド参照が消える |
| `extractMethod` / `inlineMethod` / `moveMethod` / `moveClass` ほか | 変更不要 | Fragment・クラスをそのまま(スプレッドで)運ぶので `reads` / `writes` / `fields` は保たれる |

エラー文言(`application/RefactorUseCases.ts`):

- `DELETE_CLASS_ERROR_MESSAGES['has-fields']`:「フィールドを持つクラスは削除できません。先にフィールドを別のクラスへ移してください」
- `DELETE_FILE_ERROR_MESSAGES['has-fields']`:「フィールドを持つクラスがあるファイルは削除できません。先にフィールドを別のクラスへ移してください」

### ユースケース(`application/RefactorUseCases.ts`)

```ts
/** プレイヤーの「フィールドを別クラスへドロップ」操作。同じクラスへのドロップは何もしない操作として成功扱いにする。 */
export function moveFieldUseCase(codebase: Codebase, fieldId: string, targetClassId: string): Result<Codebase, Exclude<MoveFieldError, 'same-class'>>;
export function describeMoveFieldError(error: Exclude<MoveFieldError, 'same-class'>): string;
```

文言: `field-not-found`「移動するフィールドが見つかりません」、`class-not-found`「移動先のクラスが見つかりません」、`duplicate-field-name`「移動先に同じ名前のフィールドがあります」。

### 変更依頼(置き方の採点)への影響

| 場所 | 変更 |
| --- | --- |
| `domain/change/measurePlacement.ts` `classContent` | フィールド(`[id, name, visibility]` を id で並べ替え)も比較に入れる。変更依頼の実装中に Move Field したクラスは「触った既存クラス」に数える。移して戻せば触っていない扱い |
| `domain/change/changePart.ts` | 変更なし。部品の Fragment はフィールドを参照しないので、どこに置いても Feature Envy にならない(置き方の採点は `scorePlacement` のルールだけで決まる) |
| `domain/change/sampleImplementation.ts` | 変更なし(`moveMethod` がフィールドをそのまま運ぶ) |
| `domain/change/measureChange.ts` / `findChangeSites.ts` | 変更なし。波及(`rippleClasses`)は依存にフィールド参照が入るぶん実態どおりになる(中級6で模範解答のあと `BillingService` が波及に出る) |
| 白紙設計(`domain/blank/`・`infrastructure/blankDesigns/`)・設計くらべ(`infrastructure/quizzes/`) | 変更なし。部品置き場(`trayCodebase`)も問題データもフィールドを持たないため、新ルールは常に0件 |
| 進捗の保存(`infrastructure/progress/`) | 変更なし(コードを保存しない) |

### 模範解答の手(`domain/stage/sampleAnswer.ts`)

```ts
| { readonly moveField: { readonly field: string; readonly fromClass: string; readonly toClass: string } }
```

- `fromClass` は必須(同名フィールドは複数クラスにありうるため)。`fieldIdByName(codebase, name, ownerClassName)` を足し、`moveField` を呼ぶ
- `applyStep` で `move` の次に扱い、`StructuralStep` の `Exclude` に `{ readonly moveField: unknown }` を足す

### AI講評の入力(`domain/critique/critiqueRequest.ts`)

```ts
export type CritiqueFieldSummary = { readonly name: string; readonly visibility: Visibility };

export type CritiqueClassSummary = {
  // ...既存の項目
  /** クラスのフィールド。1つ以上あるときだけ含める。 */
  readonly fields?: readonly CritiqueFieldSummary[];
};
```

- `workers/critique/src/index.ts` は変更しない(検証は既知の項目だけを見るので、項目が増えても通る。採点データはJSONごとプロンプトに入る)
- 既存ステージではキーが増えないので、講評の入力は今と同じ

### TDD対象(段階A)

すべて Vitest・AAA でテストを先に書く。

- `fieldsOf`: `fields` なし → `[]`
- `touchedFieldIds`: reads と writes に同じIDがあっても1つ / 両方なし → `[]`
- `findField` / `findClassOfField`: 見つかる / 存在しないID → `undefined`
- `fieldOwnerMap`: 全クラスのフィールドIDから持ち主が引ける
- `classDependencies`:
  - A の処理が B のフィールドを読む → `A → B` が1本
  - B のフィールドを書くだけでも `A → B`
  - B のメソッドを呼び、かつ B のフィールドも読む → `A → B` は1本だけ(重複しない)
  - 自クラスのフィールド・存在しないフィールドID → 依存にならない
  - A がフィールドで B に、B がメソッド呼び出しで A に依存 → 両方 `cyclic: true`
- `moveField`:
  - 移動先の末尾に入り、移動元から消える。処理の `reads` / `writes` は変わらない
  - 移動元の最後のフィールドを移すと、移動元の `fields` プロパティがなくなる
  - 存在しないフィールド → `field-not-found` / 存在しないクラス → `class-not-found` / 同じクラス → `same-class` / 同名フィールド → `duplicate-field-name`
  - 元の Codebase を変更しない
- `moveFieldUseCase`: 同じクラスへのドロップは `ok` で Codebase がそのまま / それ以外のエラーはそのまま返す
- `findEmptyContainers`: フィールドだけのクラスは空ではない / メソッドもフィールドもないクラスは空
- `deleteClass`: フィールドを持つクラス → `has-fields` / フィールドを移し終えたクラスは削除できる
- `deleteFile`: フィールドを持つクラスを含むファイル → `has-fields`
- `mergeMethods`: 2つの処理の `reads` / `writes` がそれぞれ和集合になる / どちらにもなければキーを付けない
- `measurePlacement`: 変更依頼の実装中に既存クラスのフィールドを別クラスへ移すと、移動元・移動先が `modifiedClassIds` に入る / 移して戻すと入らない
- `applySolutionSteps`: `moveField` で指定クラスのフィールドが移る / 別クラスの同名フィールドは動かない
- `buildCritiqueRequest`: フィールドを持つクラスだけ `fields` があり、名前と可視性が宣言順 / フィールドのないクラスにはキーがない

### 受け入れ基準(段階A)

- `npm run check` が通る
- 既存の全ステージで `stageCatalog.test.ts` の共通テストが変更なしで通り、初期点・変更容易性スコアが変わらない
- `layoutCodebase.test.ts` など既存の表示のテストが変更なしで通る

---

## B. 採点

### ルールの追加(`domain/scoring/score.ts`)

`ScoreRule` に `'feature-envy' | 'encapsulation'` を足す。並びは `'contract'` の後ろに `'feature-envy'`、`'encapsulation'`。どちらも1件 -10、**フラグなしで全ステージ**
(既存ステージはフィールドを持たないので常に0件。`contract` と同じ扱い)。`scoreCodebase` の JSDoc の列挙にも足す。

### 判定関数(新規 `domain/scoring/fieldAccess.ts`)

```ts
export type FeatureEnvy = {
  readonly methodId: string;
  /** いちばん多くフィールドを触っている他クラスのID。 */
  readonly enviedClassId: string;
};

/** 他クラスのフィールドを、自分側(自クラス + extends の先祖)より多く(かつ2つ以上)触っているメソッドを出現順に返す。 */
export function findFeatureEnvy(codebase: Codebase): FeatureEnvy[];

export type EncapsulationViolation = {
  readonly fieldId: string;
  /** フィールドに触っている処理があるクラスのID。 */
  readonly accessorClassId: string;
};

/** 他クラスのフィールドを書き換えている・public でない他クラスのフィールドを読んでいる箇所を、(フィールド, クラス) の組で重複なく出現順に返す。 */
export function findEncapsulationViolations(codebase: Codebase): EncapsulationViolation[];
```

- 自分側のクラスID集合(自クラス + `superclassId` の連なり)を求める小さな関数を1つ作り、両方で使う
- 判定の定義は「設計判断 3・4」のとおり
- 関数は60行・循環的複雑度12・ネスト4段以内に収める(メソッドごとの数え上げは関数に分ける)

### ファイルの減点(`domain/scoring/fileScores.ts`)

`violatingTargetIds` に次を足す。どちらも `fileIdByTargetId` で引けるID。

- Feature Envy → `methodId`(そのメソッドがあるファイル)
- カプセル化の破れ → `accessorClassId`(触っている側のクラスがあるファイル。直すのは触っている側なので)

コメント「全ファイルの合計は、アクセス制御を除いた `scoreCodebase` の減点の合計と一致する」は変わらず成り立つ。

### 講評データ(`domain/critique/critiqueRequest.ts`)

`CritiqueMethodSummary` に `readonly enviedClassName?: string` を足す(Feature Envy のメソッドだけ。AIが「どのメソッドをどこへ移すべきか」を具体的に書けるように)。

### 表示名(`presentation/stage/describeScore.ts`)

- `'feature-envy': '他クラスのデータを触りすぎ(Feature Envy)'`
- `encapsulation: 'カプセル化の破れ'`

### TDD対象(段階B)

#### `findFeatureEnvy`

- 自クラスのフィールド1つ、他クラス B のフィールド3つを触るメソッド → `{ methodId, enviedClassId: B }`
- 自クラス2つ・B 2つ(同数) → 空
- 自クラス0・B 1つ(下限未満) → 空
- 自クラス1・B 2つ・C 2つ → B と C のうち `allClasses` の並びで先のクラス
- B 1つ・C 1つ・自クラス0(まとめ役) → 空
- 親クラス(extends)のフィールドを2つ触る子クラスのメソッド → 空(自分側)
- 実装しているインターフェース役のクラスのフィールドを2つ触る → Feature Envy(自分側に含めない)
- 読むだけ・書くだけ・両方の混在でも、触ったフィールドとして同じに数える。同じフィールドを複数の処理で触っても1つ
- 存在しないフィールドIDは数えない
- メソッド呼び出し(`uses`)は数えない
- フィールドのない Codebase(`sampleCodebase()`) → 空

#### `findEncapsulationViolations`

- A の処理が B の public フィールドを書き換える → `{ fieldId, accessorClassId: A }`
- A の処理が B の public フィールドを読むだけ → 空
- A の処理が B の private / protected フィールドを読む → 1件
- A の2つの処理が B の同じフィールドを書き換える → 1件(組で重複なし)
- 自クラスの private フィールドの読み書き → 空 / 親クラス(extends)のフィールドの書き換え → 空
- 存在しないフィールドID → 空

#### `scoreCodebase` / `fileDeductions` / `buildCritiqueRequest`

- `scoreCodebase`: Feature Envy 1件で `feature-envy` -10、外からの書き換え1件で `encapsulation` -10。内訳の並びの期待値を12ルールに更新
- `fileDeductions`: Feature Envy はメソッドのファイル、カプセル化は触っている側のクラスのファイルに数える。合計が `scoreCodebase` の減点の合計と一致する
- `buildCritiqueRequest`: Feature Envy のメソッドだけ `enviedClassName` があり、ほかはキーなし

### 受け入れ基準(段階B)

- `npm run check` が通る
- 既存の全ステージで初期点・模範解答の100点・近道の100点未満が変わらない(`score.test.ts` の内訳の配列の更新以外に、既存テストの期待値の変更がない)

---

## C. 画面・ステージ・E2E

### 画面

| 場所 | 変更 |
| --- | --- |
| `presentation/canvas/dndIds.ts` | `FIELD_PREFIX = 'field:'`、`fieldDragId` / `parseFieldDragId`(既存の `file:` と前方一致しない) |
| `presentation/canvas/FieldChip.tsx`(新規) | 見た目だけの `FieldChipView`(可視性の記号 `+ - #` とフィールド名。`()` と行数は付けない)と、ドラッグできる `FieldChip`。`MethodChip` と同じ約束: `<button type="button">` に `nodrag nopan`、`useDraggable({ id: fieldDragId(field.id) })`、`data-testid={`field-${field.name}`}`、`aria-label`「フィールド {name}({可視性})。ドラッグで別クラスへ移動」。可視性の記号の対応表は `MethodChip.tsx` の `VISIBILITY_MARK` を export して共用する |
| `presentation/canvas/ClassNode.tsx` | 詳細表示(`showDetails`)のとき、メソッドの上にフィールドの一覧(`fieldsOf` が空なら出さない)。見出しは視覚的に目立たせず、`aria-label="フィールド"` の `div` でまとめる。メソッドが0件のときの「ここにメソッドをドロップ」は今のまま |
| `presentation/canvas/layoutCodebase.ts` | `classHeight` にフィールドの行数を足す(`FIELD_ROW` 定数)。`measureFile` / `layoutFile` はクラスを渡す形にする。フィールドなしなら今と同じ高さ(既存の `layoutCodebase.test.ts` は変わらない) |
| `presentation/canvas/CodebaseCanvas.tsx` | `DraggingOverlay` でフィールドのときは `FieldChipView` を出す(portal は今のまま `document.body`)。`useDropHandler`: フィールドをクラスの上に落としたら `moveField`。クラス以外(ファイルの枠・余白)に落としたら**何もしない**(新しいクラスを作らない。スコープ外を参照)。`PointerSensor` の `distance: 5` と `KeyboardSensor` は既存のものをそのまま使う |
| `presentation/store/useGameStore.ts` | `moveField(fieldId, targetClassId)`。`apply` を通して履歴に積む(Ctrl+Z で戻せる) |
| `presentation/editor/MethodEditor.tsx` | `FragmentList` の各処理の下に、触るフィールドを文字で出す: 「読む: Subscription.startedAt, BillingService.trialDays」「書く: Subscription.status」(`reads` / `writes` がある処理だけ。クラス名は `findClassOfField` で引き、見つからなければ出さない)。色だけに頼らず文字で出す。これがないとプレイヤーは Feature Envy を判断できない |
| `presentation/preview/PreviewClassNode.tsx` | フィールドの一覧を読み取り専用で出す(`FieldChipView`)。解答例の図・プレビューで、フィールドがどこへ移ったかが見える |
| `presentation/stage/describeSolutionStep.ts` | `moveField`:「{fromClass} のフィールド {field} を {toClass} へドラッグして移そう(Move Field)」 |

#### キーボード操作

`CodebaseCanvas` には `KeyboardSensor` がすでに登録されており、メソッドのチップも同じ仕組み(ボタンにフォーカス → Space で持ち上げ → 矢印キーで移動 → Space で落とす)に頼っている。
フィールドのチップも `<button>` + `useDraggable` にするので、**メソッドと同じキーボード操作ができる**(追加の実装なし)。

右クリックメニューの「移動先のクラスを選ぶ」のような、座標に頼らない代替操作は、メソッドとフィールドの両方にまとめて入れるべきなので今回は作らない(未決事項)。

### 中級6ステージ

#### 位置づけ

中級の末尾(`intermediateStages` の最後)に置く。Extract Method・Move Method(チュートリアル〜中級)を使えることが前提で、継承・インターフェース(上級)は使わない。

- id: `intermediate-feature-envy`、level: `'intermediate'`、title: `中級6: 他人のデータばかり触るメソッド`
- 定義の冒頭コメントに、中級1との違い(呼び出しではなくデータの読み書き。Tell, Don't Ask と Move Field)を一言
- description:
  「SaaS の月額課金を担当する BillingService。契約(Subscription)は public なフィールドを持つだけのクラスで、トライアル中かの判定も、席数と単価からの請求額の計算も、
  解約の手続きも、すべて BillingService が Subscription のフィールドを読んで行い、最後に subscription.status を外から書き換えている。
  しかも、キャンペーンで契約ごとに変わるようになったトライアル日数(trialDays)が、まだ BillingService のフィールドのまま残っている。」
- goal:
  「データを持つクラスに仕事を頼もう(Tell, Don't Ask)。他クラスのフィールドばかり触る処理は Extract Method してからデータの持ち主へ移し、
  一緒に使うフィールドは Move Field で運ぼう。メソッドは60行以内、1クラスの責務は3種類まで、依存先は1クラスまで」
- `limits: { method: 60, class: 150, file: 300 }`、`dependencyLimit: 1`、`responsibilityLimit: 3`、`visibilityEnforced` は書かない

#### 初期コード

| ファイル | クラス | フィールド | メソッド | 処理(行数, responsibility, 読む / 書く) |
| --- | --- | --- | --- | --- |
| `src/billing/BillingService.ts` | `BillingService` | `paymentGateway`・`mailer`・`trialDays`(すべて private) | `renewSubscription`(public) | トライアル期間中なら請求しない(12, `trial`, 読む: `startedAt`・`status`・`trialDays`)<br>席数と単価から今月の請求額を計算する(28, `pricing`, 読む: `seats`・`unitPrice`)<br>決済代行サービスでカードに請求する(30, `payment`, 読む: `paymentGateway`)<br>請求書メールを送る(22, `notification`, 読む: `mailer`) |
| | | | `cancelSubscription`(public) | 解約できる状態か確かめる(10, `cancellation`, 読む: `status`・`canceledAt`)<br>状態を解約済みにし、解約日を記録する(6, `cancellation`, 書く: `status`・`canceledAt`)<br>解約の確認メールを送る(18, `notification`, 読む: `mailer`) |
| `src/billing/Subscription.ts` | `Subscription` | `status`・`startedAt`・`seats`・`unitPrice`・`canceledAt`(すべて public) | なし | — |

- ID は既存の命名(`file-…` / `class-…` / `method-…` / `frag-…`)に加え、フィールドは `field-…`。ステージ内で重複させない。
  以下で使う Fragment ID: `frag-check-trial` / `frag-calc-fee` / `frag-charge-card` / `frag-send-invoice-mail` / `frag-check-cancelable` / `frag-mark-canceled` / `frag-send-cancel-mail`
- `suggestedName` は `isInTrial` / `monthlyFee` / `chargeCard` / `sendInvoiceMail` / `checkCancelable` / `markCanceled` / `sendCancelMail`
- `renewSubscription` は92行で「80行以上のメソッドがある」を満たす

初期の減点(実測で確かめ、違えば表を直す): **40点**

| ルール | 件数 | 内容 |
| --- | --- | --- |
| 行数 | 1 | `renewSubscription` 92行 > 60 |
| 責務の混在 | 1 | `BillingService` に trial・pricing・payment・notification・cancellation の5種類 > 3 |
| Feature Envy | 2 | `renewSubscription`(自分側3: paymentGateway・mailer・trialDays、Subscription 4)/ `cancelSubscription`(自分側1、Subscription 2) |
| カプセル化の破れ | 2 | `BillingService` が `Subscription.status`・`canceledAt` を書き換え |
| 結合度・循環・空 | 0 | `BillingService → Subscription` の1本だけ。`Subscription` はフィールドがあるので空ではない |

#### 変更依頼(2件とも modify)

| id | title / description | responsibility | linesPerSite | partName |
| --- | --- | --- | --- | --- |
| `req-free-admin-seat` | 「管理者の席は無料にして」/ 契約の管理者1名分の席は請求しないようにしたい | `pricing` | 6 | `excludeAdminSeat` |
| `req-campaign-trial` | 「キャンペーン契約はトライアルを30日にして」/ キャンペーン経由の契約だけ、トライアル期間を30日に延ばしたい | `trial` | 4 | `applyCampaignTrial` |

期待値(`measureChange` → `scoreChange`。実測で表を直す):

| 依頼 | 初期 | 模範解答のあと |
| --- | --- | --- |
| `req-free-admin-seat` | `renewSubscription` 1か所。巻き込み3(trial・payment・notification)-15、上限超え(98行)-10 → 75点 | `Subscription.monthlyFee` 1か所。波及(`BillingService`)-5 → 95点 |
| `req-campaign-trial` | 同上 → 75点 | `Subscription.isInTrial` 1か所 → 95点 |

変更容易性スコア 75 → 95。`classesTouched` [1, 1] → [1, 1](増えない)。

#### 模範解答(`sampleAnswerSteps['intermediate-feature-envy']`)

```ts
[
  { extract: { from: 'renewSubscription', fragmentIds: ['frag-check-trial'], name: 'isInTrial' } },
  { move: { method: 'isInTrial', toClass: 'Subscription' } },
  { moveField: { field: 'trialDays', fromClass: 'BillingService', toClass: 'Subscription' } },
  { extract: { from: 'renewSubscription', fragmentIds: ['frag-calc-fee'], name: 'monthlyFee' } },
  { move: { method: 'monthlyFee', toClass: 'Subscription' } },
  { extract: { from: 'cancelSubscription', fragmentIds: ['frag-check-cancelable', 'frag-mark-canceled'], name: 'cancel' } },
  { move: { method: 'cancel', toClass: 'Subscription' } },
]
```

完成形: `BillingService`(`paymentGateway`・`mailer`。renewSubscription 54行・cancelSubscription 19行。責務 payment・notification)→ `Subscription`
(`status`・`startedAt`・`seats`・`unitPrice`・`canceledAt`・`trialDays`。isInTrial・monthlyFee・cancel。責務 trial・pricing・cancellation)。
Feature Envy 0・カプセル化の破れ 0・依存1本で100点。

2手目のあと(`trialDays` を移す前)は、`isInTrial` が `BillingService` の private フィールドを読むのでカプセル化の破れ、
`Subscription → BillingService` の依存が増えて循環依存(赤い矢印)になる。3手目の Move Field で消える。これがこのステージの見せ場。

#### ヒント

既存の `HintPanel`(模範解答を1手ずつ `describeSolutionStep` で文にする)をそのまま使う。7手。

#### `stageCatalog.test.ts` の `shortcuts` に足すもの(どれも100点未満)

1. 3つとも抽出するが、どれも `Subscription` へ移さない → 抽出したメソッドの Feature Envy・カプセル化・責務
2. メソッドは3つとも移すが、`trialDays` を Move Field しない(模範解答から3手目を抜く)→ カプセル化(private の読み取り)・循環依存
3. `trialDays` は移すが、`isInTrial` を `BillingService` に残す(模範解答から2手目を抜く)→ `isInTrial` の Feature Envy
4. データをサービスへ寄せる: `Subscription` の5つのフィールドを `BillingService` へ Move Field し、`src/billing/Subscription.ts` を削除し、3つを抽出する → 責務の混在(5種類)。
   **フィールドを移せば削除できる**ことの確認も兼ねる
5. `renewSubscription`・`cancelSubscription` をメソッドごと `Subscription` へ移す → カプセル化(private の `trialDays`・`paymentGateway`・`mailer` の読み取り)・行数・責務

#### ステージのテスト(新規 `src/infrastructure/stages/featureEnvyStage.test.ts`)

- 初期状態の減点が上の表どおりで40点
- 模範解答の2手目まで適用すると、`Subscription → BillingService` と `BillingService → Subscription` の依存が両方 `cyclic`。3手目まで適用すると循環が消える
- 模範解答のあと: `trialDays` が `Subscription` にあり、`BillingService` の依存先は `Subscription` だけ
- 初期状態で `Subscription` を `deleteClass` すると `has-fields`
- 変更依頼2件の `classesTouched` と点数が上の表どおり

`stageCatalog.test.ts` の共通テストに足す(全ステージ対象。既存ステージは空なので通る):

- `allIds` にフィールドのIDも含める(ステージ内でIDが重複しない)
- 「処理の `reads` / `writes` は、そのステージにあるフィールドIDだけを指す」(ステージ定義の打ち間違いを捕まえる)

### E2E(`e2e/refactor.spec.ts`)

中級6を開くヘルパー `openFeatureEnvyStage` を足す。`dragMethodToClass` はチップの testId を受け取るだけなので、フィールドにもそのまま使える(名前を `dragChipToClass` に変えてもよい)。

1. 「中級6: フィールドをドラッグで別クラスへ移すと移り、Ctrl+Z で戻る」
   - `score` に「他クラスのデータを触りすぎ(Feature Envy) -20」と「カプセル化の破れ -20」
   - `class-BillingService` の中の `field-trialDays` を `class-Subscription` へドラッグ → `class-Subscription` の中に `field-trialDays` があり、`class-BillingService` の中にない
   - Ctrl+Z → `class-BillingService` に戻る
2. 「中級6: メソッドだけ移すと循環依存になり、使うフィールドも移すと消える」
   - `renewSubscription` をクリック → メソッドエディタに「読む: Subscription.startedAt」と「BillingService.trialDays」の文字がある
   - 「トライアル期間中なら請求しない」を選んで抽出 → `isInTrial` を `class-Subscription` へドラッグ → `cyclic-mark` が出る
   - `field-trialDays` を `class-Subscription` へドラッグ → `cyclic-mark` が消える
3. 「中級6: フィールドを持つクラスは削除できない」
   - `class-header-Subscription` を右クリック → クラスを削除 → `role="alert"` に「フィールドを持つクラスは削除できません」、`class-Subscription` が残っている

### 受け入れ基準(段階C)

- `npm run check` と `npm run test:e2e` が通る
- 中級6で `stageCatalog.test.ts` の共通テストが通り、追加した近道5件が100点未満
- 解答例の図(`sampleAnswerCodebase`)が中級6でも例外なく作れ、`Subscription` に `trialDays` を含む6つのフィールドが表示される
- 既存ステージの見た目が変わらない(フィールドの一覧は、フィールドを持つクラスにしか出ない)
- lint: `as`・`!`・`enum` を使わない。関数60行・循環的複雑度12・引数4つまで

---

## 変更対象ファイル一覧(まとめ)

| パス | 層 | 段階 | 新規/変更 |
| --- | --- | --- | --- |
| `src/domain/codebase/Codebase.ts`・`.test.ts` | domain | A | 変更(`Field`・`reads`/`writes`・`fields`、ヘルパー4つ) |
| `src/domain/codebase/dependencies.ts`・`.test.ts` | domain | A | 変更(`fieldOwnerMap`、フィールド参照を依存に算入) |
| `src/domain/codebase/moveField.ts`・`.test.ts` | domain | A | 新規 |
| `src/domain/codebase/deleteClass.ts`・`deleteFile.ts` と各テスト | domain | A | 変更(`has-fields`) |
| `src/domain/codebase/mergeMethods.ts`・`.test.ts` | domain | A | 変更(`reads`/`writes` の和集合) |
| `src/domain/scoring/leftovers.ts`・`.test.ts` | domain | A | 変更(空のクラスの条件) |
| `src/domain/change/measurePlacement.ts`・`.test.ts` | domain | A | 変更(`classContent` にフィールド) |
| `src/domain/stage/sampleAnswer.ts`・`.test.ts` | domain | A, C | 変更(`moveField` の手 / 中級6の模範解答) |
| `src/domain/critique/critiqueRequest.ts`・`.test.ts` | domain | A, B | 変更(`fields` / `enviedClassName`) |
| `src/domain/scoring/fieldAccess.ts`・`.test.ts` | domain | B | 新規(`findFeatureEnvy`・`findEncapsulationViolations`) |
| `src/domain/scoring/score.ts`・`fileScores.ts` と各テスト | domain | B | 変更 |
| `src/application/RefactorUseCases.ts`・`.test.ts` | application | A | 変更(`moveFieldUseCase`・文言・`has-fields` の文言) |
| `src/presentation/stage/describeScore.ts` | presentation | B | 変更 |
| `src/presentation/canvas/dndIds.ts`・`FieldChip.tsx`(新規)・`MethodChip.tsx`・`ClassNode.tsx`・`CodebaseCanvas.tsx`・`layoutCodebase.ts`(+ `.test.ts`) | presentation | C | 変更/新規 |
| `src/presentation/store/useGameStore.ts` | presentation | C | 変更(`moveField`) |
| `src/presentation/editor/MethodEditor.tsx` | presentation | C | 変更(読む/書くの表示) |
| `src/presentation/preview/PreviewClassNode.tsx` | presentation | C | 変更 |
| `src/presentation/stage/describeSolutionStep.ts` | presentation | C | 変更 |
| `src/infrastructure/stages/intermediateStages.ts` | infrastructure | C | 変更(中級6) |
| `src/infrastructure/stages/stageCatalog.test.ts`・`featureEnvyStage.test.ts`(新規) | infrastructure | C | 変更/新規 |
| `e2e/refactor.spec.ts` | E2E | C | 変更 |

変更しないもの: `workers/critique/`、`src/domain/codebase/lineCount.ts`、`src/domain/change/`(`measurePlacement.ts` 以外)、白紙設計・設計くらべ・進捗の保存。

## スコープ外

- **フィールドをファイルの枠外・余白へ落として新しいクラスを作ること**(`moveFieldToNewClass`): Extract Class のステージで足す
- **フィールド・メソッドの可視性を変える操作**、フィールドの追加・削除・名前の変更
- **フィールドの型(`typeName` / `typeClassId`)**: Value Object のステージで足す
- **凝集度(LCOM)・未使用フィールドの採点**: Extract Class のステージで足す
- **フィールド参照による依存の矢印を、メソッド呼び出しの矢印と描き分けること**
- **Feature Envy のメソッドをキャンバス上で個別に目立たせる印**(ファイルの ⚠ と点数の内訳で伝える)
- **置き方の採点(`scorePlacement`)への Feature Envy の反映**、変更依頼の部品にフィールド参照を持たせること
- **部品置き場のクラスへのフィールドの移動を止めること**(変更依頼の実装中に部品置き場へフィールドを落とすと、置き方の採点では消えたフィールドとして無視される。実害が出たら止める)
- **フィールドとメソッドの名前の衝突の検査**
- **AI講評のプロンプトに Feature Envy の説明を足すこと**(`workers/` は変更しない)

## 決定済み(ユーザー確認)

- Feature Envy の閾値は「他クラスごとの最大が2つ以上、かつ自分側より多い」。同数は減点しない
- カプセル化の破れには、他クラスのフィールドの書き換え(可視性を問わない)に加え、public でない他クラスのフィールドの読み取りも含める
- フィールドを持つクラス・ファイルの削除は拒否する
- 中級6として中級の最後に置き、段階A→B→Cの順に実装する

## 未決事項

- **座標に頼らない移動操作**: メソッドもフィールドも、キーボードでは dnd-kit の `KeyboardSensor`(矢印キーでの移動)に頼っている。
  右クリックメニューから「移動先のクラスを選ぶ」代替操作を、メソッドとフィールドまとめて別タスクで入れるかを決めたい
