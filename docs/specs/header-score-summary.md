# header-score-summary: ヘッダーの点数の説明を短くし、減点の一覧の重複をなくす

## 背景・目的

2026-10-17 に上級1などを遊んで、画面右上の点数の表示が詰まって読みにくかった。今のヘッダーには、同じ情報が3回出ている。

1. 点数のリング(`score-badge__value`): `50点`
2. その横の説明(`score-badge__detail`、`describeScore`): `50点(行数 -20 / 責務の混在 -20 / 空のクラス・ファイル -10)`
3. 「減点の内訳(3)」(`ScoreBreakdown` の `details`): 開くとルールごとの減点と理由

2が長く、ルール名の長いもの(`他クラスのデータを触りすぎ(Feature Envy) -10` など)が入ると、狭いヘッダーで2行・3行に折り返して小さな文字の塊になる。
点数はリングと重複し、減点の一覧は「減点の内訳」と重複している。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | ヘッダー用の短い文を作る `describeScoreShort` を足す(`describeScore` は他の場所のために残す) |
| 変更 | `src/presentation/stage/describeScore.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/stage/StagePanel.tsx`(`ScoreBadge`) | presentation | `score-badge__detail` を `describeScoreShort` にする |
| 変更 | `src/index.css` | presentation | `score-badge__detail` を1行(`white-space: nowrap`)にする |
| 変更 | `data-testid="score"` の文で減点のルール名を確かめている既存の E2E | E2E | 「減点の内訳」を開いて確かめる形に直す |

`domain` は変更しない。

## データ・型の変更

なし。

## 表示の仕様

`describeScoreShort(score)`:

- 減点なし → `✅ 減点なし`
- 減点あり → `減点 <ルールの数>項目(-<減点の合計>)` 例: `減点 3項目(-50)`
- 0点(合計が100を超えて切り捨て)のときも同じ形(`減点 5項目(-140)`)

- 点数そのものはリングだけに出す
- 減点のルールごとの内訳は「減点の内訳」にだけ出す(今のまま)
- 読み上げ(`score-announcement`)は今のまま

## TDD対象の純粋関数

### `describeScoreShort`(`presentation/stage/describeScore.ts`)

- 減点なし → `✅ 減点なし`
- 行数 -20・責務の混在 -20・空のクラス -10 → `減点 3項目(-50)`
- 減点が0点のルール(`points: 0`)は数えない

## 受け入れ基準

1. 上級1を開くと、ヘッダーの点数の横が `減点 3項目(-50)` の1行になり、ルール名が並ばない
2. 「減点の内訳(3)」を開くと、今どおりルールごとの減点が出る
3. 100点のとき `✅ 減点なし` が出る
4. 幅 1280px でヘッダーの点数の欄が1行に収まっている
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 「減点の内訳」の中身の変更
- 点数のリングのアニメーション
