# 理解度チェック(クリア後の選択式の問題)

> **注意(他の仕様との関係)**: `Stage` に必須項目 `checks` を足す。#60(`why`)・#67(`learns`)と同じく、どれかが先にマージされたら、
> もう一方は rebase して全ステージに項目を足し直す。#62・#63・`layered-architecture-stage` で足すステージにも `checks` が要る。

## 背景・目的

プレイヤーは、ブロックを動かして100点にできても、**なぜそう分けたのかを言えるとは限らない**。減点を消す作業として解けてしまうため、
「分けた理由」「そのやり方が効く場面」が定着したかを確かめる場所が無い。

100点になったステージで、**2〜3問の選択式の問題**を出す。

- 例: 「このステージで `Mailer` を分けた一番の理由は?」→ ①行数を減らすため ②メールの変更がユーザー登録の処理に響かないようにするため ③クラスの数を増やすため
- 答えると、正解・不正解と、選んだ選択肢ごとの解説を出す

操作できたことに加えて、**理由を自分で選べるか**を確かめ、間違えた選択肢の解説で誤解を正す。採点・点数・進捗の記録は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/Stage.ts` | domain | 変更 | `checks: readonly ConceptCheck[]`(必須)と `ConceptCheck` 型を追加(下記) |
| `src/domain/stage/conceptCheck.ts` + `.test.ts` | domain | 新規 | `judgeCheck` と、定義の検証 `validateCheck`(TDD、下記) |
| `src/infrastructure/stages/*Stages.ts` | infrastructure | 変更 | 全ステージに `checks` を2〜3問ずつ足す(下記の書き方) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 全ステージの `checks` が `validateCheck` を満たす |
| `src/presentation/stage/ConceptCheckPanel.tsx` | presentation | 新規 | 問題の表示・回答・解説(下記) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | 100点のとき、左サイドバー(課題とヒント)に `ConceptCheckPanel` を出す |
| `src/index.css` | presentation | 変更 | `.concept-check` のスタイル |
| `e2e/concept-check.spec.ts` | E2E | 新規 | 100点で問題が出る、回答すると解説が出る(下記) |

`application` 層の変更は無い。回答の状態はコンポーネント内(`useState`)に持ち、ストアにも `localStorage` にも保存しない。

## 見た目・内容の仕様

### いつ・どこに出すか

- 採点の対象のコード(`changeSession?.base ?? codebase`)が100点のときだけ、左サイドバー「課題とヒント」の末尾に `理解度チェック` の見出しで出す
  - 100点を割ったら隠す(回答の状態は、そのステージにいる間は残してよい)
  - ステージを切り替えたら回答の状態を消す(`key={stage.id}` で作り直す)
- 変更依頼の調査・実装中(`changeSession !== null`)は出さない
- サイドバーが閉じているときの扱いは今のまま(自動で開くのは #60 の領分。#60 がマージ済みなら、その自動オープンで一緒に見える)

### 問題の表示と回答

- 問題ごとに `<fieldset>` と `<legend>`(問題文)。選択肢はラジオボタン(`<input type="radio">` + `<label>`)
- 各問題に `答える` ボタン。選択肢を選ぶまで `disabled`
- 答えると:
  - 正解なら `✓ 正解`、不正解なら `✗ 不正解(正解: <正解の選択肢>)`。色だけに頼らない
  - **選んだ選択肢の解説**(`choices[i].explanation`)を出す。不正解のときは、正解の選択肢の解説も続けて出す
  - その問題の選択肢は変えられなくする(答え直しは「もう一度」で)
- 全問に答えると、末尾に `3問中2問正解` と `もう一度` ボタン(全問の回答を消して最初から)
- キーボード(Tab・矢印キー・Space・Enter)だけで回答できる。結果は `aria-live="polite"` で読み上げる

### 問題の書き方(全ステージ)

- 1ステージ 2〜3問。選択肢は3〜4個、正解は1つ
- **「なぜ」を問う**。操作の手順(何をドラッグしたか)は問わない。例:
  - 「なぜこの処理を別のクラスに分けるとよいのか」
  - 「このステージの分け方が特に効くのは、どんな変更が来たときか」
  - 「この設計で、やりすぎ(分けすぎ)になるのはどんなときか」
- 誤りの選択肢は、新卒がやりがちな**もっともらしい誤解**にする(「行数を減らすため」「クラスを増やすと良い設計だから」「とにかく継承を使うため」など)。明らかに的外れな選択肢で水増ししない
- 解説は1〜2文。誤りの選択肢の解説では、**なぜそれが一番の理由ではないか**を書く
- ステージの題材(`description`)・課題(`goal`)・採点と矛盾させない。#60 の `why` がある場合は、それと矛盾しないこと
- 正解の位置が毎回同じにならないようにする(データの段階でばらす。画面での並べ替え・シャッフルはしない)

## データ・型の変更

```ts
// src/domain/stage/Stage.ts
export type CheckChoice = {
  readonly text: string;
  /** この選択肢を選んだときに出す解説。 */
  readonly explanation: string;
};

export type ConceptCheck = {
  readonly id: string;
  readonly question: string;
  readonly choices: readonly CheckChoice[];
  /** 正解の選択肢の添字(0始まり)。 */
  readonly answer: number;
};

export type Stage = {
  // …既存
  /** 100点になったときに出す理解度チェック。2〜3問。 */
  readonly checks: readonly ConceptCheck[];
};
```

```ts
// src/domain/stage/conceptCheck.ts
export type CheckJudgement = { readonly correct: boolean; readonly answer: number };

/** 選んだ選択肢の添字を採点する。範囲外の添字は不正解として扱う(例外は投げない)。 */
export function judgeCheck(check: ConceptCheck, chosen: number): CheckJudgement;

export type CheckDefinitionError =
  | 'too-few-choices'     // 3個未満
  | 'too-many-choices'    // 5個以上
  | 'answer-out-of-range'
  | 'empty-text'          // 問題文・選択肢・解説のどれかが空(前後の空白を除いて)
  | 'duplicate-choice';   // 同じ文の選択肢がある

/** ステージ定義の問題が書き方の決まりを満たすかを調べる。満たせば ok、満たさなければ最初に見つかった誤り。 */
export function validateCheck(check: ConceptCheck): Result<ConceptCheck, CheckDefinitionError>;
```

## TDD対象の純粋関数

### `judgeCheck`

1. 正解の添字を選ぶと `correct: true`
2. 別の添字を選ぶと `correct: false`、`answer` に正解の添字
3. 範囲外(負の数・選択肢の数以上)は `correct: false`

### `validateCheck`

1. 選択肢が3〜4個、正解の添字が範囲内、どの文も空でなく、選択肢が重複しなければ `ok`
2. 選択肢2個 → `too-few-choices`。5個 → `too-many-choices`
3. `answer` が範囲外 → `answer-out-of-range`
4. 問題文・選択肢の文・解説のどれかが空白だけ → `empty-text`
5. 同じ文の選択肢が2つ → `duplicate-choice`

### ステージカタログ(`stageCatalog.test.ts`)

1. 全ステージに `checks` が2〜3問ある
2. 全ステージの全問題が `validateCheck` で `ok`
3. ステージの中で問題の `id` が重複しない
4. 1ステージの中で、全問題の正解の添字が同じ値になっていない(正解の位置が偏らない。問題が2問以上のとき)

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- 100点になると、サイドバーに「理解度チェック」と、そのステージの問題が出る。100点未満では出ない
- 選択肢を選んで「答える」を押すと、正解/不正解と解説が出る。不正解のときは正解と、その解説も出る
- 答えた問題の選択肢は変えられない。全問答えると正解数と「もう一度」が出て、押すと最初からやり直せる
- ステージを切り替えると、回答の状態が消える
- キーボードだけで回答できる
- 変更依頼の調査・実装中は出ない
- 全ステージ(このあと足すステージを含む)に問題があり、書き方の決まりを満たす(テストで保証)
- 採点・点数・進捗の記録・既存のサイドバーの表示が変わらない

## スコープ外

- 正解数の保存・ステージ一覧(#67)への表示・ランキング
- 自由記述の回答・AIによる採点(「自分の言葉で説明 + AI講評」案で扱う)
- 100点前に問題を出すこと・問題を解くまで次のステージに進めない制限
- 選択肢のシャッフル
- 白紙設計モード・設計くらべクイズへの適用
- 問題の多言語化・プレイヤーが問題を作ること
