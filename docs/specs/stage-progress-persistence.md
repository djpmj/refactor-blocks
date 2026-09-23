# ステージ進捗の保存(localStorage)

## 背景・目的

現状、ステージごとのスコアは `scoreCodebase` でその場で計算されるだけで、どこにも保存されない。
ページをリロードしたり、別のステージへ切り替えてから戻ったりすると、「このステージは前にクリアした」
という情報が消えてしまう。ブラウザの `localStorage` に「ステージごとの自己ベストスコア」を保存し、
リロードしても持ち越せるようにする。

## スコープ

- 保存するのは「ステージIDごとの自己ベストスコア(0〜100)」だけ。
- 編集中のコードベースそのもの(Undo/Redo履歴・現在の途中経過)は保存しない(スコープ外、YAGNI)。
- スコアが計算されるたび(コードベースが変わるたび)に、今までの自己ベストより高ければ更新する。

## 受け入れ条件

### ドメイン層: `src/domain/progress/`

- `Progress.ts`: 型 `Progress = Readonly<Partial<Record<string, number>>>`(ステージID → 自己ベストスコア。未記録のキーは`undefined`)
- `updateProgress.ts`: 純粋関数 `updateProgress(progress: Progress, stageId: string, score: number): Progress`
  - 今までの記録がない、または今回のスコアの方が高ければ、そのステージIDのスコアを更新した新しい `Progress` を返す
  - 今回のスコアが自己ベスト以下なら、**同じオブジェクト参照**を返す(Zustandの不要な再レンダーを避けるため)
  - TDD(AAAパターン)でテストを先に書く

### インフラ層: `src/infrastructure/progress/`

- `progressStorage.ts`:
  - `loadProgress(): Progress` — `localStorage.getItem('refactor-blocks:progress')` を読み、JSONとしてパースする
    - キーが存在しない、パースに失敗する、値の形が `Record<string, number>` でない(信頼境界なので検証する)場合は空の `Progress`(`{}`)を返す。例外は投げない
  - `saveProgress(progress: Progress): void` — `localStorage.setItem` で保存する。`localStorage` が使えない環境(プライベートブラウジング等)でも例外で画面を壊さないよう `try/catch` で握りつぶす
  - ユニットテスト対象外(I/Oを含む副作用コードのため、CLAUDE.mdの方針どおり)

### プレゼンテーション層: `src/presentation/store/useGameStore.ts`

- 状態に `progress: Progress` を追加。初期値は `loadProgress()` の結果
- アクション `recordProgress: (stageId: string, score: number) => void` を追加
  - `updateProgress` で計算し、参照が変わった(=更新があった)ときだけ `saveProgress` を呼んで状態を更新する
  - 参照が変わらなければ何もしない(不要な `set` を避ける)

### プレゼンテーション層: `src/presentation/stage/StagePanel.tsx`

- スコアを計算している `useMemo` の直後に `useEffect` で `recordProgress(stage.id, score.total)` を呼ぶ(`score.total` が変わるたびに実行)
- `StageSelect` の `<option>` で、`progress[stage.id] === 100` のステージには先頭に `✅ ` を付けて表示する

## テスト

- `updateProgress.test.ts`(TDD): 初回記録・自己ベスト更新・自己ベスト以下は据え置き・参照の同一性を確認
- E2E追加はしない(見た目のバッジ1つで、既存のD&D系E2Eとは独立した表示のみのため)。ただし手動確認(ブラウザプレビュー)で、スコア100点にしてリロードし、`✅` が付いたままなことを確認する
