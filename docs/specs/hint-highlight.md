# ヒントの場所をキャンバスで光らせる

## 背景・目的

ヒント(`useHints`、模範解答を1手ずつ日本語にしたもの)は「`renderTemplate` を `NotificationService` へ移そう」のようにメソッド名・クラス名で書かれている。プレイヤーは、その名前のブロックをキャンバスの中から自分で探す必要があり、ステージが大きいと見つけにくい。

減点の内訳には、すでに「押すと違反箇所を光らせてそこへ移動する」仕組みがある(`score-jump-to-violations`。`focusedRule` → `violationTargets` → `MethodChip`/`ClassNode`/`FileNode` の `--flagged` 表示と `FitViewForRule` の `fitView`)。これを流用して、**ヒントごとに「キャンバスで見る」ボタンを付け、押すとそのヒントに出てくるメソッド・クラス・ファイルを光らせて画面をそこへ寄せる**。

課題文のキーワードにリンクを付ける案もあったが、`sidebar-problem-structure`(#103)で課題文はサイドバーから外し、「困っていること」には操作名を書かない方針にしたため、ヒントのほうに付ける。

## ponytailチェック

1. YAGNI: ヒント文の中の名前を1つずつリンクにはしない(文の組み立てを変える必要があり、ヒント1件に1ボタンで足りる)。
2. 既存の再利用: 光らせる見た目(`--flagged`)・`ViolationTarget` 型・`FitViewForRule` の寄せ方・`focusRule` の「対象がなければ解除する」挙動をそのまま使う。模範解答の手順(`SolutionStep`)の名前の引き方は `sampleAnswer.ts` の考え方に揃える。
3. 新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/stepTargets.ts` | domain | 新規 | `stepTargets`(模範解答の1手が触るブロックを、今のコードベースのIDで返す) |
| `src/domain/stage/stepTargets.test.ts` | domain(test) | 新規 | 上記のテスト |
| `src/presentation/stage/useHints.ts` | presentation | 変更 | ヒントの文に加えて、元の `SolutionStep` も返す |
| `src/presentation/stage/HintList.tsx` | presentation | 変更 | ヒントごとに「キャンバスで見る」ボタンを付ける |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | 光らせる対象の状態 `hintTarget: ViolationTarget \| null` と `focusHint(target)` を足す。`focusedRule` と同時には立たない(片方を立てたらもう片方を `null` にする)。`focusedRule` を `null` にしている箇所(ステージ切り替え・リセットなど)では `hintTarget` も `null` にする |
| `src/presentation/canvas/MethodChip.tsx` / `ClassNode.tsx` / `FileNode.tsx` | presentation | 変更 | `--flagged` の判定に `hintTarget` も含める |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `FitViewForRule` を、`hintTarget` が立ったときにも同じように `fitView` するよう広げる(対象のノードがなければ解除) |
| `e2e/hint-highlight.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

`#103`(`sidebar-problem-structure`)もヒント欄(`StagePanel.tsx`/`HintList.tsx`)を変更する。後から実装するほうが、先にマージされたほうに合わせる(どちらの順でも成り立つ設計にしている)。

## データ/型の変更

```ts
// src/domain/stage/stepTargets.ts
import type { Codebase } from '../codebase/Codebase';
import type { ViolationTarget } from '../scoring/violationTargets';
import type { SolutionStep } from './sampleAnswer';

/** 模範解答の1手が触るファイル・クラス・メソッドを、今のコードベースのIDで返す。今のコードベースに見つからない名前は飛ばす。 */
export function stepTargets(codebase: Codebase, step: SolutionStep): ViolationTarget;
```

ストアに足す状態(`useGameStore.ts`):

```ts
hintTarget: ViolationTarget | null;
focusHint: (target: ViolationTarget | null) => void;
```

## 仕様

### `stepTargets(codebase, step)`

名前は `sampleAnswer.ts` の `methodIdByName`/`classIdByName`/`fileIdByPath` と同じ規則で引く(`fromClass` などの絞り込みがあれば使う)。ただし見つからなくても例外にせず、その名前を飛ばす。

| 手 | 光らせる対象 |
| --- | --- |
| `extract` | 抽出元のメソッド(`from`、`fromClass` で絞る) |
| `move` | 動かすメソッドと、移動先のクラス |
| `deleteMethod` | 消すメソッド |
| `moveField` | 移動元と移動先のクラス |
| `changeVisibility` | 対象のメソッド |
| `merge` | 統合する2つのメソッド |
| `addFile` | なし |
| `deleteFile` | 消すファイル |
| `addClass` | クラスを足すファイル |
| `moveClass` | 動かすクラスと、移動先のファイル |
| `setSuperclass` | 対象のクラスと、継承元のクラス(`null` ならなし) |
| `addInterface` / `removeInterface` | 対象のクラスと、インターフェースのクラス |
| `renameClass` | 対象のクラス |

- 今後 `SolutionStep` に手が増えたとき(例: #102 の `inline`)に漏れないよう、`switch` の網羅性チェック(または既存の `'x' in step` の並びで最後を型で絞り込む書き方)で型エラーになるようにする。
- 前の手で作られるメソッド(例: 抽出してできた `logNotification`)は、プレイヤーがまだその手を打っていなければ見つからないので飛ばす。
- 重複したIDは1回だけ返す。

### 画面

- `useHints` は `{ hints: { text: string; step: SolutionStep }[]; total: number }` を返す(開いた数・ステージ切り替えの扱いは今のまま)。
- `HintList` の各ヒントの後ろに「キャンバスで見る」ボタンを置く。`aria-label` は `ヒント{n}の場所をキャンバスで見る`。
- ボタンを押すと、`stepTargets(今のコードベース, step)` を `focusHint` に渡す。対象が空なら押せない(`disabled`。理由の `title` は `まだこの名前のブロックがありません`)。
  - 「今のコードベース」は、変更依頼の実装中でなければ `codebase`。ヒントボタンは実装中は押せないため、それ以外は考えない。
- 光っているときにもう一度同じボタンを押すと解除する(`aria-pressed` で状態を示す)。減点の内訳のボタンと同じ操作感にする。
- 減点の内訳のボタンを押したら `hintTarget` は解除され、ヒントのボタンを押したら `focusedRule` は解除される。
- 光らせたあと、プレイヤーが操作(抽出・移動など)してコードが変わっても、対象のIDがまだあれば光ったままにする(`focusedRule` と同じく、対象が見つからなくなったら解除)。

## TDD対象の純粋関数

### `stepTargets`(`src/domain/stage/stepTargets.ts`)

- `move`: 動かすメソッドのIDが `methodIds`、移動先クラスのIDが `classIds` に入る
- `extract`: 抽出元メソッドのIDが入る。`fromClass` があれば、同名メソッドのうちそのクラスのものだけが入る
- `merge`: 2つのメソッドのIDが入る
- `moveField`: 移動元・移動先のクラスのIDが入る
- `deleteFile`/`addClass`/`moveClass`: ファイルのIDが `fileIds` に入る(`moveClass` はクラスも)
- `setSuperclass`: 継承元が `null` なら対象クラスだけ
- `addFile`: すべて空
- まだ存在しないメソッド名(前の手で作られるもの)は飛ばし、例外にしない。全部見つからなければすべて空
- 同じIDは重複しない
- 元のCodebaseを変更しない

## 受け入れ基準

1. `npm run check` が通る。`stepTargets` にAAAパターンのテストがある。
2. ヒントを1つ開くと、そのヒントに「キャンバスで見る」ボタンが付く。押すと、ヒントに出てくるメソッド・クラス(・ファイル)が光り、キャンバスがそこへ寄る。
3. もう一度押すと光が消える。減点の内訳のボタンを押すと、ヒントの光は消えて違反箇所の光に切り替わる(逆も同様)。
4. まだ作られていないメソッドしか出てこないヒント(例: 抽出前の「`logNotification` を移そう」)では、ボタンが押せない。前の手を打つと押せるようになる。
5. ステージを切り替える・「最初に戻す」を押すと、光は消える。
6. E2E(`e2e/hint-highlight.spec.ts`): 2〜5を確認する。既存の `score-jump` 系のE2Eが無変更で通る。
7. `npm run test:e2e` が通る。

## スコープ外

- ヒント文の中の名前を1つずつリンクにする表示。
- 課題文・「困っていること」・ストーリーからのハイライト。
- フィールド単位の光らせ方(`ViolationTarget` にフィールドがないため、`moveField` はクラスを光らせる)。
- 光らせる対象を点滅させるアニメーション(既存の `--flagged` の見た目を使う)。

## 未決事項

なし。
