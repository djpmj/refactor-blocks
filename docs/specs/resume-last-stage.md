# resume-last-stage: 再読み込みしても、最後に遊んでいたステージから続ける

## 背景・目的

実機で遊ぶと、ページを再読み込みするたびに必ず「チュートリアル1」へ戻る。
編集中のコード(下書き `refactor-blocks:drafts`)とステージごとの自己ベスト(`refactor-blocks:progress`)はステージごとに残っているのに、
**どのステージを開いていたか**は覚えていない(`createGameStore` が常に `stages` の先頭から始める)。
たとえば初級2の途中で閉じて開き直すと、チュートリアル1の100点の画面が出て、ステージ一覧から探し直すことになる。

最後に開いたステージのIDを `localStorage` に保存し、次に開いたときはそのステージから始める。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/infrastructure/progress/lastStageStorage.ts` | infrastructure | 最後に開いたステージIDの読み書き(`refactor-blocks:last-stage`) |
| 新規 | `src/infrastructure/progress/lastStageStorage.test.ts` | infrastructure | 上のテスト(壊れた値・存在しない値・保存できない環境) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `createGameStore` の最初のステージを、保存されたIDのステージにする。`selectStage` で保存する |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 初期ステージが保存IDで決まること |
| 新規 | `e2e/resume-last-stage.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` / `application` は変更しない。新しい依存は足さない。

## データ・型の変更

- `localStorage` のキー `refactor-blocks:last-stage` に、ステージID(文字列)をそのまま保存する
- 読み込みは信頼境界の入力検証をする: 文字列でない・空文字・`stages` に存在しないIDは「保存なし」として扱う(例外は投げない)

```ts
// src/infrastructure/progress/lastStageStorage.ts
export function loadLastStageId(): string | undefined;
export function saveLastStageId(stageId: string): void;
```

## 動きの仕様

- `createGameStore(allStages, saveDraftsOn = true, ...)` は、`saveDraftsOn` が true のときだけ保存IDを読む(テストで使う false のときは今までどおり先頭のステージ)
- 保存IDのステージが `allStages` にあれば、それを最初のステージにする。無ければ先頭のステージ
- そのステージの下書き(`restoreFirstDraft`)も、先頭ではなく**最初のステージ**で復元する(「前回の続きから再開しました」のお知らせも同じ条件で出る)
- `selectStage` でステージを切り替えたとき、`saveLastStageId` で保存する
- 初回(保存なし)はチュートリアル1から始まり、操作ガイド(ツアー)も今までどおり出る。保存IDがあるときのツアーは、`loadTourSeen()` が true なら出さない今の動きのまま

## TDD対象

### `lastStageStorage`(infrastructure)

- 保存したIDを読み込める
- 何も保存されていないとき `undefined`
- `localStorage` が例外を投げる環境でも、`load` は `undefined`、`save` は何も起きない(例外を外へ出さない)

### `createGameStore`(presentation のストアのテスト)

- 保存IDが2番目のステージのとき、`stage` は2番目のステージになる
- 保存IDが `stages` に無いとき、先頭のステージになる
- `saveDraftsOn = false` のときは、保存IDがあっても先頭のステージになる

## 受け入れ基準

1. 初級2を開いて再読み込みすると、初級2が開く(チュートリアル1に戻らない)
2. 初級2の途中まで操作して再読み込みすると、その途中のコードで「前回の続きから再開しました」が出る
3. `localStorage` に存在しないステージIDが入っていても、画面が壊れずチュートリアル1が開く
4. 初回の訪問(保存なし)はチュートリアル1が開き、ツアーが出る
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 設計くらべ・白紙設計のタブ(モード)を覚えること(ステージ以外は対象にしない。必要になったら別の仕様にする)
- 左右のサイドバーの開閉・幅、ズーム位置を覚えること
