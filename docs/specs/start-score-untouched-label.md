# start-score-untouched-label: 開いたときの点数のままなら、ヘッダーに「スタート時の点数」と添える

## 背景・目的

実機で、まっさらな状態でチュートリアル1(`tutorial-extract-method`)を開くと、何も操作していないのにヘッダーのリングに「90点」、隣に「減点 1項目(-10)」が出る。
初見の学習者は「もう90点取れている」「何か良いことをした」と読み違えかねない。

`untouched-stage-not-scored`(実装済み)が扱うのは**自己ベストの記録**(`updateProgress` が初期点以下を保存しない)だけで、
ヘッダーの表示(`StagePanel.tsx` の `ScoreBadge`)は開いた直後も操作後も同じ見た目のまま。この差分だけを直す:
点数が開いたときと同じ間は、リングの近くに「スタート時の点数」と添え、ここから100点を目指す基準点だと分かるようにする。

本当に「操作したかどうか」の判定が要るか: 要らない。`resetStage` は `autoNameClasses` を通して別の参照を作るので参照比較は当てにならず、
手数で判定すると「元に戻す」で戻したときに外れる。**点数が初期点と同じか**で判定すれば、「操作していない」「戻した」「操作したが点が変わっていない」のどれでも
「スタート時の点数」という文言は事実として正しい。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | `isStartingScore(score, initial)` を足す |
| 変更 | `src/presentation/stage/describeScore.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `StageHeader` → `ScoreArea` → `ScoreBadge` へ `initialScore` を渡し、同じ点数の間だけ注記を出す |
| 変更 | `src/index.css` | presentation | 注記(`score-badge__start`)の見た目。小さめ・控えめな色・`white-space: nowrap` |
| 新規 | `e2e/start-score-untouched-label.spec.ts` | E2E | 受け入れ基準を確かめる |

domain / application / infrastructure は変更しない。新しい依存は足さない。`initialScore` は `StagePanelContent` が既に `useMemo` で出しているものを流用する。

## データ・型の変更

```ts
// src/presentation/stage/describeScore.ts
/** 点数が、ステージを開いたとき(初期コード)と同じか。100点は対象外(初期点が100点でも注記は出さない)。 */
export function isStartingScore(score: Score, initial: Score): boolean;
```

- 判定: `score.total === initial.total && score.deducted === initial.deducted && score.total < 100`
  (`deducted` も比べるのは、0点のまま減点の合計だけ減った場合(`score-floor-progress`)を「スタート時」と言わないため)
- 保存形式の変更なし

## 動きの仕様

- `ScoreBadge` のリングの下(または `score-badge__detail` の隣)に、`isStartingScore` が true の間だけ
  `<span className="score-badge__start" data-testid="score-start-note">スタート時の点数</span>` を出す
  - `title` に「ステージを開いた時点の点数です。ここから100点を目指します」を付ける
  - `aria-hidden` は付けない(スクリーンリーダーでも読まれる)。`score-announcement`(aria-live)の文言は変えない(既存E2Eが `'90点'` などを完全一致で見ているため)
- 抽出・移動などで点数(または減点の合計)が変わったら注記は消える。「元に戻す」「最初に戻す」で初期点に戻ったら、また出る
- 下書きから再開して、点数が初期点と違えば出ない
- 変更依頼に挑戦中(`changeSession` あり)は、ヘッダーの点数が挑戦前のコード(`base`)で数えられるので、その点数で同じ判定をする(特別扱いしない)
- `data-testid="score"`(`describeScoreShort`)の文言・リングの点数・演出は変えない

## TDD対象

### `isStartingScore`(presentation、`describeScore.test.ts`)

- total 90・deducted 10 と initial 90・deducted 10 → true
- total 100・deducted 10 と initial 90・deducted 10 → false(点が上がった)
- total 80・deducted 20 と initial 90・deducted 10 → false(点が下がった)
- total 0・deducted 100 と initial 0・deducted 120 → false(0点のまま減点が減った)
- total 100・deducted 0 と initial 100・deducted 0 → false(100点は対象外)

## 受け入れ基準

1. `localStorage` を空にしてチュートリアル1を開くと、ヘッダーに「90点」とともに「スタート時の点数」が見える
2. 抽出を1回して点数が変わると「スタート時の点数」が消える
3. 「元に戻す」で初期の点数に戻すと、「スタート時の点数」がまた出る。「最初に戻す」でも同じ
4. 既存の `score-announcement` の文言(例: `90点`)は変わらない
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 「操作したかどうか」を手数や参照で判定する仕組み
- 初期点そのものの見直し(ステージ定義の調整)や、点数のリング・`describeScoreShort` の文言変更
- 自己ベストの記録の変更(`untouched-stage-not-scored` の領分)
- ガイドツアーの文言の変更
