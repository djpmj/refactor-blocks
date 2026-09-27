# 仕様草案: 題材データの参照切れ検査(uses・継承・implements)

- slug: `stage-reference-integrity`
- 元: `docs/pipeline/stage-reference-integrity/01-discovered.md`

## 1. 背景・目的

- ステージ・設計くらべクイズ・白紙設計の題材は、`src/infrastructure/` に手書きのTypeScriptオブジェクトとして定義されている。
  その中の `Fragment.uses`(メソッドID)・`CodeClass.superclassId`/`interfaceIds`(クラスID)は、**打ち間違えても
  どのテストも落ちない**。
  - `dependencies.ts` の `classDependencies` は「存在しないIDは無視する」(51行目のJSDoc)。
  - `Codebase.ts` の `findSuperclass`・`findInterfaces`・`calledAccessorMethods` も、見つからないIDを捨てる。
  - プレイ中は Delete Method/Delete Class で参照先が消えうるので、ドメイン側の「黙って無視」は正しい。**変更しない。**
- 打ち間違いがあると、依存の矢印・循環依存・依存数の上限・可視性の越境・Feature Envy などの採点から、その辺が静かに消える。
  「初期状態では減点がある」のテストは減点が0件にならない限り通るので、減点が減っても気づけない。
- 題材を追加するパイプライン(`template-method-stage`・`inline-method-stage`・`utils-class-split-stage`・
  `data-placement-quizzes`・`blank-design-second-problem`)が進行中で、`method-call-references`・`class-dependency-focus` は
  `uses` が正しいことを前提にプレイヤーへ見せる。その前に、CIで参照切れを落とす安全網を張る。
- CLAUDE.md の「手を抜かないもの: 信頼境界での入力検証(ステージ定義の読み込み…)」、`src/infrastructure/README.md` の
  「ステージの検証ロジックなど純粋な部分はテストを書く」に沿う。

### 調査で分かったこと

- 既存の手本は `stageCatalog.test.ts` の `danglingFieldRefs`(485行目)。**ステージだけ**、`reads`/`writes` → フィールドIDを検査している。
  クイズ(`comparisonQuizzes.test.ts`)・白紙設計(`blankDesignProblems.test.ts`)には参照の検査が1つも無い。
- 参照を持つフィールドの一覧(`Codebase.ts`):

  | 参照元 | 参照先 | 今の検査 |
  | --- | --- | --- |
  | `Fragment.uses` | メソッドID | なし |
  | `Fragment.reads` / `Fragment.writes` | フィールドID | ステージのみあり |
  | `CodeClass.superclassId` | クラスID | なし |
  | `CodeClass.interfaceIds` | クラスID | なし |

- 再利用できる既存ヘルパー: `allClasses`・`fieldsOf`・`touchedFieldIds`・`parentIds`(`superclassId` と `interfaceIds` を並べ、
  **存在しないIDもそのまま返す**ので参照切れの検出にそのまま使える)。新しいヘルパーは要らない。
- 検査対象のコードベースの出どころ:
  - ステージ: `stages`(`stageCatalog.ts`)の各 `stage.codebase`(初期状態)
  - クイズ: `comparisonQuizzes` の各 `designs.a.codebase` / `designs.b.codebase`。一部は `sampleAnswerCodebase(...)`
    (模範解答の適用後)から作られているが、**プレイヤーにそのまま見せて採点する固定データ**なので対象に含める
  - 白紙設計: `blankDesignProblems` の各 `codebase`(`trayCodebase(...)` で作った部品置き場。`uses` が2か所ある)
- 今のデータを手で突き合わせた範囲では、`uses`(中級15か所・上級9か所・白紙2か所)・`superclassId`(1か所)・`interfaceIds`(4か所)の
  参照先IDはすべて同じファイル内に定義がある。**参照切れは見つかっていない見込み**(ただしステージ単位の突き合わせはテストで確かめる)。
- ID以外の参照(変更依頼の `responsibility`)は、既存の「変更依頼が2件以上あり、どれも初期のコードに変更箇所がある」
  (ステージ)・「両方の設計に変更箇所がある」(クイズ)で実質検査済み。白紙設計の `modelAnswer` は名前で引き、見つからなければ
  `sampleAnswer.ts` の `classIdByName` などが例外を投げるので「模範解答は100点になる」テストが落ちる。
- 自己継承・継承の輪は、プレイ中の操作では `setSuperclass`/`addInterface` が `'self-inheritance'`/`'inheritance-cycle'` で拒否する。
  初期データで書いた場合は素通りするが、`extendsChainIds`・`reachesSelf` は訪問済みで止まるので無限ループにはならない。

### 本当に新しい仕組みが要るか(ponytail)

- ドメインに検査関数(本番コード)を足す必要は無い。使う本番コードが無い(YAGNI)。テストファイルの中の関数で足りる。
- 既存テストファイル3つは他パイプラインが触るので編集しない。既存の `danglingFieldRefs` の移動・統合もしない(衝突回避)。
- 新しい依存・新しい型は足さない。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/infrastructure/referenceIntegrity.test.ts` | infrastructure(test) | 4章の検査関数と、その自己テスト、全題材への適用テスト(置き場所は未決事項1) |
| 変更(条件付き) | `src/infrastructure/stages/*Stages.ts` / `src/infrastructure/blankDesigns/blankDesignProblems.ts` | infrastructure | **テストが参照切れを検出したときだけ**、該当するIDの打ち間違いを数行直す |

次のファイルは**変更しない**: `stageCatalog.test.ts`・`comparisonQuizzes.test.ts`・`blankDesignProblems.test.ts`・
`Codebase.ts`・`dependencies.ts`・`sampleAnswer.ts`・`comparisonQuizzes.ts`・`src/domain/` と `src/application/` と
`src/presentation/` の全ファイル・`e2e/`。

## 3. データ/型の変更

なし。型・永続化スキーマ・題材データの構造は変えない。

## 4. TDD対象の関数

本番コードの純粋関数は増えない。代わりに、**新しいテストファイルの中に置く検査関数**を先に自己テストで固めてから
(Red → Green)、全題材に適用する。検査関数が常に `[]` を返すような壊れ方をしても気づけるようにするため、自己テストは省かない。

### 4.1 検査関数(`referenceIntegrity.test.ts` 内、export しない)

どれも `Codebase` を受け取り、参照切れを `"<参照元ID> -> <参照先ID>"` の文字列の配列で返す(見つからなければ `[]`)。
失敗時にどこを直せばよいかがテストの差分表示で分かるようにする。並びはコードベースの宣言順。

| 関数 | 参照元 → 参照先 | 使う既存ヘルパー |
| --- | --- | --- |
| `danglingUses(codebase)` | 全処理の `uses` → そのコードベースにあるメソッドID | `allClasses` |
| `danglingParents(codebase)` | 全クラスの `superclassId`・`interfaceIds` → そのコードベースにあるクラスID | `allClasses`・`parentIds` |
| `danglingFieldAccesses(codebase)` | 全処理の `reads`/`writes` → そのコードベースにあるフィールドID(**未決事項2でAかBのときだけ**) | `allClasses`・`fieldsOf`・`touchedFieldIds` |

- 参照先は「同じコードベースのどこかにあればよい」(別クラス・別ファイルでもよい)。所属クラスの妥当性は見ない。
- 未決事項4でBまたはCを選んだ場合は、`selfOrCyclicParents(codebase)` を追加する(4.2末尾のケース)。

### 4.2 自己テスト(小さな手書きの `Codebase` リテラルで。AAAパターン)

`danglingUses`
- 正常系: `uses` が同じクラスのメソッドIDを指す → `[]`
- 正常系: `uses` が別ファイルのクラスのメソッドIDを指す → `[]`
- 正常系: `uses` を省略した処理だけ → `[]`
- 異常系: `uses: ['method-missing']` → `['frag-x -> method-missing']`(処理IDと参照先IDが分かる)
- 異常系: 1つの処理の `uses` に実在IDと存在しないIDが混ざる → 存在しないIDだけが返る

`danglingParents`
- 正常系: `superclassId`・`interfaceIds` がどちらも実在するクラスを指す → `[]`
- 正常系: どちらも省略 → `[]`
- 異常系: `superclassId: 'class-missing'` → `['class-x -> class-missing']`
- 異常系: `interfaceIds: ['class-a', 'class-missing']`(`class-a` は実在) → `['class-x -> class-missing']`

`danglingFieldAccesses`(未決事項2でAかBのとき)
- 正常系: `reads`/`writes` が別クラスのフィールドIDを指す → `[]`
- 異常系: `writes: ['field-missing']` → `['frag-x -> field-missing']`

`selfOrCyclicParents`(未決事項4でBかCのとき)
- 異常系: `superclassId` が自分自身のID → 検出される
- (Cのとき)異常系: A extends B、B extends A → 検出される
- (Cのとき)正常系: A extends B、B implements C の一直線 → `[]`

テストデータは `src/domain/codebase/testFixtures.ts` の `fragment()` を使ってよい(`uses` などは spread で足す)。

### 4.3 全題材への適用テスト

検査対象を `ReadonlyArray<readonly [string, Codebase]>` の1つの配列にまとめ、`describe.each` で回す。

- `ステージ: ${stage.title}` → `stage.codebase`(`stages` 全件)
- `クイズ: ${quiz.title} 設計A` / `設計B` → `quiz.designs.a.codebase` / `quiz.designs.b.codebase`(`comparisonQuizzes` 全件)
- `白紙設計: ${problem.title}` → `problem.codebase`(`blankDesignProblems` 全件)

各対象に対し `it` を検査関数ごとに1つ(例: 「処理の uses は、そのコードベースにあるメソッドIDだけを指す」)。期待値は `toEqual([])`。

後から題材が `stages`・`comparisonQuizzes`・`blankDesignProblems` に追加されれば、**このファイルを触らずに**自動で検査対象に入る。

## 5. 受け入れ基準

- `src/infrastructure/referenceIntegrity.test.ts`(または未決事項1で決めた場所)が追加され、4.2の自己テストと4.3の適用テストが通る。
- 自己テストは、検査関数を実装する前に書いて落ちることを確認してから実装している(Red → Green)。
- 全ステージ・全クイズの設計A/B・全白紙設計について、`uses`・`superclassId`・`interfaceIds`(と未決事項2で決めた `reads`/`writes`)の
  参照切れが0件。
- 既存データに参照切れが見つかった場合:
  - 題材データ(`*Stages.ts`・`blankDesignProblems.ts`)の打ち間違いなら、正しいIDに直す。直したあとも `stageCatalog.test.ts` ほか既存テストが
    すべて通ること(点数を固定しているテストが変わる場合は、変更を止めて報告する。期待値の書き換えで通さない)。
  - 模範解答から作ったクイズの設計(`sampleAnswerCodebase`)だけで見つかった場合は、データの打ち間違いではなくドメイン操作の結果なので、
    ドメインを直さずに報告する(このテーマのスコープ外)。
  - 修正が3か所を超える場合は、まとめて直さずに報告する。
- 既存テストファイル(`stageCatalog.test.ts`・`comparisonQuizzes.test.ts`・`blankDesignProblems.test.ts`)に差分が無い。
- `npm run check`(lint + typecheck + test)が通る。テストファイルも型チェック付きlintの対象(`as` 禁止・非nullアサーション禁止・
  `no-unnecessary-condition`。`max-lines-per-function` はテストファイルでは無効)。
- E2Eテストの追加は不要(プレイヤーの操作・画面に変更が無い)。

## 6. スコープ外

- ドメイン側の「存在しないIDを黙って無視する」振る舞いの変更(プレイ中の削除操作で参照切れが起きるのは仕様どおり)。
- 模範解答を適用した後のステージ・白紙設計のコードベースの検査(プレイ中の操作と同じ扱い。クイズの設計だけは固定データなので対象)。
- 既存の `danglingFieldRefs`・`allIds` の移動・統合(`stageCatalog.test.ts` は他の3パイプラインが変更予定で衝突するため)。
- クイズ・白紙設計へのID重複検査(`allIds` 相当)の追加。今回の目的(参照切れ)とは別。必要になったら同じファイルに足す。
- `superclassId` がインターフェース役のクラスを指していないか、`interfaceIds` がインターフェース役を指しているか、などの「種類の整合」。
- 変更依頼の `responsibility`・`partName`、白紙設計の `modelAnswer` の名前などID以外の参照(未決事項3で決める。推奨は見ない)。
- 検査関数を `src/domain/` の本番コードとして公開すること(使う本番コードが無い。ステージJSONの外部読み込みなどを作るときに移す)。

## 7. 未決事項

### 未決事項1: 検査関数とテストをどこに置くか

- 選択肢A(推奨): `src/infrastructure/referenceIntegrity.test.ts` を1つ新規作成し、検査関数もその中に置く(export しない)。ステージ・クイズ・白紙設計の3か所をまたぐので `infrastructure/` 直下に置く。既存ファイルとの衝突が無い
- 選択肢B: `src/infrastructure/stages/referenceIntegrity.test.ts` に置く(中身はAと同じ)。ステージのテストの近くにまとまるが、クイズ・白紙設計も `stages/` 配下のテストから検査することになる
- 選択肢C: 検査関数をテスト用ヘルパー(例: `src/infrastructure/referenceIntegrity.ts`)に切り出し、既存の3テストファイルから呼ぶ。既存テストファイルに差分が出るので、進行中のパイプラインと衝突しやすい

### 未決事項2: フィールド参照(`reads`/`writes`)も新しいテストで検査するか

- 選択肢A(推奨): ステージ・クイズ・白紙設計のすべてで検査する。関数1つを全対象に一律で当てるだけで済む。ステージの分は既存の `danglingFieldRefs` と重複する(打ち間違い1件で2つのテストが落ちる)が害は無い。`data-placement-quizzes` がフィールドを使うステージ(Feature Envy・値オブジェクト)の設計をクイズに足す予定なので、クイズ側の検査が役に立つ
- 選択肢B: クイズ・白紙設計だけ検査し、ステージは既存テストに任せる。重複は無いが、対象ごとに検査関数の組み合わせを変える分岐が要る
- 選択肢C: 検査しない(01-discovered.mdの見立てどおり `uses`・`superclassId`・`interfaceIds` だけ)。コードは最小。クイズ・白紙設計のフィールド参照は無検査のまま

### 未決事項3: ID以外の参照(変更依頼の `responsibility` など)もついでに検査するか

- 選択肢A(推奨): 検査しない。ステージは「どの変更依頼にも初期コードに変更箇所がある」、クイズは「両方の設計に変更箇所がある」で実質検査済み、白紙設計の `modelAnswer` は名前が見つからなければ例外で落ちる
- 選択肢B: 白紙設計の変更依頼の `responsibility` が部品置き場のどれかの処理にあるかを検査する(既存テストで直接は見ていない唯一の箇所)

### 未決事項4: 自己継承(`superclassId`・`interfaceIds` が自分自身)や継承の輪を検査に含めるか

- 選択肢A(推奨): 含めない。今回は参照切れ(存在しないID)だけにする。輪はIDの打ち間違いでは起きにくく(2クラスが互いを指すように書く必要がある)、ドメイン側は訪問済みで止まるので無限ループにもならない
- 選択肢B: 自己参照だけ検査する(`parentIds(codeClass)` に自分のIDが含まれない)。1行の条件で済む
- 選択肢C: 自己参照と継承の輪の両方を検査する。親をたどって自分に戻るかを見る10行程度のループをテストファイルに書く(`setSuperclass.ts` の `reachesSelf` は export されていないので、ドメインは触らずにテスト側で書く)
