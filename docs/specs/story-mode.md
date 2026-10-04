# ストーリーモード(架空の会社の1年間として、ステージと変更依頼をつなぐ)

> **注意(他の仕様との関係)**: #60(変更の痛みカード)・#71(理解度チェック)も100点のときにサイドバーへ表示を足す。
> 先にマージされたものがあれば、この仕様の「章の結び」はそれらの**下**に置く(並び: 痛みカード → 理解度チェック → 章の結び)。

## 背景・目的

ステージは1つずつ独立した練習問題として並んでいて、**「自分が分けたコードに、後から変更依頼が来る」**という実務の時間の流れが感じにくい。
変更依頼の仕組み(`change-request` / `implement-change-request`)はあるが、ツールバーの「変更依頼に挑戦」ボタンを押す作業になっている。

そこで、ステージを**架空の会社「ブロック商事」の開発チームの1年間**としてつなぐ、薄い物語の層を足す。

- 各ステージの始めに、その章の**導入**(誰から、どんな状況で、このコードを任されたか)を出す
- 100点になったら、章の**結び**として「数か月後、こんな依頼が来た」と変更依頼へつなぎ、そのまま「依頼を受ける」で変更依頼に挑戦できる
- 章を終えたら「次の章へ」で、次のステージへ進む

ステージ・採点・変更依頼の仕組みそのものは変えない。物語は表示とボタンだけ。ストーリーは**表示を切り替えるだけのモード**で、オフなら今の画面と同じ。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/story/Story.ts` | domain | 新規 | `StoryChapter` 型と、`chapterOf` / `nextChapter`(TDD、下記) |
| `src/domain/story/Story.test.ts` | domain | 新規 | 上記のテスト |
| `src/infrastructure/story/storyChapters.ts` | infrastructure | 新規 | 章のデータ(全ステージぶん。下記の書き方) |
| `src/infrastructure/story/storyChapters.test.ts` | infrastructure | 新規 | 章のデータの検証(下記) |
| `src/infrastructure/story/storyPreference.ts` | infrastructure | 新規 | ストーリーのオン/オフを `localStorage` に読み書きする(`progressStorage.ts` と同じ作り。例外を投げない) |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `storyEnabled: boolean` と `setStoryEnabled(enabled)`(保存も行う)。初期値は保存値、無ければ `false` |
| `src/presentation/stage/StoryIntro.tsx` / `StoryOutro.tsx` | presentation | 新規 | 章の導入・結び(下記) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | ヘッダーに「ストーリー」の切り替えを足す。サイドバーに導入・結びを置く |
| `src/index.css` | presentation | 変更 | `.story-card` のスタイル |
| `e2e/story-mode.spec.ts` | E2E | 新規 | オンで導入が出る、100点で結びが出て依頼・次の章へ進める(下記) |

`application` 層の変更は無い。「依頼を受ける」は既存の `startChangeRequests`、「次の章へ」は既存の `selectStage` を呼ぶだけ。

## 見た目・内容の仕様

### ストーリーの切り替え

- ヘッダー(`StageSelect` の近く)に、トグルボタン `ストーリー`(`aria-pressed`、`data-testid="story-toggle"`)
- オン/オフは `localStorage` の `refactor-blocks:story` に保存する(1人の閲覧者の好み。読めない・書けないときは `false` として遊べる)
- オフのときは、導入・結びを一切出さない(今の画面と同じ)
- 対象はリファクタリングのモードだけ(設計くらべ・白紙設計には出さない)

### 章の導入(`StoryIntro`)

- ストーリーがオンで、今のステージに章があるとき、左サイドバー「課題とヒント」の**先頭**(課題文の上)に出す
- 中身: `第N章 <章の題名>`、話し手(例: `先輩の田中さん`)と、導入の文章(2〜4文)
- `閉じる` で、そのステージにいる間は隠す(ステージを切り替えたら、また出る。状態はコンポーネント内でよい)
- 章が無いステージでは出さない

### 章の結び(`StoryOutro`)

- ストーリーがオンで、今のステージに章があり、採点の対象のコードが100点のときに、サイドバーへ出す(位置は冒頭の注意を参照)
- 中身:
  - 結びの文章(1〜3文。例:「3か月後。営業の佐藤さんから、こんな相談が来ました」)
  - そのステージの最初の変更依頼の見出し(`changeRequests[0].title`)
  - `依頼を受ける` ボタン → `startChangeRequests()`(既存の「変更依頼に挑戦」と同じ。変更依頼の調査・実装中は出さない)
  - `次の章へ` ボタン → `nextChapter` の次のステージへ `selectStage`。最後の章なら、ボタンの代わりに「1年間、おつかれさまでした」の一文
- 変更依頼の結果を見終えて戻ってきたとき(`lastChangeReport !== null`)も、結びと「次の章へ」はそのまま出る

### 章の書き方(全ステージ)

- 舞台は架空の会社「ブロック商事」。登場人物は架空の人物(実在の人物・会社・製品の名前を使わない)。3〜4人に絞る(例: 先輩、PM、営業、QA)
- 1章 = 1ステージ。`stages` の並び順で第1章から。1年間(4月の入社 → 翌3月)の時間の流れにする
- **導入**: 誰から、どんな事情で、このコードを任されたか。ステージの `description` の内容を物語の言葉で言い換える(課題の答え・解き方は書かない)
- **結び**: そのステージの最初の変更依頼(`changeRequests[0]`)が「後から来た」ことにつなぐ。依頼の中身と矛盾させない
- 説教・用語の説明はしない(「なぜ」は #60・#64・#71 の領分)。1文は短く

## データ・型の変更

```ts
// src/domain/story/Story.ts
export type StoryChapter = {
  readonly stageId: string;
  readonly title: string;
  /** 話し手。例: '先輩の田中さん' */
  readonly speaker: string;
  readonly intro: string;
  readonly outro: string;
};

/** そのステージの章と、章の番号(1始まり)。無ければ undefined。 */
export function chapterOf(chapters: readonly StoryChapter[], stageId: string): { readonly chapter: StoryChapter; readonly number: number } | undefined;

/** 次の章。最後の章・章の無いステージなら undefined。 */
export function nextChapter(chapters: readonly StoryChapter[], stageId: string): StoryChapter | undefined;
```

章は `Stage` 型には足さない(ステージ定義と物語を分け、物語を入れ替え・外しやすくする。`Stage` の必須項目もこれ以上増やさない)。

## TDD対象の純粋関数

### `chapterOf`

1. 章があるステージなら、その章と、並びでの番号(1始まり)を返す
2. 章の無いステージなら `undefined`

### `nextChapter`

1. 途中の章なら、その次の章
2. 最後の章なら `undefined`
3. 章の無いステージなら `undefined`

### 章のデータ(`storyChapters.test.ts`)

1. すべての章の `stageId` が `stages` に存在する
2. `stageId` が重複しない
3. 章の並びが `stages` の並びと同じ順(章の無いステージがあってもよいが、順序は崩さない)
4. 今の全ステージに章がある(このあとステージを足したときに、章の書き忘れに気づける)
5. `title`・`speaker`・`intro`・`outro` が、前後の空白を除いて空でない

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(ストーリーはオフで始まるので、既存のE2Eは変わらない)
- ヘッダーの「ストーリー」をオンにすると、サイドバーの先頭に `第N章` の導入が出る。閉じると、そのステージの間は消える
- 100点になると結びが出て、「依頼を受ける」で変更依頼が始まる。「次の章へ」で次のステージへ移り、次の章の導入が出る
- 最後の章では「次の章へ」の代わりに締めの一文が出る
- オフにすると、導入・結びが消え、今の画面と同じになる。オン/オフはリロード後も残る
- `localStorage` が使えない環境でも、ストーリーはオフとして遊べる
- 全ステージに章があり、登場人物・会社は架空のもの
- 採点・点数・変更依頼の仕組み・既存のサイドバーの表示が、オフのときに変わらない

## スコープ外

- 章ごとの選択肢・分岐する物語
- 物語を進めないと次のステージを選べない、などの制限(今までどおり全ステージを選べる)
- キャラクターの絵・アニメーション・音声
- 2件目以降の変更依頼を物語でつなぐこと(結びは最初の依頼だけ)
- 物語の進み具合の保存(どの章まで読んだか)・ステージ一覧(#67)への表示
- 白紙設計モード・設計くらべクイズへの適用
