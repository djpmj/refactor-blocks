# concept-mastery-map: ステージ一覧に「学べることごと」の習得マップを出す

## 背景・目的

学習者として実機で20ステージ以上を遊んだあと、ステージ一覧(`stage-roadmap` で実装済みの `StageRoadmapDialog`)を開くと、
各カードに「Extract Method」「Move Method」「Feature Envy」「Strategy」「ISP」などの学べること(`Stage.learns`)のタグと、
ステージごとの `✅ クリア` / `N点` / `未挑戦` が出る。ただし**技法・概念ごとにどこまで身についたか**を見る場所がない。

- 「Move Method はいくつ解いた?」を知るには、24枚のカードのタグを目で数えるしかない(Move Method のタグはチュートリアル2・初級1・中級の2ステージの4枚に散らばっている)
- 「Strategy・Factory・ISP にはまだ手を付けていない」といった**弱点・空白**が見えない
- その結果、学習の全体像が見えず、次に何を練習すれば穴が埋まるかが分からない

ステージ一覧のダイアログに「学べることごと」の表示を足し、1概念につき「関連ステージ N 件中 M 件クリア」・進み具合のバー・
未クリアのステージへのリンクを出す。学習者が自分の弱点を見つけ、そのままそのステージへ飛べるようにする。

本当に別画面・別の保存データが要るか → 要らない。概念は既存の `Stage.learns`、クリアは既存の `Progress`(自己ベスト100点)から計算で出せる。
集計を1つの純粋関数にし、ダイアログに表示の切り替えを足すだけで足りる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/progress/roadmap.ts` | domain | `isStageCleared` と `conceptMastery` を追加。`stageStatus`・`recommendNextStage` の「100点ならクリア」の判定を `isStageCleared` に寄せる |
| 変更 | `src/domain/progress/roadmap.test.ts` | domain | 上のテスト(先に書く) |
| 新規 | `src/presentation/stage/ConceptMasteryList.tsx` | presentation | 概念ごとの行(名前・件数・バー・未クリアのステージへのボタン)を並べる表示専用コンポーネント |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | 「ステージ順」/「学べることごと」の表示切り替えボタンを足し、`ConceptMasteryList` を出す。カードを選ぶ処理を `choose(stageId)` にまとめて両方で使う |
| 変更 | `src/index.css` | presentation | `.concept-mastery` のスタイル |
| 変更 | `e2e/roadmap.spec.ts` | E2E | 学べることごとの表示・リンクで移動のテストを足す |

`application`・`infrastructure` 層、`Stage` 型、ステージ定義(`learns` の中身)、`useGameStore`、保存形式は変更しない。新しい依存は足さない。

## データ・型の変更

保存形式の変更はなし。`src/domain/progress/roadmap.ts` に次を足す。

```ts
/** そのステージをクリアしたか(自己ベストが100点)。クリアの定義を変えるときはここだけ直す。 */
export function isStageCleared(stageId: string, progress: Progress): boolean;

/** 1つの学べること(概念)の習得状況。 */
export type ConceptMastery = {
  /** `Stage.learns` の文字列そのまま(ステージ一覧のタグ表記と同じ)。 */
  readonly concept: string;
  /** この概念を learns に持つステージの数。 */
  readonly total: number;
  /** そのうちクリアした数。 */
  readonly cleared: number;
  /** クリアしていないステージ。`stages` の並び順。 */
  readonly remaining: readonly Stage[];
};

/**
 * ステージの learns から、概念ごとの習得状況を作る。
 * 並びは、その概念が `stages` の並び順で最初に出てくる順(=難易度順に初めて学ぶ順)。
 */
export function conceptMastery(
  stages: readonly Stage[],
  isCleared: (stageId: string) => boolean,
): readonly ConceptMastery[];
```

- `stageStatus` の `best >= 100` と `recommendNextStage` の `(progress[stage.id] ?? 0) < 100` を `isStageCleared` に置き換える(振る舞いは変えない。既存テストがそのまま通ること)

## 設計判断(確定)

1. **概念の単位・表示名は `Stage.learns` の文字列そのもの**。正規化(大文字小文字・別名の統合)や表示名の対応表は作らない。
   ステージ一覧のタグ表記と完全に一致し、ステージ定義に新しいタグを足せば自動で概念が増える。表記ゆれが実際に見つかったらステージ定義側を直す。
2. **並び順は「`stages` の並び順で最初に出てくる順」**。ステージは難易度順(チュートリアル→初級→中級→上級)に並んでいるので、
   習得マップも「習う順」になり、ステージ一覧と同じ頭の地図で読める。弱い順・五十音順への並べ替えはしない(下のスコープ外)。
3. **クリアの判定は引数の述語 `isCleared(stageId)` で受ける**。今は呼び出し側が `(id) => isStageCleared(id, progress)` を渡す(=100点で1件クリア)。
   `clear-means-learned`(理解度チェック・変更依頼まで済んだ段階の記録)が入ったら、`conceptMastery` は変えずに、渡す述語(または `isStageCleared` の中身)を差し替えるだけで済む。
   段階(「100点」「理解度チェック済み」など)を数え分ける型は今は作らない(YAGNI)。
4. **置き場所はステージ一覧ダイアログの中の表示切り替え**。別のダイアログやヘッダーボタンは足さない。
   ダイアログ上部(「次のおすすめ」の下)に `ステージ順` / `学べることごと` の2つのボタンを置き、`aria-pressed` で選択中を示す
   (`App.tsx` のモード切り替え `mode-switch` と同じ作り。`role="tab"` のキーボード矢印操作は作らない。Tab・Enter/Space で切り替えられれば足りる)。
   開くたびに `ステージ順` から始まる(ダイアログは閉じるとアンマウントされるので、切り替えの状態は `useState` で持ち、保存しない)。
5. **未クリアのステージへのリンクはステージ名のボタン**で、押したときの動きはステージカードと同じ(今いるステージ以外なら `selectStage`、どちらでもダイアログを閉じる)。
   今いるステージは作業を消さないよう閉じるだけ。変更依頼中はダイアログ自体が開けないので、追加の無効化は不要。
6. **進み具合のバーはネイティブの `<progress max={total} value={cleared}>`**。支援技術に値が伝わり、追加のARIAが要らない。
   色だけに頼らず、必ず `N件中M件クリア` の文字を併記する。
7. 1ステージにしか出てこない概念(`Strategy`・`ISP` など)も1行として出す(「1件中0件クリア」で空白が見えることが目的)。

## 動きの仕様

### 切り替え

- ステージ一覧ダイアログの「次のおすすめ」の下に、表示切り替えボタン2つを並べる
  - `ステージ順`(`data-testid="roadmap-view-stages"`)— 今までのレベルごとのカード
  - `学べることごと`(`data-testid="roadmap-view-concepts"`)— 習得マップ
- 選択中のボタンは `aria-pressed="true"`。開いた直後は `ステージ順`
- 「次のおすすめ」の行は両方の表示で出す

### 学べることごとの表示(`ConceptMasteryList`、`data-testid="concept-mastery"`)

`conceptMastery(stages, (id) => isStageCleared(id, progress))` の結果を上から並べる。1行(`data-testid="concept-mastery-row"`、`data-concept="<概念名>"`)につき:

- 概念名(ステージカードのタグと同じ文字)
- `N件中M件クリア`(`N` = `total`、`M` = `cleared`)
- `<progress max={N} value={M}>`(`aria-label` は `<概念名>の進み具合`)
- `remaining` が空なら `✅ すべてクリア` の文字を出し、リンクは出さない
- `remaining` があれば、各ステージの `title` を書いたボタンを並べる(`data-testid="concept-stage-<stage.id>"`。同じステージが複数の概念の行に出るので、テストでは行の中で探す)。
  押すと、そのステージへ移ってダイアログが閉じる(今いるステージなら閉じるだけ)
- 狭い画面では1列に折り返し、ダイアログ内でスクロールする(既存の `.stage-roadmap__body` のスクロールに乗る)

## TDD対象

### `isStageCleared`(domain)

- 自己ベスト100 → `true`
- 自己ベスト99 → `false`
- 記録なし → `false`

### `conceptMastery`(domain)

テスト用に `learns` と `id` だけを変えたステージを作る(既存の `roadmap.test.ts` のステージ生成のやり方に合わせる)。

1. `stages` が空 → 空配列
2. A(learns: `['Extract Method']`)、B(learns: `['Extract Method', 'Move Method']`)、どれもクリアなし →
   `[{ concept: 'Extract Method', total: 2, cleared: 0, remaining: [A, B] }, { concept: 'Move Method', total: 1, cleared: 0, remaining: [B] }]`
3. 2. で B だけクリア → Extract Method は `total 2・cleared 1・remaining [A]`、Move Method は `total 1・cleared 1・remaining []`
4. 並び順: A(learns `['継承']`)、B(learns `['Strategy', '継承']`)→ `継承`, `Strategy` の順(最初に出てきた順。B の learns 内の順ではない)
5. `remaining` は `stages` の並び順を保つ(C, A の順に渡したら C, A)
6. 全ステージクリア → 全概念で `cleared === total` かつ `remaining` が空
7. `isCleared` に渡された述語だけで判定する(`Progress` を見ない): `(id) => id === 'b'` を渡すと B だけがクリア扱い

### 既存テスト

`stageStatus`・`recommendNextStage` の既存テストが、`isStageCleared` への置き換え後もそのまま通る。

## 受け入れ基準

1. 「ステージ一覧」を開くと「ステージ順」と「学べることごと」の切り替えがあり、開いた直後は今までどおりレベルごとのカードが出る
2. 「学べることごと」を押すと、概念ごとの行が、ステージ一覧で最初にその概念が出てくる順(先頭は `Extract Method`、次に `Move Method`)に並ぶ。各行に `N件中M件クリア` とバーが出る
3. `tutorial-extract-method` と `tutorial-order-service` を100点にした状態(`localStorage` の `refactor-blocks:progress`)で開くと、
   `Extract Method` の行が `2件中2件クリア` と `✅ すべてクリア` になり、リンクが出ない。`Move Method` の行は `M=1` で、未クリアの `初級1: 何でも屋の UserController` などのボタンが出る
4. `Move Method` の行の `初級1: 何でも屋の UserController` を押すと、そのステージへ移ってダイアログが閉じる(見出しが変わる)
5. 1つも記録が無い状態では、全行が `N件中0件クリア` になる
6. 切り替えボタンと各リンクを、キーボード(Tab・Enter/Space)だけで操作できる。Esc で閉じられる
7. 既存の `e2e/roadmap.spec.ts` のテストが変わらず通る
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 理解度チェック・変更依頼まで済んだ段階で「習得」とみなす記録 — 別仕様 `clear-means-learned` の領分。この仕様は「100点で1件クリア」だけで完結させ、差し替え口(`isStageCleared` / `isCleared` 述語)だけ用意する
- 途中の点数(例: 60点)を部分的な習得として数えること・概念ごとの平均点
- 弱い順・未着手順への並べ替え、概念での絞り込み・検索、用語集へのリンク(`stage-roadmap` のスコープ外のまま)
- 概念の表示名の対応表・別名の統合・カテゴリ分け(「操作」と「設計の考え方」の区別など)
- ステージカードのタグを押して習得マップへ飛ぶこと
- 白紙設計モード・設計くらべクイズの結果を習得マップに含めること
- 切り替えの状態の保存(開くたびに「ステージ順」から)
- ステージ一覧のカード・「次のおすすめ」・状態表示の変更(`stage-roadmap`・`next-stage-after-clear`・`untouched-stage-not-scored` の領分)
