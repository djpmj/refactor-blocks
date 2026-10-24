# untouched-stage-not-scored: 開いただけのステージを「30点」と記録しない

## 背景・目的

実機で遊ぶと、ステージを開いて眺めただけ(メソッドを1回クリックしただけ)で、ステージ一覧にそのステージの横に「30点」と出る。
原因は `StagePanel` が、ステージを開いた直後の点数を `recordProgress` へそのまま渡し、`updateProgress` が自己ベストとして保存するため
(`refactor-blocks:progress` に `"beginner-user-controller":30` が入る)。

- 一覧では「未挑戦」と「挑戦中」の区別が付かない(開いただけなのに「30点」と出る)
- 「操作の下書きがあれば挑戦中」という `stageStatus` の `in-progress` の分岐に、点数がある限り到達しない
- 自己ベストが「開いたときの点数」で埋まり、本当の自己ベストとの区別が付かない

`src/domain/progress/roadmap.ts` に、この件を予告する `ponytail` コメントがある(「開いただけのステージも点数が付いて見える。気になるとプレイで分かったら、初期点と同じなら「未挑戦」にする」)。実機で確かめたので、これを直す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/progress/updateProgress.ts` | domain | 開いたときの点数(初期点)以下は記録しない。ただし100点は常に記録する |
| 変更 | `src/domain/progress/updateProgress.test.ts` | domain | 上のテスト |
| 変更 | `src/domain/progress/roadmap.ts` | domain | `ponytail` コメントを削除する |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `recordProgress` が、そのステージの初期点を `updateProgress` へ渡す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 開いただけでは記録されないこと |
| 新規 | `e2e/untouched-stage-not-scored.spec.ts` | E2E | 受け入れ基準を確かめる |

## データ・型の変更

```ts
// src/domain/progress/updateProgress.ts
/**
 * ステージの自己ベストスコアを更新する。
 * 初期点(ステージを開いた直後の点数)以下は、まだ何も良くなっていないので記録しない。ただし100点は常に記録する。
 * 今回のスコアが自己ベスト以下なら同じ参照を返す。
 */
export function updateProgress(progress: Progress, stageId: string, score: number, initialScore: number): Progress;
```

- 保存済みの自己ベスト(`localStorage`)の形は変えない。**すでに保存されている「初期点と同じ点数」は消さない**(古い記録の掃除はしない。ponytail: 次に自己ベストが上がれば自然に置き換わる)

## 動きの仕様

- ステージを開いただけ・メソッドを選んだだけ(コードが変わらない)では、`progress` に何も書かない。一覧は「未挑戦」のまま
- 抽出・移動などで点数が初期点を超えたら記録する。このとき一覧は「N点」になる
- 点数が上がらなくても、コードを変えた下書きがあれば、一覧は「挑戦中」(`in-progress`)になる(`stageStatus` の今の分岐。変更不要)
- 初期点がすでに100点のステージ(あれば)は、開いた時点で100点を記録する
- `recommendNextStage`(次のおすすめ)は、自己ベストが100未満(または記録なし)の先頭のステージを返す今の動きのまま

## TDD対象

### `updateProgress`(domain)

- 記録なし・score 60・initial 30 → 60 を記録した新しい `Progress`
- 記録なし・score 30・initial 30 → 同じ参照(記録しない)
- 記録なし・score 20・initial 30 → 同じ参照
- 自己ベスト60・score 50・initial 30 → 同じ参照
- 記録なし・score 100・initial 100 → 100 を記録する
- 既存の「自己ベスト以下なら同じ参照」のケースは `initialScore` を足して残す

## 受け入れ基準

1. 未挑戦のステージを開いてメソッドを1回クリックしただけでは、ステージ一覧の表示が「未挑戦」のまま(`refactor-blocks:progress` にそのステージのキーが増えない)
2. 抽出を1回して点数が上がると、一覧にその点数が出る。再読み込みしても残る
3. 抽出してから元に戻して、初期点に戻っても、自己ベストは下がらない
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 保存済みの「初期点と同じ点数」の記録を、読み込み時に取り除くこと
- 一覧の見た目(「挑戦中」の表示など)の変更
