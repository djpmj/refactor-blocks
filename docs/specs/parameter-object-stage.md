# parameter-object-stage: 中級13「引数が7個もある予約メソッド」(Long Parameter List → Introduce Parameter Object)を足す

- 重複の確認: 既存の実装・仕様書に Long Parameter List / Parameter Object のステージは無い(`src/`・`docs/specs/` を `Parameter Object`・`引数オブジェクト`・`Long Parameter` で検索して0件)。
  `docs/feature-ideas/IDEAS.md` の 2026-10-10「4. Long Parameter List / Parameter Objectステージ」が未仕様化のまま残っており、本仕様がそれにあたる。
- 下敷き: 上級7 Value Object・中級6 Feature Envy(`docs/specs/cohesion-value-object-anemic.md`・`fields-and-feature-envy.md`)の「値をフィールドとして持つクラス + Feature Envy で振る舞いを寄せる」仕組みをそのまま使う。

## 背景・目的

対象プレイヤー(新卒〜4年目)は、`reserve(email, checkIn, checkOut, adults, children, roomType, planCode)` のような引数の多いメソッドを書きがちで、
メソッドを分けるとその引数がさらに増える(Extract Method で抽出したメソッドが同じ値を5個・6個と受け取る)。
「いつも一緒に渡している値は1つの概念なので、クラスにまとめ、その値を使うルールもそこへ寄せる」(Introduce Parameter Object → Move Method)を練習するステージを、中級の末尾に1本足す。

### 調べて分かったこと(設計の前提。「既存の仕組みで足りるか」の結論)

1. **メソッドの引数を変える操作が1つも無い。** `Method.parameters` を書き換えるのは Extract Method だけで、それも抽出した**新しい**メソッドの引数を処理の `variables` から推論するだけ(`methodSignature.ts` の `inferExtractedSignature`)。
   Move Method・Merge Methods(A の引数をそのまま使う)・Inline Method・可視性の変更・Move Field は引数に触らない。ステージのデータに最初からある「引数7個のメソッド」は、今の操作ではどう組み替えても7個のまま残る
2. **処理の `variables.uses` はデータで固定。** 同じ処理が「引数を使う」か「フィールドを読む(`reads`)」かは変えられないので、
   Inline して抜き直しても、推論される引数は同じになる。上級7(Money)・中級8(Extract Class)のやり方(フィールドを Move Field で集める)は「値のまとまり」は表せるが、**引数の多さは表せない**
3. **よって「引数の数による減点ルール」だけを足しても直しようがない**(減点が消える操作が無い)。逆に「まとめる操作」だけを足して減点を足さないと、
   まとめずに抽出・移動するだけで100点になり、主題(引数をまとめる)が採点に表れない。**操作1つと採点ルール1つは最小限として必要**と判断した
4. **「値のまとまり」の表し方は上級7と同じでよい。** 別クラスのフィールドを読む処理は、C# の書き出しでその相手をコンストラクタで受け取り `_stayPlan.checkIn` と書く(`csharpWiring.ts`)。
   フィールドの値は補助コードの `SampleValues`(反射で名前の合うフィールドに入れる)で与える(`runtime/advanced-value-object.ts`)。
   引数をフィールドに置き換えれば、Feature Envy・依存・凝集度・カプセル化の採点と C# の書き出しが**何も変えずに**効く
5. 採点ルールを全ステージに効かせると、既存ステージで抽出したメソッドが推論で5個以上の引数を持つ場合(中級12 の `frag-service-total` は変数を12個作る など)に点数が変わりうる。
   `visibilityEnforced`・`layers` と同じく**ステージごとに有効にする**(`parameterLimit` を書いたステージだけ数える)
6. `isCodebase`(保存した下書きの読み込み = 信頼境界の検証)は `Method.parameters` と `Fragment.callArguments` を検証していない。新しい操作はこの2つを読むので、ここで検証を足す

## 設計判断(確定)

1. **新しい操作「引数をまとめる」(Introduce Parameter Object)を1つ足す。** まとめる引数とクラス名は、ステージ作者が引数に付けた隠しタグ `group`(= 引数オブジェクトのクラス名)で決める。
   プレイヤーは引数を選ばず、名前も付けない(クラス名を考えさせない方針。`classNames` による自動命名と同じ考え方)。
   引数を1つずつ選ぶ UI は作らない(このステージでは「予約者のメールアドレスはまとめない」が `group` の有無で表せるので足りる)
2. **まとめた引数は、新しいクラスの public フィールドになる。** メソッドからその引数を消し、メソッドの処理の `variables.uses` にあったその名前を `reads`(新しいフィールドのID)へ移す。
   呼び出し元の `callArguments` からは、まとめた引数の位置の実引数を消す。値の受け渡しは上級7と同じく「相手のクラスのフィールドを読む」で表す(前提4)
   - `// ponytail: 引数オブジェクトは呼び出しごとに new して渡さず、上級7の Money と同じく受け取る側がコンストラクタで受け取る1つのインスタンスとして書き出す。呼び出しごとの値の受け渡しを C# でも表したくなったら、引数の型にゲームのクラスを使えるようにする`
3. **新しい採点ルール `long-parameter-list`(引数の多いメソッド)を足す。** ステージの `parameterLimit`(1メソッドの引数の上限)より多い引数を持つメソッド1つにつき -10。`parameterLimit` を書かないステージは常に0件(前提5)
4. **既存の引数オブジェクトへの追加(2つ目のメソッドを同じクラスへまとめる)は作らない。** このステージで `group` を持つメソッドは1つだけ。同じまとまりを持つメソッドが2つ以上あるステージを作るときに足す(ponytail コメントを残す)
5. **まとめる引数を、メソッドの中の呼び出し行で別のメソッドへ渡しているときは、まとめられない**(`err('parameters-passed-on')`)。
   先に Extract Method してから「まとめる」と、抽出したメソッドの引数(推論で付いた5個)は `group` を引き継がず取り残され、そのあと Inline すると C# で未定義の変数になる。
   操作で止めて「先に呼び出し元へ戻してから」と案内する(Ctrl+Z でも戻せる)
6. **中級の末尾(中級12の次)に置く。** 前提は中級6(Feature Envy)・中級8(Extract Class)。上級の番号を振り直さずに済む
7. **E2E を足す。** 新しい操作のボタンがメソッドエディタに増えるため(CLAUDE.md「プレイヤーの操作に関わる変更は E2E を追加」)

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/Codebase.ts` | domain | `Method.parameters` の要素に `group?: string` を足す |
| 新規 | `src/domain/codebase/introduceParameterObject.ts` + `.test.ts` | domain | 操作 `introduceParameterObject` と、実引数の分割 `splitArguments` |
| 変更 | `src/domain/codebase/isCodebase.ts` + `.test.ts` | domain | `parameters`(`type`・`name` は文字列、`group` は任意の文字列)と `callArguments`(任意の文字列配列)を検証する |
| 新規 | `src/domain/scoring/longParameterLists.ts` + `.test.ts` | domain | `findLongParameterLists` |
| 変更 | `src/domain/scoring/score.ts` + `score.test.ts` | domain | `ScoreRule` に `'long-parameter-list'`、`scoreCodebase` の `Pick` に `'parameterLimit'`、内訳の配列の末尾に足す |
| 変更 | `src/domain/scoring/violationTargets.ts` + `.test.ts` | domain | `'long-parameter-list'` の違反箇所(メソッド)を足す |
| 変更 | `src/domain/scoring/fileScores.ts` + `.test.ts` | domain | `fileDeductionReasons` に `'long-parameter-list'`(メソッドのファイル)を足し、`Pick` に `'parameterLimit'` |
| 変更 | `src/domain/stage/Stage.ts` | domain | `parameterLimit?: number` |
| 変更 | `src/domain/stage/sampleAnswer.ts` + `.test.ts` | domain | 模範解答の手 `introduceParameterObject` と `applyStep` の分岐。`StructuralStep` の `Exclude` に足す |
| 変更 | `src/domain/stage/stepTargets.ts` + `.test.ts` | domain | `MethodStep` に足し、対象はそのメソッド |
| 変更 | `src/domain/stage/sampleAnswer.ts` の `sampleAnswerSteps` | domain(データ) | `'intermediate-parameter-object'` の5手 |
| 変更 | `src/application/RefactorUseCases.ts` + `.test.ts` | application | `introduceParameterObjectUseCase`・`describeIntroduceParameterObjectError` |
| 変更 | `src/presentation/store/useGameStore.ts` + `.test.ts` | presentation | アクション `introduceParameterObject(methodId, group)`(履歴に積む) |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | `MethodActions` に「引数 … を {group} にまとめる」ボタン |
| 変更 | `src/presentation/stage/describeSolutionStep.ts` + `.test.ts` | presentation | 新しい手のヒント文 |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | `RULE_LABEL['long-parameter-list'] = '引数の多いメソッド'` |
| 変更 | `src/presentation/stage/ruleWhy.ts` | presentation | `RULE_WHY['long-parameter-list']` |
| 変更 | `src/presentation/guide/OperationGuideDialog.tsx` | presentation | 操作ガイドに「引数をまとめる」を1項目足す |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | `parameterObjectStage` を定義し、`intermediateStages` の**末尾**(`middleManStage` の次)に足す |
| 新規 | `src/infrastructure/stages/runtime/intermediate-parameter-object.ts` | infrastructure | C# 実行用の `intermediateParameterObjectRuntime`(全ステージに runtime が必須) |
| 新規 | `src/infrastructure/stages/parameterObjectStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 初期違反の種類の表に1行、近道(`shortcuts`)に2件 |
| 変更 | `src/infrastructure/stages/stageReport.ts` | infrastructure | `OPERATION_LABEL` に `introduceParameterObject: '引数をまとめる'` |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 中級12の章の次に新しい章を足す |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成(`stageReport.test.ts` のファイルスナップショット) |
| 新規 | `e2e/parameter-object.spec.ts` | E2E | 「引数をまとめる」ボタンの操作 |
| 変更 | `e2e/reference-menu.spec.ts` | E2E | `runtimeStages` に `['中級13: 引数が7個もある予約メソッド', 'intermediate-parameter-object']` を1行足す |

- 新しい依存は足さない。`csharpWiring.ts`・`generateClassSource.ts`・`fragmentCode.ts`・`methodSignature.ts`・既存の採点ルールは変更しない(前提4)。
- **衝突注意**: 他の「ステージを足す」仕様と同時に進めると、`intermediateStages` の末尾・`sampleAnswerSteps`・`storyChapters`・`stageCatalog.test.ts` の表・`ScoreRule` の並び(`score.test.ts` の内訳の配列)がぶつかる。後からマージする側がタイトルの番号と並びを合わせ直す。

## データ・型の変更

### `Method.parameters`(`Codebase.ts`)

```ts
readonly parameters?: readonly {
  readonly type: string;
  readonly name: string;
  /**
   * 「引数をまとめる」でまとめる先の引数オブジェクトのクラス名(隠しタグ)。同じ値の引数が2つ以上あるとき、その引数たちを1つのクラスにまとめられる。
   * responsibility・duplicateGroup と同じくステージ作者が書く。省略時はまとめる対象にしない。
   */
  readonly group?: string;
}[];
```

`inferExtractedSignature` は引数を `LocalVariable` に写すので `group` は抽出先へ引き継がれない(設計判断5の前提。変更しない)。

### `Stage.parameterLimit`(`Stage.ts`)

```ts
/** 1メソッドの引数の数の上限。超えたメソッド1つにつき「引数の多いメソッド」で減点する。省略時は採点しない。 */
readonly parameterLimit?: number;
```

### 操作(`src/domain/codebase/introduceParameterObject.ts`)

```ts
export type IntroduceParameterObjectError = 'method-not-found' | 'parameter-group-not-found' | 'parameters-passed-on' | 'call-arguments-mismatch';

/**
 * Introduce Parameter Object: メソッドの引数のうち group が同じものを、新しいクラスの public フィールドにまとめる。元の Codebase は変更しない。
 * - 新しいファイルを、メソッドの持ち主のファイルと同じフォルダに `<フォルダ>/<クラス名>.ts` で作り、group と同じ名前のクラス(autoNamed なし)を置く。
 *   クラス名・パスが使われていれば uniqueName で番号を付ける
 * - フィールド: id `${ids.classId}:${引数名}`、name は引数名、visibility 'public'、type `{ csharp: 引数の型 }`。引数の並び順
 * - メソッド: まとめた引数を parameters から消す(残りが0個なら parameters の項目ごと消す)
 * - メソッドの各処理: variables.uses にあるまとめた引数名を取り除き(空になれば uses を、declares も無ければ variables を消す)、
 *   そのフィールドIDを reads の末尾へ足す(重複なし、既存の reads の順は保つ)
 * - 呼び出し元: uses にこのメソッドIDを持つ全処理の、同じ添字の callArguments を splitArguments で分け、まとめた引数の位置を除いて ', ' でつなぐ
 *   (callArguments が無い・その添字が無い処理はそのまま)
 * 検査の順: メソッドが無い → group の引数が2個未満 → まとめる引数名を variables.uses に持つ呼び出し行(responsibility 'call')がメソッドの中にある
 *   → 呼び出し元の実引数の数が、まとめる前の引数の数と違う。
 * ponytail: 既存の引数オブジェクトへは足さない(毎回新しいクラス)。同じまとまりを持つメソッドが2つ以上あるステージを作るときに、同じ group のクラスを探して足す
 */
export function introduceParameterObject(
  codebase: Codebase,
  methodId: string,
  group: string,
  ids: { readonly classId: string; readonly fileId: string },
): Result<Codebase, IntroduceParameterObjectError>;

/**
 * 実引数の文字列をトップレベルのカンマで分け、前後の空白を除く。空文字(空白だけ)なら []。
 * ponytail: () [] {} の入れ子と "..." の中だけを見る。ジェネリクスの型引数(<a, b>)や文字リテラルを含む実引数を渡すステージを作るときに字句解析にする
 */
export function splitArguments(text: string): string[];
```

ファイル・クラスの追加は既存の `addFile`・`addClass` を使う。フォルダは持ち主のファイルの `path` の最後の `/` より前。

### 模範解答の手(`sampleAnswer.ts`)

```ts
| { readonly introduceParameterObject: { readonly method: string; readonly class: string; readonly group: string } }
```

`applyStep` で `changeVisibility` の次に扱う。ID は `{ classId: newId, fileId: `${newId}:file` }`。`class` は必須(同名メソッドがありうるため)。
`applyStep` の循環的複雑度が12を超えるなら、フィールド・可視性・引数の3つの手を1つの補助関数へ分ける。
`shouldPublicizeAfter` には足さない(呼び出し関係は変わらない)。

### 採点(`src/domain/scoring/longParameterLists.ts`)

```ts
/** 引数が parameterLimit より多いメソッドのIDを出現順に返す。parameterLimit が undefined なら常に []。 */
export function findLongParameterLists(codebase: Codebase, parameterLimit: number | undefined): string[];
```

`score.ts`: `'long-parameter-list': findLongParameterLists(codebase, stage.parameterLimit).length`。内訳の並び(`deductions` の配列)は `'mixed-method'` の次(末尾)。
`violationTargets.ts`: メソッドIDを足す。`fileScores.ts`: `['long-parameter-list', findLongParameterLists(codebase, stage.parameterLimit)]`。

### ユースケース(`RefactorUseCases.ts`)

```ts
/** ID(クラス・ファイル)を generateId で2つ振って introduceParameterObject を呼ぶ。成功したら新しいクラスのIDも返す。 */
export function introduceParameterObjectUseCase(
  codebase: Codebase, methodId: string, group: string, generateId: () => string,
): Result<{ readonly codebase: Codebase; readonly classId: string }, IntroduceParameterObjectError>;
export function describeIntroduceParameterObjectError(error: IntroduceParameterObjectError): string;
```

文言:

- `method-not-found`「メソッドが見つかりません」
- `parameter-group-not-found`「まとめられる引数がありません」
- `parameters-passed-on`「この引数を別のメソッドへ渡しています。先に抽出したメソッドを「呼び出し元へ戻す」で戻してから、まとめてください」
- `call-arguments-mismatch`「呼び出し元が渡している値の数が引数の数と合わないため、まとめられません」

## 動きの仕様

### 「引数をまとめる」ボタン(`MethodEditor.tsx` の `MethodActions`)

- 選んだメソッドの `parameters` に、同じ `group` を持つ引数が2個以上あれば、`group` ごとに(初出順に)ボタンを1つ出す。
  ラベル「引数 checkIn・checkOut・adults・children・roomType・planCode を StayPlan にまとめる」、下に1行「いつも一緒に渡している引数を、1つのクラスのフィールドにまとめます(Introduce Parameter Object)」
- 押すとストアの `introduceParameterObject(methodId, group)`。`blockDuringOpeningFix` を通し、成功したら `commit(…, '引数をまとめる')` で履歴に積む(Ctrl+Z・取り消しで戻せる)。選択中のメソッドはそのまま。
  失敗したら他の操作と同じく `message` に `describeIntroduceParameterObjectError` の文言を出す
- ネイティブの `button` なので Tab で届き Enter / Space で押せる
- 新しいファイルとクラスは、Move Method でファイルの枠外へ出したとき(`moveMethodToNewClass`)と同じ既存の配置の仕組みでキャンバスに出る
- `group` を持つ引数はこのステージの `reserve` にしか無いので、**既存ステージ・白紙設計ではボタンは出ない**

### 操作ガイド(`OperationGuideDialog.tsx`)

`<dt>引数をまとめる</dt><dd><div>メソッドをクリック → 「引数 … をまとめる」</div><div>いつも一緒に渡している引数を、新しいクラスのフィールドにまとめます(Introduce Parameter Object)。</div></dd>` を「呼び出し元へ戻す」の次に足す。

### ヒント文(`describeSolutionStep.ts`)

`${class} の ${method} の引数を、メソッドエディタの「引数 … を ${group} にまとめる」で1つのクラスにまとめよう(Introduce Parameter Object)`

### 採点の表示

- `RULE_LABEL`: `'引数の多いメソッド'`。クリア条件は既定の文言「引数の多いメソッド: 0件にする」で出す(`describeCondition.ts` は変えない。上限の数はゴール文に書く)
- `RULE_WHY`:
  - trouble「引数が多いメソッドは、呼ぶたびに全部を正しい順に並べる必要があります。同じ型の引数(日付が2つなど)を入れ違えても気づけず、値を1つ足すだけで呼び出しをすべて直すことになります。」
  - because「いつも一緒に渡す値を1つのクラスにまとめると、受け渡しが1つで済み、その値を使うルールの置き場所もできます。」

## ステージ: 中級13(`intermediateStages.ts` の末尾)

### 基本項目

| 項目 | 値 |
| --- | --- |
| id | `intermediate-parameter-object` |
| level | `'intermediate'` |
| runtime | `intermediateParameterObjectRuntime` |
| title | `中級13: 引数が7個もある予約メソッド` |
| problem | `予約メソッドが7個の引数を受け取り、日程・人数・部屋の条件をばらばらに扱っている` |
| outcome | `一緒に渡される引数を1つのクラスにまとめ、ルールを寄せられる` |
| learns | `['Long Parameter List', 'Introduce Parameter Object']` |
| principles | `['encapsulation', 'srp']` |
| limits | `{ method: 18, class: 24, file: 24 }` |
| dependencyLimit | `1` |
| responsibilityLimit | `2` |
| parameterLimit | `4` |
| visibilityEnforced | 省略(移動したメソッドは自動で public になる) |

- description: `ホテルの予約サイト。ReservationService の reserve は、予約者のメールアドレス・チェックイン日・チェックアウト日・大人の人数・子どもの人数・部屋タイプ・料金プランの7個を引数で受け取る。日程と人数が部屋の定員に収まるかの確認も、泊数と料金の計算も reserve の中に直接書かれていて、ReservationController は呼ぶたびに7個を正しい順に並べて渡している。`
- goal: `いつも一緒に渡している日程・人数・部屋・プランの6個を、1つのクラス(StayPlan)にまとめよう。メソッドエディタの「引数をまとめる」で引数オブジェクトを作り、そのフィールドを使う確認と料金計算を Extract Method して StayPlan へ移す。メールアドレスは予約者の値なので、まとめずに残す。メソッドの引数は4個まで、メソッドは18行・クラスとファイルは24行以内、1クラスの責務は2種類まで、依存先は1クラスまで`
- why: `引数が多いと、呼ぶ側は全部を正しい順に並べる必要があり、値を1つ足すだけで呼び出しをすべて直すことになります。一緒に動く値を1つのクラスにまとめると、受け渡しが1つで済み、その値を使うルールの置き場所もはっきりします。`
- responsibilityNames: `http: 'リクエストの受付'`、`'stay-validation': '宿泊条件の確認'`、`'stay-price': '宿泊料金の計算'`、`'reservation-save': '予約の保存'`、`notification: '予約の通知'`
- classNames(自動命名。初期のクラス名・`StayPlan` と重ねない): `http: 'ReservationHttpHandler'`、`'stay-validation': 'StayValidator'`、`'stay-price': 'StayPriceCalculator'`、`'reservation-save': 'ReservationRepository'`、`notification: 'ReservationMailer'`
- methodNames: `http: 'handleRequest'`、`'stay-validation': 'validateStay'`、`'stay-price': 'calculatePrice'`、`'reservation-save': 'saveReservation'`、`notification: 'sendConfirmation'`

### 初期コードベース

`lines` はコードの行数と一致させる(`stageCode.test.ts`)。1行に文は1つ。行頭が `return` の行は書かない。
**まとめる引数の名前(checkIn など)は `$"..."` の補間の中に書かない**(`qualifyForeignMembers` は文字列の中を置き換えないため、まとめたあとに C# が壊れる)。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数・戻り値) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/booking/ReservationController.ts`(`file-reservation-controller`) | ReservationController(`class-reservation-controller`) | `submit`(`method-submit`・public・`ReservationForm form`) | `frag-submit-check-form` / フォームの入力がそろっているか確かめる / 2 / `http`<br>`frag-submit-reserve` / ReservationService.reserve() を呼び出す / 1 / `call` / uses `method-reserve`、callArguments `['form.Email, form.CheckIn, form.CheckOut, form.Adults, form.Children, form.RoomType, form.PlanCode']`、variables `{ declares: [reservationId: string], uses: ['form'] }`<br>`frag-submit-response` / 予約を受け付けたことを返す / 1 / `http` |
| `src/booking/ReservationService.ts`(`file-reservation-service`) | ReservationService(`class-reservation-service`) | `reserve`(`method-reserve`・public・下記の7引数・returns `[reservationId: string]`) | `frag-reserve-check-stay` / チェックアウトがチェックインより後か、人数が部屋タイプの定員に収まるか確かめる / 3 / `stay-validation` / suggestedName `validateStay`<br>`frag-reserve-calc-price` / 泊数を数え、大人・子どもの人数と料金プランから宿泊料金を計算する / 4 / `stay-price` / suggestedName `calculatePrice`<br>`frag-reserve-save` / 部屋を押さえて予約を保存し、予約番号を受け取る / 3 / `reservation-save`<br>`frag-reserve-mail` / 予約番号と料金を確認メールで知らせる / 2 / `notification` |

`reserve` の引数(この順):
`{ type: 'string', name: 'guestEmail' }`、
`{ type: 'DateTime', name: 'checkIn', group: 'StayPlan' }`、`{ type: 'DateTime', name: 'checkOut', group: 'StayPlan' }`、
`{ type: 'int', name: 'adults', group: 'StayPlan' }`、`{ type: 'int', name: 'children', group: 'StayPlan' }`、
`{ type: 'string', name: 'roomType', group: 'StayPlan' }`、`{ type: 'string', name: 'planCode', group: 'StayPlan' }`

各 Fragment の C# コードと `variables`(補助コードの名前は runtime に合わせて変えてよいが、行数と「どの値を使うか」は変えない):

```csharp
// frag-submit-check-form    variables: { uses: ['form'] }
if (form is null) throw new ArgumentNullException(nameof(form));
if (string.IsNullOrWhiteSpace(form.Email)) throw new ValidationException("メールアドレスを入力してください");
// frag-submit-response      variables: { uses: ['reservationId'] }
Console.WriteLine($"[HTTP 201] 予約 {reservationId} を受け付けました");
// frag-reserve-check-stay   variables: { declares: [capacity: int], uses: ['checkIn', 'checkOut', 'roomType', 'adults', 'children'] }
if (checkOut <= checkIn) throw new ValidationException("チェックアウトはチェックインより後の日付にしてください");
var capacity = RoomTypes.CapacityOf(roomType);
if (adults + children > capacity) throw new ValidationException($"この部屋の定員は {capacity} 名です");
// frag-reserve-calc-price   variables: { declares: [nights: int, nightlyRate: decimal, childRate: decimal, price: decimal], uses: ['checkIn', 'checkOut', 'planCode', 'adults', 'children'] }
var nights = (checkOut.Date - checkIn.Date).Days;
var nightlyRate = Plans.RateOf(planCode);
var childRate = nightlyRate / 2;
var price = nights * (adults * nightlyRate + children * childRate);
// frag-reserve-save         variables: { declares: [room: string, reservationId: string], uses: ['roomType', 'nights', 'price'] }
var room = FakeRooms.Hold(roomType, nights);
var reservationId = FakeReservations.Save(room, price);
Log.Info($"予約 {reservationId} を保存しました");
// frag-reserve-mail         variables: { declares: [body: string], uses: ['reservationId', 'price', 'guestEmail'] }
var body = $"予約 {reservationId} を承りました。料金は {price:N0} 円です";
FakeMailer.Send(guestEmail, body);
```

- `frag-reserve-save` が使うまとめる値は `roomType` の1つだけ、`frag-reserve-mail` は0個にする(模範解答のあと `reserve` に Feature Envy が残らないため。下の検算)

### runtime(`src/infrastructure/stages/runtime/intermediate-parameter-object.ts`)

`advanced-value-object.ts` と同じ形で書く。

- `entryMethodId: 'method-submit'`、`entryArguments: ['SampleData.Form']`(入口は `group` を持たないので、まとめても入口の引数は変わらない)
- `support`: `logFile` と `Booking.cs`:
  `ValidationException`、`ReservationForm`(`Email`・`CheckIn`・`CheckOut`・`Adults`・`Children`・`RoomType`・`PlanCode` のプロパティ)、
  `RoomTypes.CapacityOf(string)`(4 を返す)、`Plans.RateOf(string)`(12000m を返す)、何をしたかを1行出す偽物 `FakeRooms.Hold(string, int)`・`FakeReservations.Save(string, decimal)`(`"R-1001"` を返す)・`FakeMailer.Send(string, string)`、
  `SampleData.Form`(2026-12-24〜26・大人2・子ども1・`"Twin"`・`"BREAKFAST"`・`"guest@example.com"`)、
  `SampleValues`(上級7と同じ反射の補助。`checkIn`・`checkOut`・`adults`・`children`・`roomType`・`planCode` に `SampleData.Form` と**同じ値**を入れる)と
  `public partial class StayPlan { public StayPlan() => SampleValues.Apply(this); }`(初期状態でも partial 単独でビルドできる。まとめる前とあとで出力が同じになる)
- `expectedBuildFailures` は付けない(移動で public になるので途中の手でもビルドできる)

### 変更依頼(changeRequests。この順に並べる。どちらも modify)

| # | id | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-child-age-rate` | 子どもの料金を年齢で分けて | 小学生は大人の半額、小学校に入る前の子どもは無料にしたい。 | `stay-price` | 3 | `applyChildAgeRate` | なし(最初に全文を見せる modify) |
| 2 | `req-max-nights` | ネット予約は14泊までにして | 長い連泊は電話の窓口で受けるので、ネットからの予約は14泊までにしたい。 | `stay-validation` | 2 | `limitMaxNights` | `{ from: 'QAの高橋さん', text: '長い連泊の予約が入って、部屋の割り当てで困ったことがあったらしいです。' }` |

ボス(`boss: true`)は付けない(ボスのあるステージを固定で列挙しているテストを変えないため)。

### 理解度チェック(checks。正解は最長の選択肢にしない・正解の位置を2問で変える)

- `check-1`(answer: 1)「引数が7個もあるメソッドの、いちばんの困りごとは?」
  - 0: `メソッドの処理が、引数の数に比例して遅くなっていくこと` / `速さはほとんど変わりません。困るのは、呼ぶ側と直す側の手間です。`
  - 1: `呼ぶたびに全部を正しい順に並べ、値を足すと呼び出しも直すこと` / `一緒に動く値が別々に渡されるので、呼ぶ側の手間と、変更のたびの修正箇所が増えます。`
  - 2: `引数が多いとコンパイラが型を確かめられなくなり、型の誤りがそのまま実行時まで残ること` / `型は確かめられます。ただし同じ型の引数(日付が2つなど)は、入れ違えても気づけません。`
- `check-2`(answer: 0)「引数をクラスにまとめたあと、次にするとよいことは?」
  - 0: `そのフィールドを使う確認や計算を、まとめたクラスへ移すこと` / `値とそれを使うルールが同じクラスにそろい、ルールを探す場所が1か所になります。`
  - 1: `まとめたクラスのフィールドを、すべて private にして getter を付けること` / `getter を足すだけでは、ルールは使う側に残ったままです。`
  - 2: `まとめたクラスを、使う側のクラスごとに1つずつコピーして持たせること` / `コピーすると、同じルールを何か所も直すことになります。`

### 模範解答(`sampleAnswerSteps['intermediate-parameter-object']`、5手)

```ts
[
  { introduceParameterObject: { method: 'reserve', class: 'ReservationService', group: 'StayPlan' } },
  { extract: { from: 'reserve', fragmentIds: ['frag-reserve-check-stay'], name: 'validateStay' } },
  { move: { method: 'validateStay', toClass: 'StayPlan' } },
  { extract: { from: 'reserve', fragmentIds: ['frag-reserve-calc-price'], name: 'calculatePrice' } },
  { move: { method: 'calculatePrice', toClass: 'StayPlan' } },
]
```

8手未満なので方針の表(`solutionPhaseTable`)は足さない。

### ストーリー(`storyChapters.ts`)

中級12の章の次(上級1の章の前)に足す。中級12の章は変えない。

`{ stageId: 'intermediate-parameter-object', title: '引数の多い予約', speaker: SUZUKI, intro: 'ホテル予約のサービスを見てもらえますか。予約のメソッドを呼ぶたびに7個の値を順番どおりに並べる必要があって、先週もチェックイン日とチェックアウト日を入れ違えるバグが出ました。', outro: '2月の半ば。営業の佐藤さんが、子ども連れのお客様の声を持ってきました。' }`

### 机上の検算(手計算。実測と違えば、テストの期待値ではなく Fragment の `lines`・コードを調整して下の関係を保つ)

行数は `lineCount.ts` のとおり Fragment は「コード行数+1」、呼び出し行は 1+1 = 2、メソッドは +3 と Fragment 間の空行、クラスは +3 とメソッド間の空行。変更依頼の処理は `linesPerSite`+1。

| 対象 | 初期 | 1手目(まとめた直後) | 模範解答後 | 上限 |
| --- | --- | --- | --- | --- |
| `reserve` の行数 | 22(違反) | 22(違反) | 17 | メソッド18 |
| `submit` / `validateStay` / `calculatePrice` | 12 / — / — | 12 / — / — | 12 / 7 / 8 | メソッド18 |
| ReservationService クラス・ファイル | 25 / 25(各違反) | 25 / 25(各違反) | 20 / 20 | 24 |
| StayPlan クラス(依頼1・2を足したあと) | — | 3 | 19(23・22) | 24 |
| 引数の数 | reserve 7(違反)・submit 1 | reserve 1 | reserve 1・StayPlan のメソッド 0 | 4 |
| ReservationService の責務 | 4種(違反) | 4種(違反) | 2種(保存・通知) | 2 |
| reserve が触る StayPlan のフィールド | — | 6(Feature Envy) | 1(roomType。Feature Envy にならない) | 2未満 |
| 依存 | Controller → Service | + Service → StayPlan | 同左 | 1 |

- 初期: line-limit 3件 + responsibility 1件 + long-parameter-list 1件 = **50点**。減点の種類は `['line-limit', 'responsibility', 'long-parameter-list']`
- 1手目のあと: long-parameter-list が消え feature-envy が1件出る(**50点のまま**)。「まとめたら、次はそのデータを使うルールを寄せる」ことが減点の入れ替わりで見える
- 模範解答後: **100点**。StayPlan は `validateStay` と `calculatePrice` が checkIn・checkOut・adults・children を共有して凝集度1塊、フィールドは public なのでカプセル化の破れなし、
  StayPlan のフィールドはあるので空の入れ物にならない、移動したメソッドは自動で public なので未使用 private なし
- 変更依頼: 1件目 `req-child-age-rate` の「はっきり楽になる」は、読む行数 22 → 8(0.75倍以下)・変更が必要なクラス数 1 → 1。
  解答例の置き方(`sampleImplementation`)は StayPlan の `calculatePrice`・`validateStay` に置いて 100点(`knownChangeRequestExceptions` に足すものはない)。
  初期と解答後の変更コスト(`scoreChange`)の実測値を `parameterObjectStage.test.ts` に書き、仕様書のこの節にも追記する
- うわさ: `rumoredRequests` は1件目の modify を除くので、2件目だけがうわさを持つ。1文、「らしい」を含み、タイトル・partName・自動命名のクラス名/メソッド名を含まない
- 振る舞いのテスト: 入口は `submit`・`reserve`。まとめる・抽出・移動は実行される処理の集合を変えないので、どの手の後も緑

## TDD対象

すべて Vitest・AAA でテストを先に書く(Red → Green → Refactor)。

### `splitArguments`(domain)

- `'a, b, c'` → `['a', 'b', 'c']`
- `'form.Email, Foo(a, b), "x, y", items[0, 1], new { A = 1, B = 2 }'` → 5個(括弧・角括弧・波括弧・文字列の中のカンマで分けない)
- `''`・`'  '` → `[]`
- 前後の空白を除く(`' a ,b '` → `['a', 'b']`)

### `introduceParameterObject`(domain)

- 正常系: `reserve(email, checkIn[G], checkOut[G])` を group `G` でまとめる →
  `src/x/G.ts` のファイルに autoNamed でないクラス `G`、public フィールド `checkIn`(type `{ csharp: 'DateTime' }`)・`checkOut`、ID は `${classId}:checkIn` など / メソッドの引数は `[email]`
- 処理の書き換え: `variables.uses: ['checkIn', 'email']` → `uses: ['email']`、`reads` の末尾に `checkIn` のフィールドID / `uses: ['checkOut']` だけで `declares` も無い処理は `variables` ごと消える /
  `declares` だけ残る処理は `variables: { declares }` / もともとの `reads` は順を保ち、重複しない
- 全部の引数をまとめる → メソッドに `parameters` の項目が無い、呼び出し元の実引数は `''`
- 呼び出し元: `callArguments: ['form.Email, form.CheckIn, form.CheckOut']` → `['form.Email']` / `uses` が2つあり2つ目がこのメソッドの処理は、2つ目の要素だけ書き換える / `callArguments` の無い呼び出しはそのまま
- group の違う引数は残る(group `G` と `H` があり `G` だけまとめる)
- クラス名 `G` がすでにある → `G2` / パス `src/x/G.ts` がすでにある → 別のパス(uniqueName)
- 異常系: 存在しないメソッド → `method-not-found` / group の引数が1個・0個 → `parameter-group-not-found` /
  メソッドの中の呼び出し行(responsibility `call`)が `variables.uses` にまとめる引数名を持つ → `parameters-passed-on` /
  呼び出し元の実引数の数が引数の数と違う → `call-arguments-mismatch`
- 元の Codebase を変更しない
- つながりの確認: まとめたあと `findFeatureEnvy` がそのメソッドを返す / まとめたあとに、まとめた値だけを使う処理を `extractMethod` すると、抽出したメソッドに引数が付かない

### `isCodebase`(domain)

- `parameters` の要素の `type`・`name` が文字列でない → false / `group` が文字列でない → false / `group` 付きの正しい引数 → true
- `callArguments` が文字列の配列でない → false
- 既存のテスト用 Codebase(引数・呼び出しの実引数を持つもの)は true のまま

### `findLongParameterLists`(domain)

- `parameterLimit` が undefined → 引数10個のメソッドがあっても `[]`
- 上限4: 引数5個 → そのID / 4個 → 含まない / 引数なし → 含まない / 複数あれば出現順

### `scoreCodebase`・`violationTargets`・`fileDeductionReasons`(domain)

- `parameterLimit: 4` で引数5個のメソッド1つ → `{ rule: 'long-parameter-list', count: 1, points: 10 }`
- `parameterLimit` なし → 0件。**`score.test.ts` の内訳の配列は末尾に `{ rule: 'long-parameter-list', count: 0, points: 0 }` を足して20ルールにする**(既存の期待値の変更はこれだけ)
- `violationTargets(...)['long-parameter-list'].methodIds` がそのメソッド / `violationTargets.test.ts` のルール一覧に `'long-parameter-list'` を足す
- `fileDeductionReasons`: メソッドのあるファイルに `long-parameter-list` が1件

### `applySolutionSteps`・`stepTargets`(domain)

- `introduceParameterObject` の手で、指定クラスのメソッドの group の引数がまとまる(別クラスの同名メソッドは変わらない)
- `stepTargets` はそのメソッドIDを返す

### `introduceParameterObjectUseCase`(application)

- `generateId` を2回呼び、1回目をクラス、2回目をファイルのIDに使い、成功時に `classId` を返す
- ドメインのエラーをそのまま返す / `describeIntroduceParameterObjectError` が4種の文言を返す

### `parameterObjectStage.test.ts`(infrastructure・新規)

- 中級の末尾にあり、模範解答は5手で、初期50点から100点になる
- 初期の減点の種類が `line-limit`・`responsibility`・`long-parameter-list` で、`method-reserve` が引数の多いメソッドとメソッドの行数上限を超える
- 1手目のあと50点で、`long-parameter-list` が0件・`feature-envy` が `method-reserve` の1件。`reserve` の引数は `guestEmail` だけで、ReservationController の呼び出しの実引数は `form.Email` だけ
- 模範解答後、StayPlan が6個の public フィールドと `validateStay`・`calculatePrice` を持ち、ReservationService に残る責務は `reservation-save`・`notification` だけ(ほかは呼び出し行)
- 異常系: 先に `validateStay` を抽出してから `reserve` をまとめようとすると `parameters-passed-on`
- 変更依頼の kind が `['modify', 'modify']` で、2件目だけがうわさを持つ。1件目の変更コストが初期より解答後のほうが高い(実測値を書く)
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['intermediate-parameter-object', ['line-limit', 'responsibility', 'long-parameter-list']]` を足す
- 近道(`shortcuts`、どちらも100点未満。点数は実測):
  - `引数をまとめずに、確認と料金計算を抽出だけする`: `validateStay`・`calculatePrice` を抽出して ReservationService に残す。reserve 7個・抽出した2つが各5個の引数で、引数の多いメソッドが3件に増える(手計算40点)
  - `引数をまとめるだけで、確認と料金計算を StayPlan へ移さない`: 模範解答の1手目だけ。Feature Envy・行数・責務の混在が残る(手計算50点)
- その他の全ステージ共通の検査(模範解答で100点・解答例の依頼が100点・1件目の modify がはっきり楽になる・うわさ・自動命名・ID重複・outcome・問題文の識別子・`goal` の行数上限)は、コードの変更なしに新ステージにも効く

## 既存のテスト・生成物への影響

| 対象 | 影響 |
| --- | --- |
| `stageCatalog.ts` | 変更しない(`intermediateStages` の配列に足すだけで `stages` に入る)。中級の末尾に入るので、上級・ドリルの位置は1つずつ後ろへずれる |
| `stageCatalog.test.ts` | 上の2か所(表に1行・近道2件)を足す。「役割タグを付けた全クラス」は9のまま、ボスの11ステージは変えない |
| 既存ステージの点数 | 変わらない(`parameterLimit` を書いたステージだけ `long-parameter-list` を数える。`group` を持つ引数は新ステージにしかないので、既存ステージにボタンも出ない) |
| `score.test.ts` | 内訳の配列に `long-parameter-list` を1行足す(20ルール)。ほかの期待値は変えない |
| `violationTargets.test.ts` | ルール一覧に1つ足す |
| `nullObjectStage.test.ts` などの「上級の末尾」の検査 | 上級だけで絞っているので変わらない |
| `stageCode.test.ts` | 変更しない(「全ステージが runtime を持つ」「lines がコード行数と一致」「variables.uses が手前の処理か引数で作られる」などは新ステージにも効く) |
| `stageReport.ts` | `OPERATION_LABEL` に `introduceParameterObject: '引数をまとめる'` を足す(無いとキー名がそのまま出る)。`MAX_STEPS.intermediate` は15のままで5手は収まる |
| `stageReport.test.ts` | 変更しない。`docs/stages/report.md` のスナップショットが新ステージの行で変わるので、`npm run stage-report` で再生成してコミットする |
| `docs/stages/report.md` | 中級13の行(初期点50・主な減点「行数 -30、責務の混在 -10、引数の多いメソッド -10」・手数5・使う操作「引数をまとめる、抽出、移動」)が増え、中級の集計(ステージ数13・手数の中央値・初期点の平均)が変わる。中級の手数の中央値が下がって「レベルの中央値の手数が前のレベルより少ない」が付いた場合も、生成結果のままコミットする(テストは失敗しない) |
| `storyChapters` のテスト(全ステージに章・並びが stages と同じ) | 中級12の次に章を足すことで通る |
| E2E `reference-menu.spec.ts` | `runtimeStages` に1行足す |
| ほかの E2E | 変更しない(中級13以外にボタンは出ない。ステージ一覧に1行増えるだけ) |
| AI講評の入力 | 減点の内訳に `long-parameter-list` の行(既存ステージでは0件)が1つ増える。講評APIの検証は既知の項目だけを見るので変更不要 |

## E2E(`e2e/parameter-object.spec.ts`)

1. 「中級13: 引数をまとめると引数の多いメソッドの減点が消え、まとめたクラスができる。Ctrl+Z で戻る」
   - `selectStage(page, '中級13: 引数が7個もある予約メソッド')` → 「50点」、`expectDeduction(page, '引数の多いメソッド ×1')`
   - `reserve` をクリック → 「引数 checkIn・checkOut・adults・children・roomType・planCode を StayPlan にまとめる」ボタンがある
   - ボタンに**キーボードで**フォーカスし Enter → `expectNoDeduction(page, '引数の多いメソッド')`、Feature Envy の減点が出る、`class-StayPlan` と `file-src/booking/StayPlan.ts` が見える
   - Ctrl+Z(フォーカスを入力欄の外へ出してから)→ `class-StayPlan` が消え、「引数の多いメソッド ×1」が戻る
2. 「ほかのステージのメソッドには引数をまとめるボタンが出ない」: チュートリアル1で `printMonthlyReport` をクリック → 「をまとめる」を含むボタンが0個

## 受け入れ基準

1. ステージ一覧の中級の末尾(中級12の次)に「中級13: 引数が7個もある予約メソッド」があり、学べることに「Long Parameter List」「Introduce Parameter Object」が出る
2. 中級13を開くと初期点が50点で、`reserve` が「引数の多いメソッド」と行数超過、ReservationService が責務の混在で減点されている
3. `reserve` をクリックしてメソッドエディタの「引数 … を StayPlan にまとめる」を押す(キーボードでも押せる)と、`src/booking/StayPlan.ts` に6個のフィールドを持つ StayPlan ができ、
   コードタブで `reserve(string guestEmail)` と、ReservationController が `reserve(form.Email)` だけを渡す形になり、「引数の多いメソッド」の減点が消えて Feature Envy が出る。Ctrl+Z で元に戻る
4. 模範解答の手順どおり(まとめる → 確認と料金計算を抽出して StayPlan へ移す)に操作すると100点になる。解答例の再生でも最後に100点になる
5. 先に確認の処理を抽出してから「まとめる」を押すと、操作は行われず「先に抽出したメソッドを「呼び出し元へ戻す」で戻してから」の文言が出る
6. 100点のあと、変更依頼「子どもの料金を年齢で分けて」を StayPlan に置くと置き方が100点になる。2件目の依頼にはうわさ(QAの高橋さん)が先に出る
7. 既存ステージ・白紙設計の点数と画面は変わらない(「引数をまとめる」ボタンは出ない)
8. ストーリーをオンにすると、中級12のあとに「引数の多い予約」の章が出る
9. 「ソースをダウンロード(C#)」が中級13でも出て、`bash scripts/verify-csharp.sh` で初期・各手・完成形がビルド・実行でき、まとめる前とあとで出力が同じ
10. `docs/stages/report.md` が再生成され、中級13の行がある
11. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 引数を1つずつ選んでまとめる UI、プレイヤーがクラス名を付けること(隠しタグ `group` で決める。設計判断1)
- 既存の引数オブジェクトへ別のメソッドの引数を足すこと(設計判断4)、抽出したメソッドへ `group` を引き継ぐこと(設計判断5)
- C# で引数オブジェクトを呼び出しごとに `new` して渡す書き出し(設計判断2の ponytail。上級7と同じくコンストラクタで受け取る形のまま)
- 引数の数の減点を全ステージで有効にすること、既存ステージへの `parameterLimit` の追加(前提5)
- 値オブジェクトの不変性(フィールドを書き換えない)の採点(上級7と同じく採点しない)
- Builder パターン・フラグ引数の分割(IDEAS の別案)
- `describeCondition.ts` に「1メソッド N 個まで」の専用文言を足すこと(上限はゴール文に書く。要ると分かったら足す)
- 用語集(`glossaryTerms.ts`)・アンチパターン図鑑(`antipatterns.ts`)・パターン比較表への追加。要ると分かったら別仕様で足す
- `docs/feature-ideas/IDEAS.md` の更新(仕様の確定後に呼び出し元が行う)
