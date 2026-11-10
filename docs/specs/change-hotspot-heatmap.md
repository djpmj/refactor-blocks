# change-hotspot-heatmap: 前回の変更依頼で何度も変更が必要だったクラス・メソッドを、色の濃さと回数で示す

> **既存の実装との重複(一部)**: メソッド単位の「変更×n」バッジ(`src/presentation/canvas/MethodChip.tsx` の
> `change-site-badge`、`docs/specs/implement-change-request.md` 受け入れ基準6)がすでにある。直前の挑戦の全依頼について
> `outcome.current.impact.sites` に含まれる回数を数え、挑戦中は隠している。本仕様はこれを**そのまま土台にし**、
> 不足している「クラス単位の集計」と「回数に応じた色の濃さ」だけを足す。新しい保持場所・新しい計測は作らない。
> 元のアイデアは `docs/feature-ideas/IDEAS.md` の「8. 変更ホットスポットのヒートマップ」。

## 背景・目的

変更依頼の挑戦を終えてリファクタリングに戻ると、メソッドには「変更×n」の文字バッジが出るが、

- クラス単位の集計がないため、「1つのクラスがいくつもの依頼(変更理由)で直されている」= **Divergent Change** の兆候が見えない。
- 「変更×1」のメソッドが複数クラスに散っている = **Shotgun Surgery** の兆候も、小さな文字バッジでは全体を見渡せない。
- ズームアウト(セマンティックズームで詳細を隠す倍率)ではバッジが読めず、どこに変更が集中したか一目でわからない。

そこで、前回の挑戦で変更が必要になった回数を、クラスノードの**背景の濃さ(3段階)**と**「変更×n」の文字**で示し、
キャンバス全体をヒートマップとして眺められるようにする。

本当に新しい計測が要るか: 要らない。「触った回数」は既存の `ChangeReport.outcomes[].current.impact.sites`(依頼ごとの
変更箇所のメソッドID)で足りる。プレイヤーの置き方(`placement.modifiedClassIds`)は挑戦中だけの積み重ねコードのIDを含み、
戻ったキャンバスと対応しないので使わない。

## 決めたこと(未決事項なし)

| 論点 | 決定 | 理由 |
| --- | --- | --- |
| 回数の保持場所 | **新しく保持しない**。ストアの既存 `lastChangeReport.outcomes` から表示時に数える | 既存の `change-site-badge` と同じ。データを重複して持たない |
| 数える範囲 | **直前の1回の挑戦の全依頼**(`lastChangeReport`)。挑戦をまたいで累積しない | 「もう一度挑戦」で直した効果(色が薄くなる)を見せたい。累積すると直しても濃いまま |
| 数える依頼 | `current !== null` の依頼('modify')だけ | 既存バッジと同じ。'extend' は既存クラスを直さないのが理想で、変更箇所の概念がない |
| 単位 | クラス = その依頼の変更箇所を**1つ以上含む依頼の数**(同じ依頼で2メソッド触っても1)。メソッド = 既存のまま | Divergent Change は「1クラスを何個の依頼が直したか」で表れる |
| 表示する時 | 変更依頼に挑戦していない(`changeSession === null`)ときだけ | 既存バッジと同じ。実装中に出すと答えが見える |
| 対象のクラス | 今のキャンバスのクラス。メソッドを後から移したら、移した先のクラスで数え直す | 「どこを直すか」の手がかりなので、今の形に追従するほうが自然 |
| 色 | 背景を `--warning` と `--surface` の `color-mix` で3段階(1回/2回/3回以上) | 既存の `color-mix(in srgb, var(--x) N%, var(--surface))` パターンを再利用。ダークモードも追従。`--danger` は循環依存の枠に使っているので避ける |
| アクセシビリティ | 色に加えて、クラス見出しに「変更×n」の文字を常に出し、見出しとメソッドのアクセシブルネームにも回数を入れる | 色だけに頼らない。見出し・メソッドは `aria-label` で中の文字が読まれないため |

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/change/changeHeat.ts` | domain | `classChangeCount`(クラスの変更回数を数える純粋関数) |
| 新規 | `src/domain/change/changeHeat.test.ts` | domain | 上のテスト |
| 変更 | `src/presentation/canvas/ClassNode.tsx` | presentation | 回数を読むフック、ノードの `data-change-heat`、見出しの「変更×n」バッジ、`classHeaderLabel` に回数 |
| 変更 | `src/presentation/canvas/MethodChip.tsx` | presentation | 既存の `change-site-badge` に `data-change-heat` を付ける。アクセシブルネームに回数を渡す |
| 変更 | `src/presentation/canvas/methodChipLabel.ts` / `.test.ts` | presentation | 入力に `changeCount` を足し、1以上なら「前回の変更依頼 n件で変更が必要」を付ける |
| 変更 | `src/presentation/change/ChangeMemo.tsx` | presentation | 説明文に「色が濃いクラスほど多くの依頼で変更が必要だった」を一言足す |
| 変更 | `src/index.css` | presentation | `.class-node[data-change-heat]` と `.method-chip__badge[data-change-heat]` の3段階の色 |
| 変更 | `e2e/refactor.spec.ts` | E2E | 下記の確認項目 |

application・infrastructure・ストア(`useGameStore.ts`)・ステージ定義は変更しない。新しい依存は足さない。

## データ・型の変更

型・保存形式の変更はなし。追加する関数は1つ。

```ts
// src/domain/change/changeHeat.ts
import type { CodeClass } from '../codebase/Codebase';

/** 依頼ごとの変更箇所(メソッドIDの並び)のうち、このクラスのメソッドを1つ以上含む依頼の数。 */
export function classChangeCount(codeClass: CodeClass, siteLists: readonly (readonly string[])[]): number;
```

色の段階は関数にせず、表示側で `Math.min(count, 3)` を `data-change-heat` に入れる(0 のときは属性を付けない)。

## 動きの仕様

1. 変更依頼の挑戦を終えて「リファクタリングに戻る」(`change-request-close`)と、`lastChangeReport` の依頼のうち
   `current !== null` のものの `current.impact.sites` を並べた `siteLists` を作る(ClassNode 内のフックで、`changeSession !== null` なら空)。
2. 各クラスノード(部品置き場を除く)について `classChangeCount` が1以上なら:
   - ルート要素に `data-change-heat="1" | "2" | "3"`(3回以上は3)。背景が段階に応じて濃くなる。
   - 見出しのバッジ群に `<span className="class-node__change-count" data-testid="class-change-count-<クラス名>" title="前回の変更依頼で、このクラスの変更が必要だった依頼の数">変更×n</span>` を出す。
     セマンティックズームで詳細を隠す倍率でも出す(循環依存の印と同じ扱い。ズームアウトで全体を眺めるための機能なので)。
   - 見出しの `aria-label` を `<既存の文言>(前回の変更依頼 n件で変更が必要)` にする。
3. 既存のメソッドの `change-site-badge` に `data-change-heat` を付け、同じ3段階の色にする。文言「変更×n」は変えない。
   メソッドボタンの `aria-label`(`methodChipLabel`)にも「前回の変更依頼 n件で変更が必要」を足す。
4. 回数が0のクラス・メソッドは、見た目も属性も今と同じ。
5. 新しい挑戦を始めると、既存バッジと同じく色もバッジも消える。終えると新しい挑戦の結果で塗り直す。
   ステージを切り替えると `lastChangeReport` が空になるので消える(既存の挙動)。
6. CSS(既存の変数・`color-mix` を使う。例):
   - 1: `background: color-mix(in srgb, var(--warning) 12%, var(--surface))`
   - 2: 同 28%
   - 3: 同 45%、加えて `border-color: var(--warning)`
   - バッジは同じ段階の背景に `color: var(--text)` を指定して、どの段階でも文字が読めるようにする。
   - ドロップ先の強調(`class-node--drop-target` など)・`class-node--flagged` は後に書かれたものが勝つよう、ヒートの規則はそれらより**前**に置く。

## TDD対象

### `classChangeCount`(domain、`src/domain/change/changeHeat.test.ts`)

- 依頼が0件(`siteLists = []`)→ 0
- 1件の依頼の変更箇所にこのクラスのメソッドが1つ → 1
- 1件の依頼でこのクラスのメソッドが2つ変更箇所 → 1(依頼の数を数える。メソッド数ではない)
- 3件の依頼のうち2件がこのクラスのメソッドを含む → 2
- どの依頼の変更箇所にもこのクラスのメソッドがない(別クラスのメソッドIDだけ)→ 0
- メソッドを持たないクラス → 0

### `methodChipLabel`(presentation、既存の `methodChipLabel.test.ts` に追加)

- `changeCount: 2` → 末尾に「前回の変更依頼 2件で変更が必要」を含む
- `changeCount` が 0 または省略 → 今と同じ文字列(既存テストがそのまま通る)

## 受け入れ基準

1. 上の TDD 対象のテストが AAA パターンで先に書かれ、通る。
2. E2E(`e2e/refactor.spec.ts`、既存の `openOrderStage` / `implementRequests` / `TAX_PARTS` を使う):
   1. チュートリアル2を**リファクタリングせず**に4件の依頼をすべて `OrderService` に置いて挑戦を終え、`change-request-close` を押すと、
      `class-OrderService` に `data-change-heat` 属性が付き(値は `1`〜`3`)、`class-change-count-OrderService` が `/変更×\d+/` の文字で見える。
   2. 同じ状態から「変更依頼に挑戦」をもう一度押すと、`class-change-count-` で始まる要素が0件になり、`class-OrderService` に `data-change-heat` 属性がない(実装中は隠す)。
   3. `reachFullScoreOnOrderStage` で税を `TaxCalculator` に移してから挑戦して戻ると、`TaxCalculator` に `class-change-count-TaxCalculator` が出る
      (変更が責務の集まったクラスへ寄ることを確かめる)。
   4. キャンバスをズームアウトして詳細を隠した倍率でも、`class-change-count-OrderService` が見えている。
   5. `class-header-OrderService` のアクセシブルネームに「前回の変更依頼」と回数が含まれる。
3. 回数0のクラスには `data-change-heat` 属性も `class-change-count-` 要素もない(既存の E2E が壊れない)。
4. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- **挑戦をまたいだ累積・履歴の保存**: 直前の1回だけ。直した効果が色で消えるほうが学びになる。複数回の推移を見たい要望が出たら `ChangeReport` を配列にする。
- **ファイルノード単位のヒート**: クラスで足りる。ファイル分けを教えるステージで要るとわかったら `FileNode` に同じ仕組みを足す。
- **挑戦中(実装中)の表示**: 答えが見えるので出さない(既存方針)。
- **'extend' の依頼や、プレイヤーの置き方(`placement`)で触ったクラスの集計**: 挑戦後のキャンバスとIDが対応しないため数えない。
- **Shotgun Surgery / Divergent Change を名指しする文言・採点ルールの追加**: 色と回数で気づかせるだけにする。採点は既存の `shotgun` 減点のまま。
- **凡例(色と回数の対応表)の新設**: 回数を文字で出しているので要らない。`ChangeMemo` の説明文の一言で足りる。
- **色の段階の設定化**: 3段階固定。
