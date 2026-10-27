# operation-score-history: 操作ごとの点数の増減と変わった減点を、ツールバーの「操作の記録」に時系列で並べる

## 背景・目的

実機で確認した事実:

- チュートリアル1(`tutorial-extract-method`、初期90点)で抽出を重ねると、操作の直後に「「行数」の減点が1件増えました(-10)」のような結果(`operation-result-feedback`)がキャンバス上部に出る。ただし8秒(`NOTICE_VISIBLE_MS`)で消え、次の操作で置き換わり、Undo でも消える
- そのため、3手・4手と進めたあとに「どの操作で点が上がり、どの操作で下がったか」を見返す手段がない。点数のゲージ(`ScoreBadge`)は今の点数しか出さず、減点の内訳(`ScoreBreakdown`)も今の状態しか出さない
- `docs/specs` に、採点の履歴・推移を扱う仕様は無い(`operation-result-feedback` のスコープ外に「過去の操作の結果の履歴一覧」と明記されている)

そこで、ツールバーに「操作の記録」のポップオーバーを足し、ステージを始めてからの操作を **時系列で「操作名・点数の増減・変わった減点」** の形で並べる。取り消し(Undo)した手は「取り消し済み」として残し、やり直し(Redo)で元に戻る。プレイヤーが操作と点数の因果を後から振り返れるようにする。

## ponytailチェック

1. YAGNI: 本当に新しい履歴のデータが要るか → **点数と減点の履歴は要らない。** 取り消し用の `History`(`src/domain/codebase/history.ts`)がすでに各手のあとの `Codebase` のスナップショットを全部持っている。道のり `[...past, current, ...future]` の隣り合う2つを `scoreCodebase` で採点すれば、点数も減点の差も計算で出る(行数を `lineCount` で計算する方針、手数を `movesSince` で計算する `move-count-challenge` と同じ)。
   ただし **操作名だけはスナップショットから復元できない**(抽出と統合、移動と新しいクラスへの移動などをコードの差分から見分けるのは重く、あいまい)。そこで操作名だけをストアに足す。
2. 既存の再利用: 減点の差の文は `describeOperationResult.ts` の `changesOf`・`sentenceOf`(「「…」の減点がN件増えました(-X)」)をそのまま使う。傾向(↑↓↕)は `describeOperationResult(...).tone` を使う。ポップオーバーは `RumorPopover` と同じ作り(`usePopoverDismiss`・`useFocusOnOpen`・`ToolbarPanel` で同時に1つだけ開く)。
3. 標準機能: `Map` をオブジェクトの参照で引く(スナップショットは不変で、参照が同じなら同じ手)。表示は `<ol>` と CSS だけ。新しい依存は足さない。

## 設計判断(確定)

- **操作名は「その操作のあとのスナップショット」の参照をキーにした `Map` で持つ。** `GameState` に `operationLabels: ReadonlyMap<Codebase, string>` を足し、`commit` が差し替えた `Codebase`(`autoNameClasses` を通したもの)をキーに操作名を記録する。
  - `past`/`future` と並行する配列は持たない。Undo/Redo はスナップショットの参照を動かすだけなので、`Map` を触らなくても操作名はずれない(取り消し/やり直しと自然に整合する)。
  - 新しい操作をして `future` が捨てられても、`Map` の古いキーは残る。表示には `History` に残っている参照しか使わないので害はない。ステージ切り替え・下書きからの再開で空にする。
  - `// ponytail: operationLabels は History と同じく上限なし。ステージ切り替えで空になる。履歴に上限を付けるときは同時に古いキーを捨てる` を残す。
- **`History`(domain)は変更しない。** 操作名は画面に出す文言なので presentation の関心で、`movesSince` などの既存の関数とテストにも触れずに済む。
- **操作名は操作の種類だけにする**(例:「メソッドの抽出」)。対象のメソッド名・クラス名は入れない(スコープ外)。点数と減点の増減で因果は追える。操作名の一覧は下の「操作名の一覧」で確定する。
- **置き場所はツールバーのポップオーバー**(「やり直し」ボタンのすぐ右、ボタン名「操作の記録 ▾」)。元に戻す・やり直しの隣なので、取り消しとの関係が分かる。サイドバーは課題の説明で縦に長く、キャンバス上部は `operation-result` が使っている。`ToolbarPanel` に `'history'` を足し、ヒント・うわさ・参考と同時には開かない。
- **並び順は古い順(1手目が上)。** 開いたとき、今の位置の手(`aria-current="step"`)が見えるようにスクロールする(`scrollIntoView({ block: 'nearest' })`)。
- **取り消した手(`future` 側)も出し、「(取り消し済み)」と文字で示す。** 色だけに頼らない。やり直しで通常の表示に戻る。新しい操作で `future` が捨てられたら、一覧からも消える。
- **「最初に戻す」も1手として出す。** `resetStage` は `commit` を通して履歴に積み、Undo で取り消せるため。操作名は「最初に戻す」。
- **点数は合計点(`Score.total`)の前後と差を出す。** 0点の下限に張り付いて合計が動かない手でも、減点の文(`(+10)` など)で変化が分かる(`score-floor-progress` と同じ考え方)。減点の文は `operation-result` と違って **2行に切り詰めず全部出す**(振り返りのための一覧なので)。
- **変更依頼の実装中はボタンを無効にする**(`RumorPopover` と同じ)。実装中は採点の対象が挑戦前のコードで、履歴も依頼ごとに空になるため。挑戦を終えると `baseHistory` が戻り、一覧も挑戦前のものに戻る(`operationLabels` はステージ切り替えまで消さないので、操作名も残る)。
- **計算はポップオーバーを開いている間だけ。** 道のりの各スナップショットを1回ずつ採点する。`// ponytail: 開くたびに道のりの長さ分 scoreCodebase を呼ぶ。数百手で重くなったらスナップショットごとの採点を WeakMap でキャッシュする` を残す。
- **下書きから再開したときは、再開後の手だけが出る**(再開直後は履歴が空。今と同じ)。

### 操作名の一覧

| ストアの操作 | 操作名 |
| --- | --- |
| `extractMethod` | メソッドの抽出 |
| `mergeMethods` | メソッドの統合 |
| `inlineMethod` | 呼び出し元へ戻す |
| `moveMethod` | メソッドの移動 |
| `moveMethodToNewClass`・`moveMethodToNewClassInFile` | メソッドを新しいクラスへ移動 |
| `moveField` | フィールドの移動 |
| `changeVisibility` | 可視性の変更 |
| `moveClass` | クラスの移動 |
| `moveClassToNewFile` | クラスを新しいファイルへ移動 |
| `renameClass` | クラス名の変更 |
| `renameMethod` | メソッド名の変更 |
| `setSuperclass` | 継承元の変更 |
| `addInterface` | 実装先の追加 |
| `removeInterface` | 実装先の削除 |
| `addClass` | クラスの追加 |
| `addFile` | ファイルの追加 |
| `deleteClass` | クラスの削除 |
| `deleteFile` | ファイルの削除 |
| `deleteMethod` | メソッドの削除 |
| `resetStage` | 最初に戻す |

`useGameStore.ts` の中で `commit`/`apply`/`applyResult` を呼ぶ箇所(実装時に `grep -n "commit(\|apply(\|applyResult(\|remove(" src/presentation/store/useGameStore.ts` で全件を確認する)すべてに、上の操作名を渡す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/stage/describeOperationResult.ts` | presentation | 減点の差をすべて文にする `describeRuleChanges` を export し、`describeOperationResult` もそれを使う(文と並び順の重複を作らない) |
| 変更 | `src/presentation/stage/describeOperationResult.test.ts` | presentation(test) | `describeRuleChanges` のテスト |
| 新規 | `src/presentation/stage/operationTimeline.ts` | presentation | `operationTimeline`(履歴と今のコードから、手ごとの記録の一覧を作る純粋関数) |
| 新規 | `src/presentation/stage/operationTimeline.test.ts` | presentation(test) | 上記のテスト(AAA) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `operationLabels` を足す。`commit`・`applyResult`・`Apply`・`remove` に操作名の引数を足し、全操作から渡す。ステージ切り替え・下書きからの再開で空にする |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation(test) | 操作名の記録・Undo/Redo で保たれること・クリアのテスト |
| 変更 | `src/presentation/stage/usePopoverDismiss.ts` | presentation | `ToolbarPanel` に `'history'` を足す |
| 新規 | `src/presentation/stage/OperationHistoryPopover.tsx` | presentation | ツールバーの「操作の記録 ▾」と一覧のパネル |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `ActionToolbar` の「やり直し」の右に `OperationHistoryPopover` を置く |
| 変更 | `src/index.css` | presentation | `.operation-history` の一覧・取り消し済み・今の位置の見た目 |
| 新規 | `e2e/operation-score-history.spec.ts` | E2E | 受け入れ基準のE2E |

`domain` / `application` / `infrastructure` は変更しない(`src/domain/codebase/history.ts` も変更しない)。新しい依存は足さない。保存形式(下書き・進捗)の変更はなし。

## データ・型の変更

```ts
// src/presentation/stage/describeOperationResult.ts(追加)
/** 前後の採点で件数が変わったルールを、増えたもの→消えたものの順に、すべて文にする。変化がなければ空配列。 */
export function describeRuleChanges(before: Score, after: Score): readonly string[];
// describeOperationResult は describeRuleChanges の結果を使って lines を作る(振る舞いは今と同じ)
```

```ts
// src/presentation/stage/operationTimeline.ts
import type { Codebase } from '../../domain/codebase/Codebase';
import type { History } from '../../domain/codebase/history';
import type { Score } from '../../domain/scoring/score';
import type { OperationTone } from './describeOperationResult';

export type OperationTimelineEntry = {
  /** 1始まりの手の番号(道のりの位置)。 */
  readonly step: number;
  /** 操作名。記録が無ければ「操作」。 */
  readonly label: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  /** 減点が何も変わらなかった手は null。 */
  readonly tone: OperationTone | null;
  /** describeRuleChanges の文(切り詰めない)。 */
  readonly changes: readonly string[];
  /** 取り消し済み(future 側)の手なら true。 */
  readonly undone: boolean;
};

/**
 * 道のり [...past, current, ...future] の隣り合う2つを1手として、古い順に並べる。
 * score は各スナップショットに1回だけ呼ぶ。
 */
export function operationTimeline(
  history: History,
  current: Codebase,
  score: (codebase: Codebase) => Score,
  labelOf: (codebase: Codebase) => string | undefined,
): readonly OperationTimelineEntry[];
```

ストア(`useGameStore.ts` の `GameState`):

```ts
/** 各操作のあとのスナップショット → 操作名。Undo/Redo では触らず、ステージ切り替えで空にする。 */
operationLabels: ReadonlyMap<Codebase, string>;
```

内部関数のシグネチャ(引数は4つまで):

```ts
function commit(state: GameState, codebase: Codebase, label: string, celebrate = true): Partial<GameState>;
function applyResult<E>(state: GameState, result: Result<Codebase, E>, describe: (error: E) => string, label: string): Partial<GameState>;
type Apply = <E>(result: Result<Codebase, E>, describe: (error: E) => string, label: string) => boolean;
```

- `commit` は、コードベースが変わるとき(`codebase !== state.codebase`)だけ `operationLabels: new Map(state.operationLabels).set(namedCodebase, label)` を返す。変わらないときは今と同じく `{}`。
- 失敗した操作・`travelTo`(Undo/Redo)・選択の変更では `operationLabels` を変えない。
- `history: emptyHistory()` にしてステージを切り替える箇所(ステージ選択・下書きからの再開・初期状態)では `operationLabels: new Map()` にする。変更依頼の各依頼の開始(`CHANGE_STEP_RESET`)と終了(`endChangeRequests`)では空にしない。

## 動きの仕様

### `operationTimeline(history, current, score, labelOf)`

- 道のり `path = [...history.past, current, ...history.future]`。`path` の各要素を `score` で1回ずつ採点する。
- `i = 1 … path.length - 1` について1件ずつ作る:
  - `step = i`、`label = labelOf(path[i]) ?? '操作'`
  - `scoreBefore = 採点(path[i-1]).total`、`scoreAfter = 採点(path[i]).total`
  - `changes = describeRuleChanges(採点(path[i-1]), 採点(path[i]))`
  - `tone = describeOperationResult(採点(path[i-1]), 採点(path[i]))?.tone ?? null`
  - `undone = i > history.past.length`(今の位置より後ろ)
- 履歴が空(`past`・`future` とも空)なら空配列。引数を変更しない。

### ツールバーのボタン(`OperationHistoryPopover.tsx`)

- 「やり直し」の右に `<button data-testid="operation-history-button" aria-haspopup="dialog" aria-expanded aria-controls>` を置く。文言は「操作の記録 ▾」。
- 変更依頼の実装中(`changeSession !== null`)は `disabled`。開いていたら閉じる(`StagePanelContent` の既存の「挑戦中・ステージ切替ではパネルを閉じる」で閉じる)。
- 開き方・閉じ方は `RumorPopover` と同じ(外側クリック・Esc で閉じ、Esc ではボタンにフォーカスを戻す。開いたらパネルにフォーカス)。

### パネル

- `role="dialog"`、`aria-label="操作の記録"`、`data-testid="operation-history"`、`className="popover__panel operation-history"`、`tabIndex={-1}`。
- 開いている間だけ `operationTimeline(history, codebase, (c) => scoreCodebase(c, stage), (c) => operationLabels.get(c))` を計算する(`useMemo`、依存は `history`・`codebase`・`stage`・`operationLabels`)。
- 一覧が空なら「まだ操作していません。抽出や移動をすると、ここに点数の変化が残ります」を出す。
- 一覧は `<ol>`。各項目(`<li data-testid="operation-history-entry">`):
  - 1行目: `${step}. ${label}` と `${scoreBefore}点 → ${scoreAfter}点(${差})`。差は `+10`・`-10`・`±0` の形。傾向の記号(`better` ↑・`worse` ↓・`mixed` ↕、`null` は記号なし)を `aria-hidden="true"` で前に付ける(`OperationResult.tsx` の `TONE_MARK` と同じ記号)。
  - 2行目以降: `changes` を1つずつ `<li data-testid="operation-history-change">` で出す。`changes` が空なら「減点は変わりませんでした」。
  - 取り消し済み(`undone`)の項目は、1行目の末尾に「(取り消し済み)」を付け、`className` に `operation-history__entry--undone`(薄い文字色)を付ける。
  - 今の位置(取り消されていない最後の手)の項目に `aria-current="step"` と `operation-history__entry--current`(左の線)を付ける。開いたとき、この項目が見えるようにスクロールする。
- パネルは `max-height` を付けてスクロールさせる(長い一覧でもツールバーの下に収める)。色のトークンは `src/index.css` に定義済みのもの(`--success`・`--danger`・`--warning`・`--text-muted` 相当の既存トークン)を使い、新しいトークンは足さない。
- パネルを開いたまま操作・Undo/Redo をしても、一覧はストアの変化に合わせて更新される(閉じない。外側クリックで閉じるのは今と同じ)。

## TDD対象

### `describeRuleChanges`(presentation、`describeOperationResult.test.ts`)

`Score` は `deductions` を手で組み立ててよい。

- `mixed-method` だけが0→1件(0→10点) → `['「責務の混ざったメソッド」の減点が1件増えました(-10)']`
- 3つのルールが変わった → 3件すべて返る(切り詰めない)。増えたものが先、増えたものの中は `points` の差の大きい順
- 変化なし → `[]`
- 既存の `describeOperationResult` のテストが変更なしで通る(2行への切り詰めはそのまま)

### `operationTimeline`(presentation、`operationTimeline.test.ts`)

`score` は Codebase ごとに `Score` を返すフェイク、`labelOf` は `Map#get` を使う。Codebase は参照の違う最小のオブジェクトを `S`・`A`・`B` のように作る。

- 正常系: past `[S]`・current `A`・future `[]`、`S`=90点・`A`=100点(行数1件消える)、ラベル `A`→「メソッドの抽出」 → 1件 `{ step: 1, label: 'メソッドの抽出', scoreBefore: 90, scoreAfter: 100, tone: 'better', changes: ['「行数」の減点が1件消えました(+10)'], undone: false }`
- 正常系: past `[S, A]`・current `B` → 2件、古い順(`step` 1, 2)
- Undo 後: past `[S]`・current `A`・future `[B]` → 2件で、2件目だけ `undone: true`
- 減点が変わらない手 → `tone: null`、`changes: []`、`scoreBefore === scoreAfter`
- 0点の下限: 前後とも `total` 0 で減点が1件増える → `scoreBefore: 0, scoreAfter: 0`、`tone: 'worse'`、`changes` に「増えました」の文
- ラベルが無いスナップショット → `label: '操作'`
- 境界: 履歴が空 → `[]`
- `score` は道のりのスナップショットごとに1回だけ呼ばれる(呼び出し回数 = `path.length`)
- 引数の `History` を変更しない

### ストア(`useGameStore.test.ts`)

- チュートリアル1で抽出すると、`operationLabels.get(codebase)` が「メソッドの抽出」
- 抽出 → クラス名の変更のあと、`operationTimeline` に渡すと「メソッドの抽出」「クラス名の変更」の順になる(ストアの値をそのまま渡して確かめる)
- `undo` / `redo` で `operationLabels` が変わらない(同じ参照)。undo 後の今のコードの操作名も保たれる
- `resetStage` で、今のコードの操作名が「最初に戻す」になる
- 失敗した操作のあと `operationLabels` が変わらない
- `selectStage` で `operationLabels` が空になる
- 変更依頼を始めて終えたあと、挑戦前の手の操作名が残っている

## 受け入れ基準

1. チュートリアル1を開き、ツールバーの「操作の記録 ▾」を押すと「まだ操作していません。…」が出る。
2. チュートリアル1で `printMonthlyReport` から「今月の売上を集計する」「前月比を計算する」(チェックボックスの1・2番目)を抽出して「操作の記録」を開くと、`1. メソッドの抽出` `90点 → 100点(+10)` と、「…の減点が…件消えました(+…)」の行が出る。8秒たって上部の操作の結果が消えたあとも、一覧には残っている。
3. 元に戻す(Ctrl+Z)をしてから開くと、1手目に「(取り消し済み)」が付き、`aria-current="step"` の項目が無い。やり直し(Ctrl+Y)をすると「(取り消し済み)」が消える。取り消し済みのまま別の抽出をすると、取り消し済みの項目は消え、新しい1手目に置き換わる。
4. 「最初に戻す」をすると、一覧の最後に「最初に戻す」の手が増え、点数が初期点に戻る差が出る。
5. 減点が変わらない操作(クラス名の変更など)は「減点は変わりませんでした」と `±0` で出る。
6. ステージを切り替えると一覧は空になる。
7. 変更依頼の実装中は「操作の記録」ボタンが無効。挑戦を終えて戻ると、挑戦前の一覧(操作名つき)がそのまま開ける。
8. キーボードだけで、Tab でボタンへ移動 → Enter で開く → Esc で閉じてボタンにフォーカスが戻る。ヒント・うわさのポップオーバーと同時には開かない。
9. E2E(`e2e/operation-score-history.spec.ts`): 1・2(8秒の確認は除く)・3・4・6・8 を確かめる。既存の `e2e/operation-result-feedback.spec.ts`・`e2e/toolbar-hint-rumor-popovers.spec.ts`・`e2e/refactor.spec.ts` が変更なしで通る。
10. `describeRuleChanges`・`operationTimeline`・ストアの変更に、AAAパターンのテストがある。
11. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 一覧の項目を押して、その手まで一気に戻る・進む(タイムトラベル)。今は元に戻す/やり直しで足りる。欲しいと分かったら `undoHistory`/`redoHistory` を繰り返す形で別仕様にする。
- 操作名に対象のメソッド名・クラス名・移動先を入れること。操作の種類と点数・減点の変化で因果は追える。
- 減点の原因のブロック名を一覧に出すこと(`deduction-targets-named`・`score-hover-preview` に任せる)。
- 点数の推移のグラフ・チャート。
- 一覧を下書きや進捗として保存し、再読み込み後も残すこと(取り消し履歴も保存していない)。
- 変更依頼の実装中の操作の記録(採点の対象が挑戦前のコードのため)。
- 白紙設計モード・設計くらべなど、リファクタリングのキャンバス以外の画面への表示。
- `operation-result`(上部中央の一時表示)の見た目・消え方の変更。
