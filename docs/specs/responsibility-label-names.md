# responsibility-label-names: 責務の印(A/B/C)に、その責務の日本語名を添える

## 背景・目的

チュートリアル1を学習者の目線で遊んでいて、次の不足を見つけた。

- `printMonthlyReport()` を選ぶと、メソッドエディタの処理の一覧に `A` `A` `B` `B` `C` の印が並ぶ
  (A = 今月の売上を集計する/前月比を計算する、B = 表のヘッダー・行を組み立てる、C = 画面に出力する)
- ツアーでは「同じ英字は同じ仕事」と説明されるが、**その仕事が何という名前なのか(集計・表の組み立て・出力)はどこにも出ない**
- そのため、プレイヤーは「同じ英字どうしを集める」という記号合わせで解けてしまい、「責務 = 変更する理由ごとの仕事のまとまり」という概念が身につかない
- クリア条件の「責務の混在: 1クラス3種類まで」も、クラスの箱の「責務 3種類」も、何の3種類なのかが画面から読み取れない(バッジの `title` は `責務 A・B・C` で、英字しか出ない)

既存の [responsibility-colors](responsibility-colors.md)(実装済み)は「どう分けるかを考えるのは練習のうち」として名前をあえて隠した。
しかし処理の `label` を読めば中身は分かり、同じ英字でのグループ分けもすでに見えている。名前を添えても解き方の答えが増えるわけではない。
それより「この印は〇〇という仕事のまとまりだ」と概念に名前が付くことのほうが学習効果が大きい。そこで、印の色と英字はそのままに、**責務の日本語名**を足す。

## 設計判断(確定)

1. **名前はステージ定義に、ステージごとに持たせる**(`Stage.responsibilityNames`)。
   - `Fragment.responsibility` は `'aggregation'` のような英字のIDだけで、表示名はリポジトリのどこにも無い(`classNames` / `methodNames` は英語の識別子で、画面に出す日本語名には使えない)。
   - 責務IDごとの自動命名先(`classNames`・`methodNames`)がすでにステージごとの `Record<責務ID, string>` なので、同じ形にそろえる。全ステージ共通の辞書にしないのは、同じID(`pricing` など)でもステージによって指す仕事の範囲が違い(チュートリアル2は「小計」、中級1は「金額の計算」)、題材に合わせた言葉で出したいから。
   - フィールドは**必須**にする。型チェックで書き漏れたステージ定義が分かり、移行漏れを防げる。
2. **暫定名は許さない**。この Issue の中で、全ステージ・白紙設計の問題の全責務に名前を書く。`stageCatalog.test.ts` で「初期コードと変更依頼に出てくる責務(`call` を除く)すべてに名前がある」ことを検査する。
   - 画面側は、名前が無い責務(テスト用のステージなど)では、今と同じく英字だけを出す(落ちたり空の名前を出したりしない)。
3. **名前は見えるテキストで出す**(ホバー専用のツールチップにしない)。
   - 処理の一覧では、印の右に名前を文字で出す。行は `<label>` でチェックボックスに結び付いているので、名前はそのままチェックボックスの読み上げ名に入り、キーボード・スクリーンリーダーでも読める。
   - クラスの箱の「責務 N種類」バッジはキャンバス上で幅が限られるので、見える文字は今のまま。内訳は `title`(マウス)と、すぐ後ろの `sr-only` の文字(スクリーンリーダー)で出す。
     キーボードで操作する人が内訳を目で見られるよう、メソッドエディタの見出しの下に「選んだメソッドのクラスの責務の内訳」を文字で出す(メソッドの選択はキーボードでもできる)。
4. 印の `aria-label`(`責務 A`)は変えない。既存のE2E(`e2e/responsibility-colors.spec.ts`)と、英字で同じ種類を見分ける仕組みをそのまま使う。
5. 名前の付け方の約束(ステージ定義を書く人向け。`stageCatalog.test.ts` で一部を検査する)
   - 「何のために変わるか」が分かる短い名詞句。1〜10文字(例: `集計`・`表の組み立て`・`出力`・`税の計算`・`DBへの保存`)
   - 1つのステージの中で名前が重ならない(同じ名前の別の種類があると「種類」の数え方が分からなくなる)
   - 責務ID(英字)をそのまま書かない。`classNames`・`methodNames` の値(英語のクラス名・メソッド名)も書かない

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/Stage.ts` | domain | `Stage` に必須の `responsibilityNames` を足す |
| 変更 | `src/infrastructure/stages/tutorialStages.ts` | infrastructure | 全ステージに `responsibilityNames` を書く |
| 変更 | `src/infrastructure/stages/beginnerStages.ts` | infrastructure | 同上 |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 同上 |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 同上 |
| 変更 | `src/infrastructure/blankDesigns/blankDesignProblems.ts` | infrastructure | 白紙設計の問題(`BlankDesignProblem = Stage & …`)にも書く |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | `responsibilityNameFailures` を足し、全ステージと白紙設計の問題を検査する |
| 新規 | `src/presentation/editor/responsibilityLabel.ts` | presentation | 印の番号と名前から表示用の文字列を作る純粋関数 |
| 新規 | `src/presentation/editor/responsibilityLabel.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/editor/ResponsibilityMark.tsx` | presentation | `name?: string` を受け取り、丸の右に名前を出す。`title` を `責務 A: 集計` にする |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 処理の一覧の印に名前を渡す。見出しの下にクラスの責務の内訳を出す |
| 変更 | `src/presentation/canvas/ClassNode.tsx` | presentation | `ClassResponsibilityBadge` の `title` と `sr-only` の内訳に名前を入れる |
| 変更 | `src/presentation/tour/tourSteps.ts` | presentation | 処理の一覧を指すステップの文言に「名前」を足す |
| 変更 | `src/index.css` | presentation | 名前の文字(`.responsibility-mark__name`)と内訳の行(`.method-editor__responsibilities`)のスタイル |
| 変更 | `e2e/responsibility-colors.spec.ts` | E2E | 名前の表示・内訳を確かめるテストを足す(既存の2テストは変えない) |
| 変更 | `Stage` を直接書いているテスト用のリテラル | — | `npm run typecheck` が指す箇所に `responsibilityNames: {}` を足す(`src/domain/blank/reviewBlankDesign.test.ts`・`src/domain/progress/roadmap.test.ts`・`src/domain/progress/drafts.test.ts`・`src/infrastructure/stages/stageReport.test.ts` など) |

`application` 層は変更しない。新しい依存は足さない。

## データ・型の変更

```ts
// src/domain/stage/Stage.ts(Stage に追加)
/** 責務(Fragment.responsibility)ごとの画面に出す日本語名。例: { aggregation: '集計' }。'call' には書かない。 */
readonly responsibilityNames: Readonly<Record<string, string>>;
```

```ts
// src/presentation/editor/responsibilityLabel.ts
/** 印の番号と名前を `A 集計` にする。名前が無い(undefined・空文字)ときは `A` だけ。 */
export function responsibilityLabel(number: number, name: string | undefined): string;

/**
 * クラスの責務の内訳を `A 集計・B 表の組み立て・C 出力` にする。
 * 並びは responsibilities の順(classResponsibilities の出現順)。印の番号が無い責務は 0 として扱う(今の ClassNode と同じ)。
 */
export function responsibilityBreakdown(
  responsibilities: readonly string[],
  marks: ReadonlyMap<string, number>,
  names: Readonly<Record<string, string>>,
): string;
```

- 英字は既存の `responsibilityMarkLetter`(`src/presentation/editor/responsibilityMarkLetter.ts`)を使う
- 印の番号は既存の `responsibilityMarks`、クラスの責務は既存の `classResponsibilities` をそのまま使う
- `names` の引き方は `autoNameClasses.ts` と同じく `Object.hasOwn(names, responsibility)` で確かめる(`noUncheckedIndexedAccess` が無いので `names[x] ?? …` は `no-unnecessary-condition` に引っかかる)

ステージ定義の例(E2E で使う2つは、この名前で書く):

```ts
// チュートリアル1(tutorial-extract-method)
responsibilityNames: { aggregation: '集計', formatting: '表の組み立て', output: '出力' },

// 中級1(intermediate-cyclic-dependency)
responsibilityNames: { inventory: '在庫の確保', pricing: '金額の計算', discount: '割引', payment: '支払い', history: '注文履歴', membership: '会員ランク' },
```

保存形式(下書き・進捗)は変えない。名前はステージ定義から毎回引く。

## 動きの仕様

### メソッドエディタの処理の一覧

- `call` 以外の処理の行は、`[印] 名前 処理のlabel 行数` の順に並ぶ。例: `[A] 集計  今月の売上を集計する  6行`
- 名前は印の右に、`label` より小さく控えめな色(`var(--muted)`)で出す。ライト・ダークの両方で読めるコントラストにする
- 印の `title` は `責務 A: 集計`。名前が無い責務は今と同じ `責務 A` で、名前の文字は出さない
- 印の `aria-label` は `責務 A` のまま。チェックボックスの読み上げ名は、行の文字から `責務 A 集計 今月の売上を集計する 6行` のようになる
- 呼び出しの行(`○○() を呼び出す`)には、今と同じく印も名前も出さない

### メソッドエディタの見出しの下(クラスの内訳)

- 見出し `ReportService.printMonthlyReport() 27行` の下に、`ReportService の責務: A 集計・B 表の組み立て・C 出力` を1行で出す(`data-testid="owner-responsibilities"`)
- 中身は、選んだメソッドが属するクラスの `classResponsibilities` を `responsibilityBreakdown` に通したもの。クラスの全メソッドの処理が対象(選んだメソッドだけではない)
- 責務が0種類(呼び出しだけ・空)のときは出さない
- 抽出・移動でクラスの中身が変わると、すぐに内訳も変わる

### クラスの箱の「責務 N種類」バッジ

- 見える文字(`責務 N種類` / `責務 N種類(上限 M)`)・色・`data-testid` は変えない
- `title` を `責務 A 集計・B 表の組み立て・C 出力` にする(今は `責務 A・B・C`)
- バッジのすぐ後ろに `<span className="sr-only">`(`index.css` に既存)で `(内訳: A 集計・B 表の組み立て・C 出力)` を置く(`data-testid="class-responsibility-names-<クラス名>"`)。バッジを出さないとき(0種類・ズームで詳細を隠しているとき・部品置き場)は、これも出さない

### ツアー

- `tourSteps.ts` の `[data-tour="extract-area"]` のステップの文言を次にする。
  `処理がまとまりごとに並んでいます。左の英字と名前は責務(その処理が受け持つ仕事)の印で、同じ英字は同じ仕事です。A の処理を全部選んで「選んだ処理をメソッドとして抽出」を押そう。`

## TDD対象

### `responsibilityLabel`(presentation、`responsibilityLabel.ts`)

- `(0, '集計')` → `'A 集計'`
- `(2, '出力')` → `'C 出力'`
- `(26, '割引')` → `'AA 割引'`(既存の英字の振り方どおり)
- `(1, undefined)` → `'B'`
- `(1, '')` → `'B'`(空の名前は無いものとして扱う)

### `responsibilityBreakdown`(presentation、`responsibilityLabel.ts`)

- 責務 `['aggregation', 'formatting', 'output']`、印 `{aggregation: 0, formatting: 1, output: 2}`、名前3つ → `'A 集計・B 表の組み立て・C 出力'`
- 並びは `responsibilities` の順(印の番号順に並べ替えない): `['output', 'aggregation']` → `'C 出力・A 集計'`
- 名前が無い責務が混ざる → その責務だけ英字のみ: `'A 集計・B'`
- 印の番号が無い責務 → 番号 0 として `A`
- 空配列 → `''`
- 責務IDが `toString` のような `Object.prototype` のキーでも、名前として拾わない(`Object.hasOwn` で確かめる)

### `responsibilityNameFailures`(infrastructure のテスト内ヘルパー、`stageCatalog.test.ts`)

既存の `classNameFailures` / `methodNamingFailures` と同じ形で書き、`[...stages, ...blankDesignProblems]` の全部で失敗が空であることを確かめる。

- 初期コード(`stageResponsibilities`)と `changeRequests[].responsibility` に出てくる責務(`call` を除く)で、`responsibilityNames` に無いもの → `<stage.id>: missing <責務>`
- 名前が空、または11文字以上 → `<stage.id>: invalid <責務>`
- 名前が責務IDと同じ、または `classNames`・`methodNames` の値と同じ → `<stage.id>: identifier <責務>`
- 1つのステージで同じ名前が2つの責務に付いている → `<stage.id>: duplicate <名前>`

## 受け入れ基準

1. チュートリアル1で `printMonthlyReport()` を選ぶと、処理の一覧の印の右に `集計`(2行)・`表の組み立て`(2行)・`出力`(1行)が文字で出ている
2. 同じ画面で、チェックボックスの読み上げ名に名前が入っている(Playwright の `getByRole('checkbox', { name: /集計.*今月の売上を集計する/ })` で取れる)。Tab で処理のチェックボックスへ移動し、Space で選べる
3. 見出しの下に `ReportService の責務: A 集計・B 表の組み立て・C 出力` が出る。`集計` の2つを抽出しても、抽出したメソッドは `ReportService` に残るので内訳は変わらず、抽出してできた呼び出しの行には印も名前も出ない
4. 中級1で `Order` の箱のバッジの `title` が `責務 A 在庫の確保・B 金額の計算・C 割引・D 支払い・E 注文履歴` になっている。`class-responsibility-names-Order` の要素に同じ内訳が入っている
5. 中級1で `countOrdersOf` を `Customer` へ移すと、`Order` のバッジの内訳から `E 注文履歴` が消え、`Customer` の内訳に `E 注文履歴` が入る。メソッドエディタで `countOrdersOf` を選ぶと、見出しの下の `Customer の責務: …` にも `E 注文履歴` が出る
6. ライト・ダークの両方で、処理の一覧の名前の文字が読める(背景とのコントラスト 4.5 以上)
7. 既存の `e2e/responsibility-colors.spec.ts` の2つのテストが、変更なしで通る(印の `aria-label`・バッジの見える文字は変わらない)
8. `stageCatalog.test.ts` の `responsibilityNameFailures` が、全ステージと白紙設計の問題で空になる
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- クリア条件・採点の文言(`describeCondition.ts` の `責務の混在: 1クラスN種類まで` など)の書き換え。名前はバッジと内訳で見えるようになるので、文言はそのままにする。足りなければ別仕様で
- キャンバスのメソッドの箱(`MethodChip`)への印・名前([responsibility-colors](responsibility-colors.md) でもスコープ外)
- 印や名前でのフィルタ、同じ責務の処理をまとめて選ぶ操作
- 責務の混在・置き場所の採点の変更([class-role-misplacement](class-role-misplacement.md) の「責務ID(`tax` など)を画面に出さない」方針は守る。今回出すのは日本語名で、IDではない)
- ステージ一覧表(`npm run stage-report`・`docs/stages/report.md`)・AI講評の依頼文(`critiqueRequest.ts`)・設計の比較(`ComparisonPanes.tsx`)・変更依頼の説明(`describeChange.ts`)に名前を出すこと
- 全ステージ共通の責務名の辞書(同じIDでもステージで意味の範囲が違うため作らない。必要になったら、そのとき共通部分をくくり出す)
- 名前を見せる・隠すの切り替え設定(全ステージで常に出す)
