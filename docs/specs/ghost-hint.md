# 少しだけヒント(ドラッグのゴーストアニメーション)

## 背景・目的

詰まったプレイヤーが使えるのは、今は「ヒントを見る」(模範解答を1手ずつ文章で明かす、`stuck-player-hints`)と「解答を再生」(模範解答の手順を全部見せる、`sample-answer-replay`)の2つ。どちらも答えを言葉や図でそのまま見せるので、「自分で解いた感覚がなくなる」と使うのをためらうプレイヤーがいる。

そこで、その手前の段階として「少しだけヒント」を用意する。押すと、**次に動かすとよいブロックの半透明の影(ゴースト)が、キャンバス上で移動先へスーッと動いて消える**。名前や文章で答えを言わず、「これをあっちへ持っていけばいいのか」と自分で気づいた感覚を残す。

### 設計判断(対話で確定済み)

- **きっかけ**: 「少しだけヒント」ボタンを押したときだけ再生する。30秒操作がないときは勝手に再生せず、**ボタンを目立たせて知らせるだけ**(自力で考えている人の邪魔をしない)。
- **対象の手**: ドラッグでできる手だけ(Move Method・Move Field・クラスを別ファイルへ移す)。模範解答の中から「今のコードで動かせて、まだ動かしていない」最初の手を選ぶ。ドラッグの手が残っていなければボタンは押せない。
- **文章ヒントとの関係**: 別々にする。ゴーストは何度でも見られ、「ヒントを見る」の開いた数には数えない。

## ponytailチェック

1. YAGNI: 抽出・継承の設定など、ドラッグでない手の演出は作らない。プレイヤーの今の状態から最適な次の一手を探すロジックは作らず、模範解答の順に「まだ済んでいないドラッグの手」を選ぶだけにする(`stuck-player-hints` と同じ割り切り)。
2. 既存の再利用: 模範解答の手順(`sampleAnswerSteps`)と名前での引き方(`sampleAnswer.ts`)、ドラッグ中の見た目(`MethodChipView`・`FieldChipView`・`class-drag-preview`)、キャンバスを寄せる `fitView`(`FitViewForRule` と同じ使い方)。
3. 標準機能: 動きは CSS の `transition`(`transform`・`opacity`)で作る。`prefers-reduced-motion` はCSSのメディアクエリで見る。新しい依存(アニメーションライブラリ)は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/ghostMove.ts` | domain | 新規 | `nextGhostMove`(模範解答から、今のコードで見せるドラッグの手を1つ選ぶ) |
| `src/domain/stage/ghostMove.test.ts` | domain(test) | 新規 | 上記のテスト |
| `src/presentation/stage/GhostHintButton.tsx` | presentation | 新規 | 「少しだけヒント」ボタン。放置時に目立たせる |
| `src/presentation/stage/useIdle.ts` | presentation | 新規 | 一定時間操作がないかを返すフック |
| `src/presentation/canvas/GhostAnimation.tsx` | presentation | 新規 | ゴーストを `document.body` へ `createPortal` で出し、移動元から移動先へ動かして消す |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | 再生中のゴースト `ghost: GhostMove \| null` と `playGhost()`・`clearGhost()` を足す。ステージ切り替え・リセットで `null` にする |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `ghost` が立ったら移動元・移動先のノードへ `fitView` で寄せてから `GhostAnimation` を出す |
| `src/presentation/stage/StagePanel.tsx`(または #103 後のヒント欄) | presentation | 変更 | 「ヒントを見る」ボタンの隣に `GhostHintButton` を置く |
| `src/index.css` | presentation | 変更 | ゴーストの半透明・移動の `transition`、ボタンを目立たせる見た目、`prefers-reduced-motion` のときの代わりの見た目 |
| `e2e/ghost-hint.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

#103(サイドバーの整理)・#107(ヒントから光らせる)もヒント欄を変更する。後から実装するほうが、先にマージされたほうに合わせる。#107 の `stepTargets` に名前を例外なしで引く関数ができていれば、それを再利用する。

## データ/型の変更

```ts
// src/domain/stage/ghostMove.ts
export type GhostMove =
  | { readonly kind: 'method'; readonly methodId: string; readonly toClassId: string }
  | { readonly kind: 'field'; readonly fieldId: string; readonly toClassId: string }
  | { readonly kind: 'class'; readonly classId: string; readonly toFileId: string };

/** 模範解答の手順を先頭から見て、今のコードで動かせて、まだ移動先にいないドラッグの手を1つ返す。なければ undefined。 */
export function nextGhostMove(codebase: Codebase, steps: readonly SolutionStep[]): GhostMove | undefined;
```

## 仕様

### `nextGhostMove(codebase, steps)`

- 手順を先頭から順に見て、`move`・`moveField`・`moveClass` の手だけを候補にする(それ以外は飛ばす)。
- 名前を今のコードベースで引く(`sampleAnswer.ts` と同じ規則。`fromClass` があれば絞り込む)。見つからない名前を含む手は飛ばす(前の手で作られるメソッドを、プレイヤーがまだ作っていない場合など)。例外は投げない。
- すでに移動先にある手は飛ばす(メソッド・フィールドの持ち主が移動先のクラス、クラスのファイルが移動先のファイル)。
- 最初に見つかった手を返す。
- 元のCodebaseを変更しない。

### ボタン(`GhostHintButton`)

- 文言は「少しだけヒント」。`nextGhostMove(今のコードベース, sampleAnswerSteps[stage.id] ?? [])` が `undefined` なら押せない(`title`: `ドラッグで動かす手は残っていません`)。
- 変更依頼の実装中・手で直すシミュレーション中・ゴースト再生中は押せない。
- 押すと `playGhost()` でゴーストを再生する。何度でも押せる。「ヒントを見る」の開いた数は変えない。

### 放置したときの知らせ(`useIdle`)

- 30秒間、コードベースの変更・メソッドやフィールドの選択・キャンバスやサイドバーでのクリック/キー入力がなければ「放置」とみなす(`// ponytail: 判定は30秒固定。ステージや難易度で変えたくなったら引数にする`)。
- 放置中は、押せる状態のボタンだけを目立たせる(強調色の縁取りがゆっくり明滅する)。`prefers-reduced-motion` のときは明滅させず、強調色の縁取りだけにする。
- 何か操作したら目立たせるのをやめ、また30秒数え直す。
- ゴーストを勝手に再生はしない。
- 100点になったステージ、変更依頼の実装中は数えない。

### ゴーストの再生(`GhostAnimation`)

1. まず移動元と移動先(メソッド・フィールドなら両方のクラス、クラスなら移動元のクラスと移動先のファイル)のノードが画面に入るよう `fitView` で寄せる(`FitViewForRule` と同じ考え方。寄せる時間ぶん待ってから次へ)。
2. 移動元の要素(`[data-method-id]`・`[data-field-id]`・`[data-testid="class-header-…"]`)と、移動先の要素(`[data-testid="class-…"]`・`[data-testid="file-…"]`)の `getBoundingClientRect()` を測る。
3. ドラッグ中と同じ見た目(`MethodChipView`・`FieldChipView`・`class-drag-preview`)を半透明(不透明度0.5前後)にしたゴーストを、移動元の位置に出す。
4. 約1.2秒かけて移動先の中央へ動かし、移動先を一瞬強調する。その後0.4秒ほどで消し、`clearGhost()` する。全体で2秒前後。
5. ゴーストは `document.body` へ `createPortal` で出す(`DragOverlay` と同じ理由。React Flow の `transform: scale()` でずれないように)。`pointer-events: none` にし、操作を止めない。
6. 要素が見つからなければ何も出さずに `clearGhost()` する。
7. ゴーストの再生中にプレイヤーが操作したら、ゴーストはそのまま消える(コードベースが変わったら `clearGhost()`)。

### アクセシビリティ

- `prefers-reduced-motion: reduce` のときは動かさない。代わりに、移動元と移動先を2秒ほど同時に強調表示する(既存の `--flagged` の見た目でよい)。
- スクリーンリーダー向けに、再生時に `aria-live="polite"` の領域へ「{ブロック名} を {移動先の名前} へ動かすと良さそうです」と出す(目で見えない人には文章で伝えるしかないため)。
- ボタンはキーボードで押せる(普通の `<button>`)。

## TDD対象の純粋関数

### `nextGhostMove`(`src/domain/stage/ghostMove.ts`)

- 正常系: 最初の手が `move` で、メソッドが移動元にある → `{ kind: 'method', methodId, toClassId }`
- 正常系: 最初の手が `extract`(ドラッグでない)で、次が `move` → `move` の手を返す
- 正常系: 1つ目の `move` がすでに済んでいる(メソッドが移動先にある) → 次のドラッグの手を返す
- 正常系: `move` するメソッドがまだない(前の `extract` を打っていない) → その手を飛ばして次のドラッグの手を返す
- 正常系: `moveField` → `{ kind: 'field', … }`、`moveClass` → `{ kind: 'class', … }`
- 正常系: `fromClass` 付きの手で、同名メソッドが複数クラスにある → `fromClass` のクラスのものを返す
- 境界: ドラッグの手がない・すべて済んでいる → `undefined`
- 境界: 空の手順 → `undefined`
- 元のCodebaseを変更しない

## 受け入れ基準

1. `npm run check` が通る。`nextGhostMove` にAAAパターンのテストがある。
2. 中級3を開いて「少しだけヒント」を押すと、模範解答の最初のドラッグの手のメソッドの半透明のゴーストが、移動先のクラスへ動いて消える。コードベースは変わらない(点数・Undo履歴も変わらない)。
3. その手を自分で実行すると、次に押したときは次のドラッグの手のゴーストになる。ドラッグの手が残っていなければボタンは押せない。
4. 「少しだけヒント」を何度押しても、「ヒントを見る」の開いた数は変わらない。
5. 30秒操作しないとボタンが目立ち、何か操作すると元に戻る。ゴーストは勝手に再生されない。
6. `prefers-reduced-motion: reduce` のときは動かず、移動元と移動先が強調表示される。
7. E2E(`e2e/ghost-hint.spec.ts`): 2〜6を確認する(放置は Playwright の時計(`page.clock`)で進める。reduced motion は `page.emulateMedia`)。既存のE2Eが無変更で通る。
8. `npm run test:e2e` が通る。

## スコープ外

- ドラッグでない手(Extract Method・統合・継承の設定・可視性の変更・クラスやファイルの追加/削除)の演出。
- 放置したときの自動再生。
- プレイヤーの今の状態から最適な次の一手を探すロジック(模範解答の順に選ぶだけ)。
- ゴーストの軌跡(線)を残す表示・移動速度の設定。
- 文章ヒント・解答の再生との連動(開いた数・再生位置の共有)。

## 未決事項

なし。きっかけ・対象の手・既存ヒントとの関係は対話で確定済み。秒数・不透明度・文言は受け入れ基準を満たす範囲で実装者の裁量。
