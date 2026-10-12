# score-floor-progress: 0点のままでも、減点が減っていることを見せる

## 背景・目的

点数は `100 - 減点の合計` で、0点より下にはしない(`scoreCodebase` の `Math.max(0, FULL_SCORE - deducted)`)。
中級9(コピペされた消費税計算を1か所にまとめる)は、初期状態の減点の合計がちょうど100点(行数 -60・責務の混在 -30・空のクラス -10)で、0点から始まる。
組み替えを進めても、減点の合計が100を下回るまでは0点のまま動かない。
抽出で行数が一時的に増えると、減点がむしろ増えることもあり、点数で手応えが得られない。

点数は0点で止めたまま(採点の意味は変えない)、**減点の合計**をヘッダーに出す。減点の合計が減ったら、点数が上がったときと同じように知らせる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/scoring/score.ts` | domain | `Score` に減点の合計(0点で止める前)を足す |
| 変更 | `src/domain/scoring/score.test.ts` | domain | 上のテスト |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | 0点のとき、減点の合計を文に添える |
| 変更 | `src/presentation/stage/StagePanel.tsx`(`ScoreBadge`) | presentation | 0点のまま減点の合計が減ったら、点数が上がったときと同じ光り方をする |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | 「点数が上がった」の判定(`celebration`)に、0点のまま減点の合計が減った場合を足す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 上のテスト |
| 新規 | `e2e/score-floor-progress.spec.ts` | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

```ts
// src/domain/scoring/score.ts
export type Score = {
  // 既存のフィールドに加えて
  /** 減点の合計(deductions の points の合計)。total は max(0, 100 - deducted)。 */
  readonly deducted: number;
};
```

## 見た目・動きの仕様

### ヘッダーの点数の文(`describeScore`)

- `total > 0` のときは今のまま
- `total === 0` のときは、今の文の前に `減点の合計 -<deducted>` を添える
  (例: `0点(減点の合計 -100 / 行数 -60 / 責務の混在 -30 / 空のクラス・ファイル -10)`)
- 丸いゲージの点数は今のまま(`0点`)

### 減ったときの知らせ

- 点数が0点のまま、操作で減点の合計が減ったとき、点数が上がったときと同じ光り方(`score-glow`)をする。数字のカウントアップはしない
- 読み上げ(`score-announcement`)に `減点の合計が -<前> から -<後> に減りました` を出す
- 減点の合計が増えたときは何もしない(今と同じ)

## TDD対象の純粋関数

### `scoreCodebase`(`domain/scoring/score.ts`)

- 減点の合計が 130 → `total: 0`、`deducted: 130`
- 減点の合計が 30 → `total: 70`、`deducted: 30`
- 減点なし → `total: 100`、`deducted: 0`

### `describeScore`(`presentation/stage/describeScore.ts`)

- 0点・減点の合計 100 → `0点(減点の合計 -100 / 行数 -60 / …)`
- 70点 → 今と同じ文

### ストア(`useGameStore.test.ts`)

- 0点のまま減点の合計が 110 → 100 に減る操作 → `celebration` が出る
- 0点のまま減点の合計が増える操作 → `celebration` は出ない

## 受け入れ基準

1. 中級9を開くと、ヘッダーに `0点(減点の合計 -100 / …)` と出る
2. 減点の合計が減る操作をすると、0点のままでも点数のゲージが光り、ヘッダーの減点の合計が減る
3. 1点以上のステージでは、ヘッダーの文が今と同じ
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 点数をマイナスにすること・採点の計算の変更
- 中級9の初期状態や減点の配分の見直し
- 丸いゲージに減点の合計を出すこと
