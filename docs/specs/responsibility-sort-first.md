# responsibility-sort-first: 抽出の前に処理を責務ごとに自分で仕分けさせ、答え合わせのあとで正解の責務を見せる

## 背景・目的

メソッドエディタでメソッドを開くと、処理の一覧に最初から責務の印と名前(例: `[A] 入力の検証`)が出る。見出しの下にはクラスの責務の内訳(`UserController の責務: A 入力の検証・B DBへの保存・C メール通知`)が出て、処理を選べば「責務が混ざります(B DBへの保存・C メール通知)」の警告と、責務ごとの自動のメソッド名(`saveUserAndSendNotification` など)も出る。
そのため、新人は「同じ英字を集めて抽出する」だけで解けてしまう。どこで仕事が切り替わるか(責務の切れ目)を、自分で読み取る練習にならない。

初級以降のステージでは、メソッドを開いたら**まず処理を自分で仕分け**させる。同じ仕事だと思う処理に同じ番号を付け、「仕分けの答え合わせ」を押すと正解の印・名前を見せる。抽出はそのあとで使えるようにする。チュートリアルとドリルは、今のまま最初から印を出す。

- チュートリアル(`level: 'tutorial'`)は対象外。ツアー(`tourSteps.ts`)が「左の英字と名前は責務の印で、同じ英字は同じ仕事です」と印を前提に操作を教えているため
- ドリル(`level: 'drill'`)は対象外。課題文が「メールの処理2つを選んで抽出しよう」のように選ぶ処理を名指ししていて、1つの操作を練習する場だから
- 白紙設計(`BlankDesignView` の `MethodEditor emptyMessage="blank"`)は対象外。問題の `level` は `'beginner'` だが、抽出ではなく部品を置く練習だから
- プレイヤーに名前は付けさせない。仕分けの番号は `1`, `2`, `3` … を選ぶだけで、クラス名・メソッド名は今どおり自動で付ける

**本当に要るか**(ponytail):

- 抽出を止めずに印だけ隠す案は採らない。処理を選べるようにすると、自動のメソッド名(`suggestMethodName` は混ざると `XAndY` になる)と混在の警告で正解が分かってしまう。仕分ける前は処理を選べないようにすれば、名前・プレビュー・警告は今のコードのまま出なくなる
- 仕分けた結果の保存(`localStorage`)は作らない。下書きから再開したときは、元のメソッドに残った処理だけを仕分け直せば足りる(抽出してできたメソッドの処理は、下の「仕分けの対象」の決め方で自動的に対象外になる)
- 「仕分けをとばす」専用のボタンは作らない。「仕分けの答え合わせ」は何も選ばなくても押せるので、それが答えを見るボタンを兼ねる

## 既存の仕様との関係

答え合わせが済むまでの表示だけを変える。答え合わせのあとは、下の既存の仕様どおりに動く(どの関数・文言も変えない)。

| 仕様 | 仕分けの前 | 答え合わせのあと |
| --- | --- | --- |
| [responsibility-colors](responsibility-colors.md) | 処理の一覧の印を出さない。クラスの箱の `責務 N種類` バッジ・クリア条件の「責務の混在」は今のまま出す(クラス単位の数で、どの処理がどの責務かは分からないため) | 今どおり。印の番号は `responsibilityMarks`(初期コードで決まる)のままで、同じ責務は同じ英字 |
| [responsibility-label-names](responsibility-label-names.md) | 処理の一覧の名前と、見出しの下の `owner-responsibilities` を出さない。バッジの `title`・`sr-only` の内訳はキャンバス上のクラス単位の一覧なので今のまま | 今どおり |
| [mixed-extract-name](mixed-extract-name.md) | 処理を選べないので、自動のメソッド名・プレビュー・`extract-mixed-heads-up` は出ない(コードは変えない) | 今どおり。`mixedResponsibilities`・`suggestMethodName`・`describeMixedHeadsUp` は触らない |
| [concept-check](concept-check.md) | 関係しない(100点のあとにサイドバーへ出る問題で、メソッドエディタは使わない) | 同左 |

チュートリアル(1・2)は今の表示のままなので、mixed-extract-name の E2E(チュートリアル2)と responsibility-label-names の E2E(チュートリアル1)は変えない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/stage/responsibilitySort.ts` | domain | 仕分けをさせるステージか(`sortsResponsibilitiesFirst`)、仕分けの対象の処理(`responsibilitySortTargets`)、仕分けの採点(`judgeResponsibilitySort`) |
| 新規 | `src/domain/stage/responsibilitySort.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/editor/describeSortResult.ts` | presentation | 答え合わせの結果の文言を作る純粋関数 |
| 新規 | `src/presentation/editor/describeSortResult.test.ts` | presentation | 上のテスト |
| 新規 | `src/presentation/editor/ResponsibilitySortList.tsx` | presentation | 仕分けの一覧(処理ごとの番号の選択欄)と「仕分けの答え合わせ」ボタン |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 仕分けの前は `FragmentList` の代わりに `ResponsibilitySortList` を出し、`OwnerResponsibilities` を隠し、抽出ボタンを押せなくする。答え合わせのあとは結果の文と処理ごとの正誤を出す |
| 変更 | `src/presentation/editor/extractDisabledReason.ts` | presentation | 定数 `SORT_FIRST_REASON` を足す |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `revealedFragmentIds` と `revealResponsibilities` を足し、ステージの切り替え・やり直しで空にする |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 上のテスト |
| 変更 | `src/index.css` | presentation | 仕分けの一覧・選択欄・正誤・結果の文のスタイル(既存の色変数だけを使う) |
| 新規 | `e2e/responsibilitySort.ts` | E2E | 補助関数 `revealResponsibilities(page)` |
| 新規 | `e2e/responsibility-sort-first.spec.ts` | E2E | 下の受け入れ基準を確かめる |
| 変更 | 初級以降のステージで処理を選ぶ・印や内訳を見る既存の E2E | E2E | メソッドをクリックした直後に `revealResponsibilities(page)` を足す(下記) |

`application` 層・`infrastructure` 層(ステージ定義)は変更しない。`Stage` 型も変えない(対象は `level` で決める)。新しい依存は足さない。

## データ・型の変更

```ts
// src/domain/stage/responsibilitySort.ts
import type { Codebase, Fragment, Method } from '../codebase/Codebase';
import type { Stage } from './Stage';

/** 抽出の前に処理を責務ごとに仕分けさせるステージか。初級・中級・上級は true、チュートリアル・ドリルは false。 */
export function sortsResponsibilitiesFirst(stage: Pick<Stage, 'level'>): boolean;

/**
 * このメソッドで、まだ仕分けていない処理(仕分けの対象)。処理の並び順。
 * 対象は次の全部を満たす処理: 呼び出しの処理(CALL_RESPONSIBILITY)ではない / 初期コード(initial)で同じIDのメソッドに入っていた /
 * revealed に入っていない。対象が2つ未満なら [](仕分けるものが無い)。
 */
export function responsibilitySortTargets(initial: Codebase, method: Method, revealed: ReadonlySet<string>): readonly Fragment[];

export type SortVerdict = 'correct' | 'wrong' | 'unsorted';

export type SortJudgement = {
  /** 処理のID → 正誤。targets の全部が入る。 */
  readonly verdicts: ReadonlyMap<string, SortVerdict>;
  readonly correctCount: number;
  readonly total: number;
  /** 正解の責務(出てくる順・重複なし)。 */
  readonly responsibilities: readonly string[];
};

/**
 * プレイヤーの仕分け(処理のID → 番号)を採点する。番号の付け方そのものは問わず、まとまり方だけを比べる。
 * 処理 f が correct ⇔ f に番号があり、「f と同じ番号の処理の集合」と「f と同じ責務の処理の集合」が targets の中で一致する。
 * 番号が無い処理は unsorted、それ以外は wrong。targets に無いIDの番号は無視する。
 */
export function judgeResponsibilitySort(
  targets: readonly Pick<Fragment, 'id' | 'responsibility'>[],
  groups: ReadonlyMap<string, number>,
): SortJudgement;
```

- `Result` 型は使わない。どの関数にも失敗が無い(知らないIDは無視し、番号の付け忘れは `unsorted` という採点結果で、エラーではない)ため。`domain/codebase/` のリファクタリング操作ではないので、CLAUDE.md の「操作は `Result` で返す」の対象にも入らない
- 責務の比較は `Fragment.responsibility` の完全一致で行う。`stage.cohesiveResponsibilities`(1メソッドに混ぜてよい組)は使わない。答え合わせで見せる印(英字)が責務ごとに別なので、それとそろえる
- 「初期コードで同じIDのメソッドに入っていた」は、`initial` の全メソッドから「処理ID → メソッドID」の対応を作って確かめる。抽出の前は仕分けが必須なので、抽出してできたメソッド(新しいID)の処理は必ず答え合わせ済みになっている。この決め方なら、下書きから再開して `revealed` が空でも、抽出済みのメソッドを仕分け直させずに済む。Move Method はメソッドのIDを変えないので、移したメソッドは対象のまま
  - `// ponytail: 呼び出すたびに初期コードを全部なめる。メソッドエディタを開くたびの1回なので今は問題にならない。重くなったら useMemo の外へ対応表を出す`

```ts
// src/presentation/editor/describeSortResult.ts
/** 答え合わせの結果の文。例: `仕分けの答え合わせ: 4個中2個が正解。正解は3種類(A 入力の検証・B DBへの保存・C メール通知)です` */
export function describeSortResult(
  judgement: SortJudgement,
  marks: ReadonlyMap<string, number>,
  names: Readonly<Record<string, string>>,
): string;
```

- 内訳は既存の `responsibilityBreakdown(judgement.responsibilities, marks, names)` をそのまま使う

```ts
// src/presentation/editor/extractDisabledReason.ts
export const SORT_FIRST_REASON = '先に処理を仕分けて「仕分けの答え合わせ」を押すと、処理を選んで抽出できます';
```

```ts
// src/presentation/store/useGameStore.ts(GameState に追加)
/** 仕分けの答え合わせが済んだ処理のID。保存しない。ステージの切り替え・最初に戻す・記録のリセットで空にする。元に戻す(undo)では変えない。 */
revealedFragmentIds: ReadonlySet<string>;
/** 答え合わせが済んだ処理を足す(新しい Set を作る)。 */
revealResponsibilities: (fragmentIds: readonly string[]) => void;
```

- 空にする場所: `selectStage`・`resetStage`・`resetStageRecord`(`selectStageState` の結果を `set` している所)。初期値は空の `Set`
- 下書き(`autosaveDrafts`)・進捗の保存形式は変えない

## 動きの仕様

### 仕分けをするか

`MethodEditor` で `sortFirst = emptyMessage === 'refactor' && sortsResponsibilitiesFirst(stage)` を求め、`MethodEditorBody` に渡す。
`MethodEditorBody` は `targets = sortFirst ? responsibilitySortTargets(stage.codebase, method, revealedFragmentIds) : []` を `useMemo` で求め、`targets.length > 0` のあいだを「仕分け中」とする。

### 仕分け中のメソッドエディタ

- 見出し(`UserController.registerUser() 11行`)とタブは今どおり。`owner-responsibilities`(クラスの責務の内訳)は出さない
- 処理の一覧の代わりに `ResponsibilitySortList` を出す(`data-testid="responsibility-sort"`、`data-tour="fragment-list"` は付けない)
  - 上に1行の説明: `同じ仕事(変わる理由が同じ)だと思う処理に同じ番号を付けて、「仕分けの答え合わせ」を押そう。番号の順番は自由です`
  - 各処理の行: `[番号の選択欄] 処理のlabel 行数`。印・責務の名前・チェックボックスは出さない。`FragmentFieldRefs`(読む・書くフィールド)は今どおり出す
  - 番号の選択欄は `<select>`。`aria-label` は `「<処理のlabel>」の仕分け先`。選択肢は `未選択`(初期値)と `1` 〜 `N`(N は対象の処理の数)。英字(A, B …)は答え合わせの印と紛らわしいので使わない
  - 対象でない処理(呼び出しの行、答え合わせ済みの処理、初期コードの別のメソッドから来た処理)は、選択欄の代わりに今の一覧と同じ表示(印・名前つき。呼び出しの行は印なし)にし、チェックボックスは出さない
  - 一覧の下に `仕分けの答え合わせ` ボタン(`data-testid="responsibility-sort-check"`)。何も選んでいなくても押せる
- 番号の選び方はコンポーネント内の `useState`(処理のID → 番号)に持つ。別のメソッドを選ぶと消える(`MethodEditorBody` は `key={method.id}` で作り直される)
- 抽出の欄(`ExtractControls`)は出したまま、ボタンの理由に `SORT_FIRST_REASON` を出して押せなくする(`disabledReason = sorting ? SORT_FIRST_REASON : extractDisabledReason(...)`)。手で直すシミュレーション中のロック(`OPENING_FIX_LOCK_REASON`)は今どおりこれより優先する。処理を選べないので、名前欄は空・プレビューと警告は出ない
- 統合(`MergeSection`)・可視性・呼び出し元へ戻す・空実装の削除は、今どおり使える(処理の選択を使わないため)

### 答え合わせ

- 押すと `judgeResponsibilitySort(targets, groups)` で採点し、`revealResponsibilities(targets の全ID)` を呼ぶ。採点結果はコンポーネント内の `useState` に持つ
- 対象が無くなるので、同じメソッドの一覧はすぐに今の表示(印・名前・チェックボックス)に変わり、`owner-responsibilities` も出る。抽出ボタンは今の条件で押せるようになる
- 一覧の上(説明の位置)に、`describeSortResult` の文を `<p role="status" data-testid="responsibility-sort-result">` で出す(読み上げられる)
- 採点した処理の行には、`<label>` の外(チェックボックスの読み上げ名を変えないため)に正誤を文字で出す: `✓ 正解` / `✗ 不正解` / `✗ 未仕分け`(`data-testid="sort-verdict-<処理のID>"`)。色だけに頼らない(✓・✗と文字)
- 結果の文と正誤は、別のメソッドを選ぶまで出し続ける。抽出で一覧から消えた処理の正誤は出さない
- 答え合わせ済みの処理は、そのステージにいる間(別のメソッドを開いて戻っても、元に戻す(undo)をしても)仕分けの対象に戻らない

### 例(初級1 `registerUser`)

処理は `入力値を検証する`(http)・`ユーザーをDBに保存する`(persistence)・`ようこそメールを送る`(notification)・`レスポンスを組み立てる`(http)。
`1, 2, 2, 1` と選んで答え合わせ → `入力値を検証する`・`レスポンスを組み立てる` は ✓、残り2つは ✗。
結果の文は `仕分けの答え合わせ: 4個中2個が正解。正解は3種類(A 入力の検証・B DBへの保存・C メール通知)です`。

### キーボード

- Tab で選択欄 → 次の選択欄 … → 「仕分けの答え合わせ」へ移れ、矢印キーで番号を選び、Enter / Space でボタンを押せる(標準の `<select>` と `<button>` を使う)
- 答え合わせのあと、フォーカスは動かさない(結果は `role="status"` で読み上げる)

## TDD対象

### `sortsResponsibilitiesFirst`(domain、`responsibilitySort.ts`)

- `beginner` / `intermediate` / `advanced` → `true`
- `tutorial` / `drill` → `false`

### `responsibilitySortTargets`(domain、`responsibilitySort.ts`)

- 初期コードと同じメソッドに `http`・`persistence`・`notification`・`http` の4処理 → 4つ全部を並び順で返す
- 呼び出しの処理(`call`)は返さない
- `revealed` に入っている処理は返さない
- 抽出してできたメソッド(初期コードに無いID)の処理 → `[]`
- 初期コードに無い処理(変更依頼の部品)→ 返さない
- 別のクラスへ移したメソッド(IDは同じ)→ 今どおり対象を返す
- 残る対象が1つ → `[]`。0個 → `[]`
- 対象が全部同じ責務(2つ)→ 2つとも返す(1種類かどうかを仕分けの前に漏らさない)

### `judgeResponsibilitySort`(domain、`responsibilitySort.ts`)

- 責務 `a, a, b, b, c`、番号 `1, 1, 2, 2, 3` → 全部 `correct`、`correctCount: 5`、`total: 5`
- 同じまとまり方で番号だけ違う(`3, 3, 1, 1, 2`)→ 全部 `correct`(番号の付け方は問わない)
- `1, 1, 2, 2, 2` → `a` の2つは `correct`、`b`・`c` は `wrong`、`correctCount: 2`
- 番号の無い処理 → `unsorted`(正解数に入らない)。何も選ばない → 全部 `unsorted`、`correctCount: 0`
- 全部同じ責務で全部同じ番号 → 全部 `correct`。2つの番号に分けた → 全部 `wrong`
- `groups` に `targets` に無いIDがある → 無視する(結果は変わらない)
- `responsibilities` は出てくる順・重複なし(`['http', 'persistence', 'notification']`)
- `targets` が空 → `verdicts` は空、`correctCount: 0`、`total: 0`、`responsibilities: []`

### `describeSortResult`(presentation、`describeSortResult.ts`)

- 4個中2個、責務 `http`・`persistence`・`notification`(印 0・1・2、名前あり)→ `仕分けの答え合わせ: 4個中2個が正解。正解は3種類(A 入力の検証・B DBへの保存・C メール通知)です`
- 全部正解・1種類 → `仕分けの答え合わせ: 2個中2個が正解。正解は1種類(B DBへの保存)です`
- 名前の無い責務は英字だけ(`responsibilityBreakdown` の既存の挙動)

### ストア(`useGameStore.test.ts`)

- `revealResponsibilities(['f1', 'f2'])` で `revealedFragmentIds` に2つ入る。もう一度 `['f2', 'f3']` で3つになる
- `selectStage`・`resetStage` のあとは空
- `undo` では変わらない

## E2E

### 新規 `e2e/responsibility-sort-first.spec.ts`

1. 初級1で `registerUser` を開くと、`responsibility-sort` が出て、処理の一覧に印(`getByLabel(/^責務 /)`)・チェックボックス・`owner-responsibilities` が無い。抽出ボタンは押せず、`SORT_FIRST_REASON` が出る
2. 同じ画面で `1, 2, 2, 1` を選んで「仕分けの答え合わせ」を押す → `responsibility-sort-result` が上の例の文になり、`入力値を検証する` の行に `✓ 正解`、`ようこそメールを送る` の行に `✗ 不正解`。一覧に印(`責務 A` など)とチェックボックスが出て、`owner-responsibilities` に `UserController の責務: A 入力の検証・B DBへの保存・C メール通知`
3. 続けて `ユーザーをDBに保存する`・`ようこそメールを送る` を選ぶ → `extract-mixed-heads-up` に `B DBへの保存・C メール通知` が含まれる(答え合わせのあとは mixed-extract-name のとおり)
4. `ようこそメールを送る` だけを選んで抽出 → できたメソッドを開くと仕分けは出ず、印 `責務 C` が出る。`registerUser` を開き直しても仕分けは出ない
5. `deleteUser` を開くと仕分けが出る。何も選ばずに答え合わせ → `3個中0個が正解`、3行とも `✗ 未仕分け`
6. キーボードだけで、Tab で選択欄へ移り、矢印キーで番号を選び、ボタンを押して答え合わせができる
7. 「最初に戻す」と、`registerUser` でまた仕分けが出る
8. チュートリアル1の `printMonthlyReport` では仕分けが出ず、今どおり印とチェックボックスが出る。ドリル1の `registerMember` も同じ

### 補助関数 `e2e/responsibilitySort.ts`

```ts
/** 仕分け中なら、何も選ばずに「仕分けの答え合わせ」を押して印を出す。仕分けが無いメソッドでは何もしない。 */
export async function revealResponsibilities(page: Page): Promise<void>;
```

### 既存の E2E の直し方

- 初級以降のステージ(`selectStage(page, '初級…' / '中級…' / '上級…')`)で、メソッドをクリックしたあとに処理のチェックボックスを操作する・印 / `owner-responsibilities` / `extract-mixed-heads-up` を確かめるテストに、クリックの直後に `await revealResponsibilities(page)` を1行足す。確かめている内容(期待値)は変えない
- 対象の見つけ方: `e2e/` で `メソッドとして抽出`・`責務 [A-Z]`・`owner-responsibilities`・`extract-mixed-heads-up`・`.fragment-list` を grep し、初級以降のステージを選んでいるファイルに絞る。`e2e/responsibility-colors.spec.ts` の中級1の2つのテストもこれに当たる
- チュートリアル・ドリル・白紙設計のテストは変えない

## 受け入れ基準

1. 初級・中級・上級のステージでメソッドを開くと、仕分けの対象が2つ以上ある間は、印・責務の名前・クラスの責務の内訳・処理のチェックボックスが出ず、番号の選択欄と「仕分けの答え合わせ」が出る。抽出ボタンは押せず、理由が出る
2. 答え合わせを押すと、処理ごとの正誤(✓/✗と文字)と、正解数・正解の責務の内訳の文が出る。その直後から、印・名前・内訳・チェックボックス・抽出が今どおりに使え、混在の警告・自動のメソッド名も mixed-extract-name のとおりに出る
3. 番号の付け方ではなく、まとまり方が合っているかで採点される(`judgeResponsibilitySort` のテストで保証)
4. 答え合わせ済みの処理と、抽出してできたメソッドでは、仕分けが出ない。ステージの切り替え・「最初に戻す」で、また仕分けが出る
5. チュートリアル・ドリル・白紙設計では、今と表示も操作も変わらない(チュートリアル1・2の既存の E2E が変更なしで通る)
6. クラスの箱の `責務 N種類` バッジ・クリア条件・採点・模範解答の再生・理解度チェックは変わらない
7. キーボードだけで仕分けと答え合わせができ、結果が読み上げられる(`role="status"`)
8. プレイヤーが名前を入力する欄は増えない(クラス名・メソッド名は今どおり自動)
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 仕分けの状態・答え合わせの結果の保存(`localStorage`)。再読み込みしたら、元のメソッドに残った処理だけ仕分け直す
- 仕分けの正解数を点数・進捗・クリアの印・ステージ一覧に反映すること
- クラスの箱のバッジ(`title`・`sr-only` の内訳)・クリア条件・`RoomToImproveNote`・ヒント・模範解答・AI講評の依頼文から責務の名前を隠すこと
- 仕分けの番号に色を付ける・ドラッグで仕分ける UI
- `cohesiveResponsibilities` の組を1つのまとまりとして正解にすること
- 仕分けをするかどうかの設定(ステージごとの切り替えフィールドや、プレイヤーが選べるスイッチ)。必要になったら `Stage` に任意のフィールドを足す
- チュートリアルに仕分けを教えるツアーのステップを足すこと
- 統合(Merge Methods)・インライン化で処理が移ったときの細かい扱い(初期コードの別のメソッドから来た処理は対象外、というだけにする)
