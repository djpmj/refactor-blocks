# 正しい操作をしたときの手応え(点数のカウントアップと、違反が消えたブロックの演出)

## 背景・目的

違反が消えて点数が上がっても、今は点数の数字と円のゲージが一瞬で切り替わり、違反の印(赤い縁取りや矢印の色)が黙って消えるだけ。ゲームとしての「正解した!」という手応えが弱く、プレイヤーは**どの操作が効いたのか**にも気づきにくい。

そこで、プレイヤーの操作で違反が減ったときに次の演出を入れる。

- 点数が上がったら、数字をパラパラとカウントアップし、ゲージを一瞬光らせる。100点になったときは少し大きめに光らせる。
- その操作で違反がなくなったクラス・メソッド・ファイルを、一瞬緑に光らせて小さく跳ねさせる。

### 設計判断(対話で確定済み)

- **範囲**: 点数の演出と、違反が消えたブロックの演出の両方。100点時は少し大きめの演出。

## ponytailチェック

1. YAGNI: 効果音・紙吹雪・ライブラリを使った派手な演出は作らない。CSSのアニメーションと短い数値の補間だけにする。
2. 既存の再利用: 違反のあるブロックの判定は既存の `violationTargets`(減点の内訳から違反箇所へジャンプする仕組み)をそのまま使う。点数は `scoreCodebase`。「プレイヤーの操作」は、ストアの `commit`(操作の成功時だけ通る。Undo/Redo は `travelTo` で別)で見分ける。
3. 標準機能: アニメーションは CSS の `@keyframes`、カウントアップは `requestAnimationFrame`。`prefers-reduced-motion` はメディアクエリで見る。新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/scoring/resolvedTargets.ts` | domain | 新規 | `resolvedTargets`(操作の前後で、違反がなくなったブロックを返す) |
| `src/domain/scoring/resolvedTargets.test.ts` | domain(test) | 新規 | 上記のテスト |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `commit` で、操作の前後の点数と違反が消えたブロックを `celebration` に記録する(連番付き)。Undo/Redo・リセット・ステージ切り替え・下書きの復元では記録しない |
| `src/presentation/stage/StagePanel.tsx`(`ScoreBadge`) | presentation | 変更 | 点数が上がったときのカウントアップとゲージの光 |
| `src/presentation/stage/useCountUp.ts` | presentation | 新規 | 数値を短時間で補間して返すフック |
| `src/presentation/canvas/MethodChip.tsx` / `ClassNode.tsx` / `FileNode.tsx` | presentation | 変更 | `celebration` の対象なら、演出用のクラス(`--resolved`)を一度だけ付ける |
| `src/index.css` | presentation | 変更 | `--resolved`(緑に光って小さく跳ねる)、点数の光、100点時の大きめの光、`prefers-reduced-motion` のときの代わりの見た目 |
| `e2e/success-feedback.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

## データ/型の変更

```ts
// src/domain/scoring/resolvedTargets.ts
import type { Codebase } from '../codebase/Codebase';
import type { Stage } from '../stage/Stage';
import type { ViolationTarget } from './violationTargets';

/**
 * 操作の前(before)には何かの違反の対象だったが、後(after)ではどの違反の対象でもなくなったブロック。
 * after に存在しないブロック(削除・統合で消えたもの)は含めない。
 */
export function resolvedTargets(
  before: Codebase,
  after: Codebase,
  stage: Parameters<typeof violationTargets>[1],
): ViolationTarget;
```

ストアに足す状態(`useGameStore.ts`):

```ts
celebration: {
  /** 同じ対象が続けて解決しても演出をやり直せるよう、記録のたびに増やす。 */
  readonly seq: number;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly resolved: ViolationTarget;
} | null;
```

## 仕様

### `resolvedTargets(before, after, stage)`

- `violationTargets(before, stage)` の全ルールの対象(ファイル・クラス・メソッド)を合わせた集合から、`violationTargets(after, stage)` の全ルールの対象を合わせた集合を引く。
- `after` に存在しないID(`findMethod`/`findClass`/ファイルの検索で見つからないもの)は除く(消えたブロックは光らせようがないため)。
- 種類ごとに重複なし、見つかった順。
- 元のCodebaseを変更しない。

### 記録(`commit`)

- プレイヤーの操作が成功してコードベースが変わったとき(`commit` がコードベースを差し替えるとき)だけ、前後の `scoreCodebase` と `resolvedTargets` を計算し、点数が上がった、または解決したブロックが1つ以上あれば `celebration` に記録する(`seq` を1増やす)。どちらもなければ記録しない(前の記録は残してよい。演出は `seq` が変わったときだけ動く)。
- Undo/Redo(`travelTo`)・「最初に戻す」・ステージ切り替え・前回の下書きからの再開・変更依頼の実装中の操作では記録しない(取り消しで光ると、どの操作が効いたのか分からなくなるため)。
- 計算はステージの設定(`stage`)を使う。変更依頼の実装中は記録しない。

### 点数の演出(`ScoreBadge`)

- `celebration.seq` が変わり、`scoreAfter > scoreBefore` のときだけ動かす。
- 表示中の数字を `scoreBefore` から `scoreAfter` まで0.6秒前後でカウントアップする。円のゲージも同じ値で追従する。
- 同時にゲージの外側を短く光らせる(`--accent` の光が広がって消える)。
- `scoreAfter` が100のときは、光をひと回り大きく・長めにする(1秒前後)。
- 点数が下がったときは演出しない(今までどおりすぐ切り替える)。
- 読み上げ(`aria-live="polite"`)は最終の点数だけを伝え、途中の数字を読み上げない(カウントアップ中の数字は `aria-hidden` の要素で表示し、読み上げ用の要素は最終値にする)。

### ブロックの演出(`--resolved`)

- `celebration.seq` が変わったとき、`resolved` に入っているクラス・メソッド・ファイルに、緑(成功を表す色。テーマのトークンにない場合は `--success` を `:root` とダークテーマの両方に足す)の光と、小さく跳ねる(数px上がって戻る)アニメーションを0.6秒前後で1回だけ付ける。
- 演出が終わったら見た目は元に戻る(クラスを外す、または `animation` が1回で終わる指定にする)。
- 違反の強調(`--flagged`)・ドラッグ中の表示とは重ねて表示してよい。
- ブロックが画面の外にあっても、キャンバスを自動で寄せない。

### `prefers-reduced-motion: reduce` のとき

- カウントアップ・跳ねる動き・光の広がりはしない。点数はすぐ切り替え、解決したブロックは緑の縁取りを1秒ほど出して消す(動かない強調)だけにする。

## TDD対象の純粋関数

### `resolvedTargets`(`src/domain/scoring/resolvedTargets.ts`)

- 正常系: 行数上限を超えていたメソッドから処理を抽出して上限内になった → そのメソッドが `methodIds` に入る
- 正常系: 越境していた private メソッドを呼び出し元のクラスへ移した(`visibilityEnforced: true`) → 違反の対象だったメソッド・クラスが入る
- 正常系: 循環依存が解消した → 循環していたクラスが `classIds` に入る
- 境界: 別のルールでまだ違反の対象になっているブロックは入らない(例: 行数は直ったが責務の混在がまだ残るクラス)
- 境界: 操作で消えたブロック(統合で消えたメソッド・削除したファイル)は入らない
- 境界: 違反が何も変わらない操作 → すべて空
- 境界: 操作で新しく違反が増えたブロックは入らない
- 元のCodebaseを変更しない

## 受け入れ基準

1. `npm run check` が通る。`resolvedTargets` にAAAパターンのテストがある。
2. チュートリアル1で処理を抽出してメソッドが上限内になると、点数が前の値から数字をパラパラと上げながら新しい値になり、ゲージが光る。上限内になったメソッドが一瞬緑に光って跳ねる。
3. 100点になったときは、ゲージの光が通常より大きく長い。
4. 点数が下がる・変わらない操作では点数の演出は出ない。違反が消えたブロックがなければブロックの演出も出ない。
5. Undo/Redo・「最初に戻す」・ステージ切り替えでは演出が出ない。
6. `prefers-reduced-motion: reduce` のときは動かず、点数はすぐ切り替わり、解決したブロックに緑の縁取りが短く出るだけになる。
7. スクリーンリーダーには最終の点数だけが読み上げられる。
8. E2E(`e2e/success-feedback.spec.ts`): 2、4、5、6を確認する(演出用のクラスや属性が付く・付かないことで確認する。reduced motion は `page.emulateMedia`)。既存のE2E(点数の表示)が通る。
9. `npm run test:e2e` が通る。

## スコープ外

- 効果音・紙吹雪・画面全体の演出。
- 点数が下がったときの演出(注意を引く表示)。
- 違反が消えた矢印(依存・循環依存)の演出。矢印は警告表示が消えることで伝わる(`visibility-violation-edge.md`)。
- テストの状態(`TestStatus`)が変わったときの演出。
- 演出のオン/オフ設定(`prefers-reduced-motion` で足りる)。

## 未決事項

なし。演出の範囲は対話で確定済み。秒数・色の濃さは受け入れ基準を満たす範囲で実装者の裁量。
