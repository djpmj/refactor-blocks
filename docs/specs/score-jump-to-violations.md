# 採点の減点項目から、該当するブロックへジャンプする

## 背景・目的

採点バッジの詳細は `67点(行数 -10 / 責務の混在 -20 / 結合度 -10)` のように**項目名と点数しか出ない**。
プレイヤーは「責務の混在 -20」を見ても、キャンバスのどのクラスのことか分からず、ブロックを1つずつ見比べて探すことになる。
ヒントを開くまで手がかりが無く、詰まりやすい。

減点項目をクリックすると、その項目に**引っかかっているブロックをキャンバス上で強調し、画面に収める**ようにする。
どこを直せばよいかが一目で分かる。採点ロジック・点数・既存の `describeScore` の文言は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/scoring/violationTargets.ts` + `.test.ts` | domain | 新規 | `violationTargets(codebase, stage)`: 採点項目ごとに、減点の原因になっているファイル・クラス・メソッドのIDを返す純粋関数(TDD、下記) |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `focusedRule: ScoreRule \| null` と `focusRule(rule \| null)` を追加。ステージ切り替え・リセット・変更依頼の開始/終了で `null` に戻す |
| `src/presentation/stage/ScoreBreakdown.tsx` | presentation | 新規 | 減点項目の一覧(項目名・件数・ボタン)。クリックで `focusRule`(下記) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | ヘッダーの `ScoreBadge` の隣に `ScoreBreakdown` を置く。`describeScore` / `data-testid="score"` の表示は変えない |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `focusedRule` の対象ノードを `fitView({ nodes, padding, duration })` で画面に収める |
| `src/presentation/canvas/ClassNode.tsx` / `FileNode.tsx` / `MethodChip.tsx` | presentation | 変更 | 対象のとき強調クラス(`--flagged`)を付ける |
| `src/index.css` | presentation | 変更 | `.score-breakdown` と、`--flagged` の強調スタイル(下記) |
| `e2e/score-jump.spec.ts` | E2E | 新規 | 減点項目をクリックすると該当ブロックが強調される(下記) |

## 見た目・内容の仕様

### 減点の内訳(`ScoreBreakdown`)

- ヘッダーのスコアバッジの隣に、`<details>` で「減点の内訳」を置く(閉じた状態が初期。サマリは `減点の内訳(3)` のように、点数が引かれている項目の数)
- 開くと、`points > 0` の項目を `RULE_LABEL[rule]` と件数(`×2`)でボタンとして並べる。減点が無ければ、`<details>` ごと出さない
- ボタンは `aria-pressed` のトグル。押すと `focusRule(rule)`、もう一度押す(または別の項目を押す)と解除・切り替え
- 変更依頼の調査中(`changeSession !== null`)は、キャンバスが採点対象と別の状態なので、ボタンを `disabled` にする
- キーボードで操作できる(`<button>` を使う)

### キャンバスの強調

- `focusedRule` の対象(`violationTargets` の結果。ファイル・クラス・メソッドの各ID)に当たるノード/チップに `--flagged` を付ける: 黄色系(`--warning`。無ければ追加)の太い枠線+薄い背景。循環依存の赤(`--danger`)・ドロップ先の強調とは別色にする
- 強調は**操作のたびに現在のコードベースから再計算**する(直したブロックは強調から外れる)。ある項目の対象が0件になったら、`focusedRule` は自動で `null` に戻す
- 強調した対象が収まるよう `fitView` する。対象が1件でも極端に拡大しない(`maxZoom` を指定する)。強調中にユーザーが手動でパン・ズームするのは自由
- メソッドが対象のとき: そのメソッドのチップを強調し、`fitView` は所属クラスのノードを対象にする。フィールドが対象のとき: 所属クラスを強調する

## データ・型の変更

`src/domain/scoring/violationTargets.ts`:

```ts
export type ViolationTarget = {
  readonly fileIds: readonly string[];
  readonly classIds: readonly string[];
  readonly methodIds: readonly string[];
};

export function violationTargets(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced'>,
): Record<ScoreRule, ViolationTarget>;
```

`score.ts` の `scoreCodebase` とは別関数にして、点数の計算(`counts`)は触らない。ただし `violationTargets` の各ルールの**件数と
`scoreCodebase` の `count` が一致しない**ことがあってはならない(下記のテストで確かめる)。既存の `find…` 関数をそのまま再利用し、
違反を探すロジックを複製しない。

## TDD対象の純粋関数

### `violationTargets`

ルールごとに、既存の `find…` の結果を次のIDに写す。

| ルール | 対象 |
| --- | --- |
| `line-limit` | `kind` に応じて `methodIds`/`classIds`/`fileIds` へ(`targetId`) |
| `coupling` | `classIds`(`findCouplingViolations`) |
| `cycle` | 循環している依存の `from` の `classIds`(重複は除く) |
| `responsibility` / `cohesion` | `classId` → `classIds` |
| `visibility` | `methodId` → `methodIds`(呼ばれる側のメソッド) |
| `empty` | `findEmptyContainers` のIDを、`fileIds` か `classIds` かに振り分ける(IDがファイルかクラスかを調べる) |
| `unused` / `stub` / `trivial-method` | `methodIds` |
| `lone-superclass` / `thin-class` / `contract` | `classIds` |
| `feature-envy` | `methodId` → `methodIds` |
| `encapsulation` | 違反のフィールド(`fieldId`)とセッター(`findOpenSetters`)の所属クラスを `classIds` に |

1. 違反が無いコードベースでは、すべてのルールが空の対象(3つの配列がすべて空)を返す
2. 行数超過のメソッド・クラス・ファイルが、それぞれ `methodIds`/`classIds`/`fileIds` に振り分けられる
3. `empty` で、空のクラスは `classIds`、クラスの無いファイルは `fileIds` に入る
4. `encapsulation` で、フィールドの違反はそのフィールドの所属クラスに写る(フィールドIDそのものは返さない)
5. ステージの題材(`src/infrastructure/stages/`)の全ステージの開始状態で、各ルールについて「対象の数(3つの配列の合計。同じものが複数のルールで重複しても可)が 0 なら `scoreCodebase` の `count` も 0、`count > 0` なら対象が1件以上」となる(取りこぼし・過剰の整合確認)
6. 同じIDが1つのルールの中で重複しない

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(既存の `data-testid="score"` の文言やドラッグ操作が変わらない)
- 減点があるステージ(例: 初級の行数超過)で「減点の内訳」を開き、項目を押すと、該当するクラス/メソッド/ファイルが強調され、画面に収まる
- 項目をもう一度押すと強調が消える。別の項目を押すと強調が切り替わる
- 強調中にリファクタリングして違反が直ると、そのブロックの強調が外れる。全部直ると強調が消え、ボタンも非表示になる
- 減点が無いステージでは「減点の内訳」が出ない
- 変更依頼の調査中は、減点の内訳のボタンが押せない
- ステージを切り替える・リセットすると強調が消える
- 強調のあいだも、メソッドのドラッグ移動・抽出・可視性変更が従来どおり動く
- 強調が色だけに頼らない(枠線の太さの変化もあり、ボタンの `aria-pressed` でも状態が分かる)

## スコープ外

- 減点の理由の説明文(「なぜ減点か」)の追加。まず場所を示すことだけを行う
- キャンバス上のクラス・メソッドから採点の指摘を逆引きすること(ホバーで減点を表示するなど)
- 強調の永続化(リロードで消えてよい)
- 白紙設計モード・設計くらべクイズの採点表示への適用
- 採点ルールの追加・点数の変更
