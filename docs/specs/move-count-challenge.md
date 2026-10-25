# move-count-challenge: 100点にしたとき、自分の手数と模範解答の手数をサイドバーに1行で出す

## 背景・目的

学習者の目線で実機で遊んで見つけた不足点。

- ゲームは「100点かどうか」しか評価しない。チュートリアル1(`tutorial-extract-method`)は抽出1回で100点になるが、
  抽出 → 元に戻す → 別の抽出 → 名前の変更…と遠回りして5回操作して100点にしても、画面の表示はまったく同じ。
- 「ねらいを定めた1手で片づく」ことの価値を伝える材料はすでにある。模範解答の手順(`sampleAnswerSteps`、
  `src/domain/stage/sampleAnswer.ts`)と、操作の履歴(`History`、`src/domain/codebase/history.ts`。
  ストアの `useGameStore` の `history`)。ただ、どちらも手数の比較には使われていない。
- `docs/feature-ideas/IDEAS.md` の 2026-10-10「7. 手数チャレンジ(最小手順スコア)」はまだ仕様になっていない。
  `sample-answer-replay.md` のスコープ外にも「模範解答との手数の比較(最小手数「パー」の仕様で扱う)」とあり、その仕様にあたる。

目的: 100点にしたとき、サイドバーに「あなたの手数: N手(模範解答: M手)」を1行で控えめに出す。
減点はせず、点数とクリア条件は変えない。比べる材料を見せるだけにして、「もっと少ない手で届くか」をもう一度試したくなるようにする。

## 設計判断(確定)

1. **手数 = 初期コードから今のコードまでの、履歴上の道のりの長さ。** `commit`(`useGameStore.ts`)を通ってコードが変わった操作を1手と数える
   (抽出・移動・統合・インライン化・可視性の変更・名前の変更・追加・削除など、何であっても1手)。何も変わらない操作は、`commit` がもともと履歴に積まないので数えない。
   - 「本当に専用のカウンターが要るか?」→ 要らない。`history.past` と今の `codebase` から計算で出す(行数を `lineCount` で計算する方針と同じで、手数をデータとして重複して持たない)。
2. **元に戻す(undo)で戻した手は数えない。やり直し(redo)で進めた手は数える。** undo は `past` から1つ減り、redo は1つ増えるので、道のりの長さがそのまま合う。
   試し打ちをして undo するのは学習として健全なので、罰しない。手数が表すのは「今の形にたどり着く道のり」。
3. **「最初に戻す」で0手に戻す。** `resetStage` は `commit(state, stage.codebase)` で履歴に積む(undo で取り消せる)ので、`past` を消すとデータを失う。
   そこで「道のり `[...past, codebase]` の中で、初期コード(`stage.codebase` と**同じ参照**)が最後に現れた位置から数える」と決める。
   - 最初に戻した直後は0手、そこから1手で1手。最初に戻したのを undo すると、戻す前の手数に戻る。
   - 初期コードと同じ参照で判定するのは、下書きの `putDraft`(`src/domain/progress/drafts.ts`)が「初期コードそのもの」を判定しているのと同じやり方。
     `resetStage` が `autoNameClasses(stage.codebase, …)` を通しても、自動命名のクラスが無い初期コードでは同じ参照が返る(`autoNameClasses` は変更が無ければ引数をそのまま返す)。
4. **前回の下書きから再開したときは数えない。** 再開直後のコードは初期コードではなく(`takeDraft` が新しく作る)、履歴も空なので、道のりに初期コードが無い。
   この場合は手数を出さず「前回の続きから再開したため、手数は数えていません」と出す。「最初に戻す」を押せばそこから数え始める。
5. **模範解答の手数 M = 模範解答の手順を順に適用して、初めて100点に届いた手の数。** `sampleAnswerSteps[stage.id].length` そのものは使わない。
   模範解答は変更依頼まで見すえた最終形まで組んでいるので、チュートリアル1は12手あるが、100点には最初の抽出1手で届く。
   全体の長さを出すと「1手で100点にしたのに模範解答は12手」となり、学習者を誤解させる。
   既存の `solutionSnapshots` と `scoreCodebase` を再利用して計算する(新しい探索は書かない)。
   - プレイヤーの手数が M より少なくなることもある(UIの1操作「新しいクラスへ移動」が、模範解答ではファイル追加・クラス追加・移動の3手にあたるなど)。
     「最短」とは言わず「模範解答」と書くだけにして、少なくても問題にしない。
6. **模範解答が無いステージ(`sampleAnswerSteps` にキーが無い・空配列・最後まで100点に届かない)では、括弧の部分を出さず「あなたの手数: N手」だけにする。**
7. **ステージごとの手数の自己ベストを保存する。** 「リプレイの再挑戦動機」(IDEAS.md の効果)を支える最小限として、少ないほうを残す。
   - 既存の自己ベスト点数(`refactor-blocks:progress`、`Progress` 型)の形は**変えない**。新しいキー `refactor-blocks:move-bests` に別に保存する。
     古い保存データしか無い人は、このキーが無いので空(`{}`)から始まる。これで後方互換になる。
   - 記録するのは、100点で、手数が数えられていて(再開した下書きではない)、変更依頼に挑戦中でないときだけ。
   - 読み込みは信頼境界なので形を確かめる(`isProgress` と同じ方針。形が壊れていたら全体を捨てて `{}`)。
8. **表示はサイドバーの1行だけ。** 100点のときに出る `UnusedPublicNote` の近くに置く。クリア画面(clear-celebration-screen、Issue #315)とは別物で、そちらには手を入れない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/history.ts` | domain | 手数を数える純粋関数 `movesSince` を足す |
| 変更 | `src/domain/codebase/history.test.ts` | domain | `movesSince` のテスト(先に書く) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | 模範解答で初めて100点に届いた手数 `sampleMovesToPerfect` を足す |
| 変更 | `src/domain/stage/sampleAnswer.test.ts` | domain | `sampleMovesToPerfect` のテスト(先に書く) |
| 新規 | `src/domain/progress/moveBests.ts` | domain | 手数の自己ベストの型 `MoveBests` と更新関数 `updateMoveBest` |
| 新規 | `src/domain/progress/moveBests.test.ts` | domain | `updateMoveBest` のテスト(先に書く) |
| 新規 | `src/infrastructure/progress/moveBestStorage.ts` | infrastructure | `localStorage` の読み書きと形の検証(`progressStorage.ts` と同じ形) |
| 新規 | `src/infrastructure/progress/moveBestStorage.test.ts` | infrastructure | `isMoveBests` の検証のテスト(`progressStorage.test.ts` にならう) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 全ステージで `sampleMovesToPerfect` が数えられること、チュートリアル1が1手であることを確かめる |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `moveBests` と `recordMoveBest` を `progressActions` に足す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 最初に戻す・undo したときの手数をストア経由で確かめる |
| 新規 | `src/presentation/stage/describeMoveCount.ts` | presentation | 1行の文言を組み立てる純粋関数 |
| 新規 | `src/presentation/stage/describeMoveCount.test.ts` | presentation | 文言のテスト |
| 新規 | `src/presentation/stage/MoveCountNote.tsx` | presentation | サイドバーの1行。手数の計算・自己ベストの記録をつなぐ |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `StageSidebar` に `MoveCountNote` を置く |
| 変更 | `src/index.css` | presentation | `.move-count` の控えめな見た目(既存の注記と同じ文字サイズ・色) |
| 新規 | `e2e/move-count.spec.ts` | E2E | 手数の表示・undo・最初に戻す・自己ベストの保存を確かめる |

application 層は変更しない(新しいユースケースは要らない。ストアが domain の純粋関数を直接呼ぶ既存の `updateProgress` と同じ形)。新しい依存は足さない。

## データ・型の変更

```ts
// src/domain/codebase/history.ts
/**
 * 初期コード start から今のコード current までの手数。道のり [...past, current] の中で start(同じ参照)が
 * 最後に現れた位置から数える。道のりに start が無ければ(下書きから再開したとき)undefined。
 */
export function movesSince(history: History, current: Codebase, start: Codebase): number | undefined;

// src/domain/stage/sampleAnswer.ts
/**
 * 模範解答の手順を順に適用して、初めて100点に届いた手の数(初期コードが100点なら0)。
 * 手順が無い・空・最後まで100点に届かないなら undefined。
 */
export function sampleMovesToPerfect(
  stage: Stage,
  steps: Partial<Record<string, readonly SolutionStep[]>> = sampleAnswerSteps,
): number | undefined;

// src/domain/progress/moveBests.ts
/** ステージID → 100点に届いた最少の手数(0以上の整数)。 */
export type MoveBests = Readonly<Partial<Record<string, number>>>;
/** 今回の手数が自己ベスト以上なら同じ参照を返す(Zustand の不要な再描画を避ける。updateProgress と同じ)。 */
export function updateMoveBest(bests: MoveBests, stageId: string, moves: number): MoveBests;

// src/infrastructure/progress/moveBestStorage.ts
export function isMoveBests(value: unknown): value is MoveBests; // object・非null・非配列、値はすべて Number.isSafeInteger かつ 0以上
export function loadMoveBests(): MoveBests;                      // キーなし・JSON不正・形が不正 → {}。例外は投げない
export function saveMoveBests(bests: MoveBests): void;           // 書き込めなくても例外を外に出さない

// src/presentation/stage/describeMoveCount.ts
export function describeMoveCount(input: {
  readonly moves: number | undefined;
  readonly sample: number | undefined;
  readonly best: number | undefined;
}): string;
```

ストア(`GameState`)に足すもの:

- `moveBests: MoveBests`(`loadMoveBests()` で初期化)
- `recordMoveBest: (stageId: string, moves: number) => void`(`updateMoveBest` が同じ参照を返したら何もしない。変わったら `saveMoveBests` して `set`)

保存形式: `localStorage` のキー `refactor-blocks:move-bests` に `{"tutorial-extract-method": 1, ...}` のJSON。
`refactor-blocks:progress` は変えない。

## 動きの仕様

- 表示する条件: `StageSidebar` で `!investigating && score.total >= 100` のとき(`UnusedPublicNote` と同じ条件)。100点を下回ったら消える。
- `MoveCountNote` は、ストアの `history`・`codebase`・`moveBests` と `stage` から次を求める。
  - `moves = movesSince(history, codebase, stage.codebase)`
  - `sample = sampleMovesToPerfect(stage)`(`useMemo` でステージごとに1回)
  - `best = moveBests[stage.id]`
- 自己ベストの記録: `moves !== undefined` のとき、`useEffect` で `recordMoveBest(stage.id, moves)` を呼ぶ(表示されている=100点かつ変更依頼に挑戦中でない、のときだけマウントされる)。
- 文言(`describeMoveCount`):
  - `moves` あり・`sample` あり → `あなたの手数: N手(模範解答: M手)`
  - `moves` あり・`sample` なし → `あなたの手数: N手`
  - 上の2つで、`best` が `moves` より小さいときだけ、括弧の中(括弧が無ければ新しく括弧を付けて)に `自己ベスト: B手` を足す。
    例: `あなたの手数: 3手(模範解答: 1手・自己ベスト: 1手)`、`あなたの手数: 4手(自己ベスト: 2手)`
  - `moves` なし → `前回の続きから再開したため、手数は数えていません`。`best` があれば `(自己ベスト: B手)` を後ろに付ける
- 要素: `<p className="move-count" data-testid="move-count">`。読み上げを毎手割り込ませないよう `role="status"` は付けない。
- 点数・クリア条件・`recordProgress`・ステージ一覧の表示は変えない。

## TDD対象

### `movesSince`(domain、`history.test.ts`)

A・B・C を別参照のコードベースとし、S を初期コードとする。

- 履歴が空で current が S → 0
- past `[S]`・current A → 1
- past `[S, A, B]`・current C → 3
- 最初に戻した直後: past `[S, A, B]`・current S → 0
- 最初に戻した後に1手: past `[S, A, B, S]`・current C → 1
- 最初に戻したのを undo した状態(`undoHistory` で作る): past `[S, A]`・current B → 2
- undo してから別の手: `recordChange` で past `[S]`・current C → 1(undo した手は数えない)
- 下書きから再開: past `[]`・current D(S と別参照、中身は同じでもよい)→ undefined
- 下書きから再開して1手: past `[D]`・current A → undefined

### `sampleMovesToPerfect`(domain、`sampleAnswer.test.ts`)

小さな手作りのステージと手順を `steps` 引数で渡す。

- 2手目で初めて100点になる手順 → 2
- 初期コードがすでに100点 → 0
- ステージIDに手順が無い → undefined
- 手順が空配列 → undefined
- 最後まで適用しても100点に届かない → undefined

カタログの確認(`stageCatalog.test.ts`、実ステージ):

- `sampleAnswerSteps` を持つ全ステージで、結果が1以上かつ `sampleAnswerSteps[stage.id].length` 以下
- `tutorial-extract-method` → 1(先にこのテストを書いて値を確かめる。1でなければ、どの手で100点になるかを調べてから期待値を直す)

### `updateMoveBest`(domain、`moveBests.test.ts`)

- 記録なし・3手 → `{ id: 3 }`
- 記録5・3手 → 3 に更新
- 記録3・3手 → 同じ参照
- 記録3・5手 → 同じ参照
- 0手 → 記録する(初期コードが100点のステージを想定)
- 他のステージの記録は残る

### `isMoveBests`(infrastructure、`moveBestStorage.test.ts`)

- `{}`・`{ a: 0, b: 12 }` → true
- `null`・配列・文字列 → false
- 値に負数・小数・`NaN`・文字列 `"3"` を含む → false

### `describeMoveCount`(presentation、`describeMoveCount.test.ts`)

「動きの仕様」の文言の各分岐(sample あり/なし × best 無し/同じ/少ない、moves なしで best あり/なし)。

### ストア(`useGameStore.test.ts`)

- チュートリアル1で抽出1回 → `movesSince(history, codebase, stage.codebase)` が 1
- 続けて `resetStage` → 0、`undo` → 1
- `recordMoveBest('x', 3)` のあと `recordMoveBest('x', 5)` → `moveBests.x` は 3 のまま、`localStorage` の `refactor-blocks:move-bests` にも 3

## 受け入れ基準

1. チュートリアル1を開き、まとまった処理を1回抽出して100点にすると、サイドバーに `あなたの手数: 1手(模範解答: 1手)` が出る
2. 100点の状態でメソッド名を変える(コードが変わる操作)と `あなたの手数: 2手(模範解答: 1手・自己ベスト: 1手)` になる。点数は100点のまま
3. 抽出 → 元に戻す → 抽出 で100点にすると `1手` と出る(undo で戻した手は数えない)
4. 何手か操作してから「最初に戻す」を押し、1回の抽出で100点にすると `1手` と出る。「最初に戻す」を元に戻すと、戻す前の手数に戻る
5. 100点を下回る操作をすると、手数の行が消える
6. 自己ベストを記録してからページを再読み込みすると(下書きから再開)、`前回の続きから再開したため、手数は数えていません(自己ベスト: 1手)` と出る。開発者ツールで `refactor-blocks:move-bests` に `{"tutorial-extract-method":1}` が入っている
7. `refactor-blocks:move-bests` に壊れた値(`"abc"`・`{"x":-1}` など)を入れて再読み込みしても画面は壊れず、自己ベストは空として扱われる。`refactor-blocks:progress` の内容と自己ベスト点数の表示は、この機能の前後で変わらない
8. 模範解答の無いステージ(あれば)では `あなたの手数: N手` だけが出る(ユニットテストで確かめればよい)
9. 変更依頼に挑戦中は手数の行が出ない
10. 1〜6 を確かめる E2E(`e2e/move-count.spec.ts`)を足す
11. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 手数による減点・加点、クリア条件の変更、称号やバッジ(IDEAS.md の「別枠で称号」は、表示だけで再挑戦が起きるかを見てから)
- クリア画面への手数の表示(clear-celebration-screen、Issue #315 の範囲。そちらとは独立に作る)
- ステージ一覧(`stage-roadmap`)のカードへの手数の自己ベストの表示
- 本当の最短手数の探索(模範解答の手順で100点に届いた手数で足りる。探索は重く、複合操作の数え方も決めないといけない)
- プレイヤーの操作手順の記録と再生(`sample-answer-replay` の範囲外のまま)
- ステージ定義が変わったときの手数の自己ベストの無効化(`stageFingerprint` との連動)。`// ponytail: ステージの手順を変えても古い自己ベストが残る。変わったステージで混乱が出たら fingerprint を併せて保存する` を `moveBests.ts` に残す
- 下書きに履歴や手数を保存して、再読み込み後も数え続けること
- 変更依頼(`changeSession`)の中の手数の記録
- `docs/stages/report.md`(`stage-report`)の「手数」列の定義の変更
