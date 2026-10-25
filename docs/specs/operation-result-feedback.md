# operation-result-feedback: 操作の直後に、増えた減点・消えた減点を1〜2行の文で見せる

## 背景・目的

学習者の目線でチュートリアル1(`tutorial-extract-method`)を実機で遊んで、次の不足を見つけた。

- `printMonthlyReport` から、表の組み立て(`表のヘッダーを組み立てる`・`表の行を組み立てる`)と出力(`画面に出力する`)を1つのメソッドとして抽出すると、点数が90→80点に下がる。クリア条件には「責務の混ざったメソッド: 0件にする / 今: 1件」が出る。しかし、操作の直後に「なぜ下がったか」の説明はない
- 逆に、集計の処理だけを抽出すると90→100点になる。でも、どこが良くなったかは演出(`success-feedback` のカウントアップと緑の光)でしか分からない
- 学習者には数字が動いたことしか分からない。自分の操作の良し悪しを言葉で理解できない

そこで、プレイヤーが操作(抽出・移動・統合・インライン化・削除など)した直後に、**その操作で増えた減点・消えた減点**を、日本語の1〜2行(例:「「責務の混ざったメソッド」の減点が1件増えました(-10)」)で一定時間出す。判定には既存の採点(`scoreCodebase` の `deductions`)の前後差分を使い、新しい採点ロジックは作らない。

## ponytailチェック

1. YAGNI: 操作ごとの言い回し(「表の組み立てと出力を1つにまとめたので」のように、何をしたかを言葉にするもの)は作らない。「どのルールの減点が何件増えた・消えたか」で、点数が動いた理由は伝わる。もっと深い「なぜ悪いか」は、既存の減点の内訳(`RULE_WHY`。`rule-why-explanations`)に任せる。
2. 既存の再利用: 差分は `scoreCodebase` の `Score.deductions`(ルールごとの `count`/`points`)の前後比較で出す。ルール名は `RULE_LABEL`(`src/presentation/stage/describeScore.ts`)を使う。「プレイヤーの操作」の見分け方は、`celebration` と同じく `commit`(`useGameStore.ts`)で、`celebrate` が true かつ変更依頼の実装中でないとき。表示時間は `NOTICE_VISIBLE_MS`(8秒)と、`clearStaleToasts` のタイマーの仕組みを使う。
3. 標準機能: 表示は React Flow の `Panel`(既存の `top-center` の Panel)と CSS だけで作る。新しい依存は足さない。

## 設計判断(確定)

- **文を作る関数は presentation の純粋関数にする**(`src/presentation/stage/describeOperationResult.ts`)。文言は画面の都合で、`RULE_LABEL` も presentation にある。採点結果の差分から文を作る既存の `describeScoreGap`(`describeDesignDiff.ts`)と同じ置き場所・作り方にそろえる。domain には何も足さない(差分の材料は `Score` だけで足りる)。
- **差分はルールごとの `count` と `points` で取る**。`violationTargets` のブロック単位の差分は使わない。循環依存のように、件数とブロックの数がずれるルールがあり、点数の変化と文が合わなくなるため。ブロック名を文に入れることはしない(スコープ外)。
- **既存の通知トースト(`ErrorToast`)には混ぜず、別の要素で出す**。理由は2つある。
  - 抽出の初回には `notice`(「抽出すると、新しいメソッドの宣言と呼び出しの分だけ…」)が同じ操作で出る。移動の `publicizedMoveNotice`、削除の `describeInlinedBeforeDelete` も同じ。1つのトーストに入れると、どちらかが隠れる
  - 既存のE2Eが `.error-toast[role="status"]` の有無を数えている(`e2e/refactor.spec.ts`、`e2e/visibility-violation-edge.spec.ts`)
  そこで、キャンバス上部中央の既存の `Panel position="top-center"`(`OpeningFixBanner` が入っている)に並べて出す。点数・ツールバーに近く、下端のトーストとも重ならない。
- **消え方は `notice` と同じにする**。表示から8秒(`NOTICE_VISIBLE_MS`)で消え、新しい結果に置き換わったら数え直す。×でもすぐ閉じられる。失敗の理由(`message`)とちがい、選択の変更では消さない。点数の理由の説明なので、メソッドをクリックして中を確かめている間も読めるようにする。
- **成功した操作のたびに置き換える**。減点が何も変わらない操作の後は `null` にする(前の操作の結果が残り、今の操作の結果に見えるのを防ぐ)。この点は `celebration`(変化がなければ前の記録を残す)と違う。
- **Undo/Redo・「最初に戻す」・ステージ切り替え・下書きからの再開・変更依頼の開始では `null` にする**。`success-feedback` と同じく、取り消しで「増えた・消えた」が出ると、どの操作の結果か分からなくなるため。
- **カッコ内の数字は、そのルールの減点の増減(`points` の差)にする**。増えたら `(-10)`、消えたら `(+10)` と書き、点数への影響として読めるようにする。0点の下限に張り付いていて点数そのものが動かないときも、減点の内訳の表示(`-10`)と同じ数字を出す(`score-floor-progress` と同じ考え方)。
- **1〜2行に収める**。変わったルールが2つまでなら1ルール1行で出す。3つ以上なら、1行目に最も重要な1件を出し、2行目を「ほかにN項目の減点も変わりました(「減点の内訳」で確認できます)」にする。並び順は、増えたもの(悪くなったもの)を先にする。学習者が気づくべきなのは、まず自分の操作で増えた問題だから。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/stage/describeOperationResult.ts` | presentation | `describeOperationResult`(前後の `Score` から、操作の結果の行と傾向を作る純粋関数) |
| 新規 | `src/presentation/stage/describeOperationResult.test.ts` | presentation(test) | 上記のテスト(AAA) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `operationResult` の状態と `dismissOperationResult` を足す。`commit` で記録し、`travelTo`・`resetStage`・ステージ切り替え・変更依頼の開始で `null` に戻す。`clearStaleToasts` に8秒で消すタイマーを足す。`celebrationFor` と前後の `scoreCodebase` の計算を共有する |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation(test) | 記録・置き換え・クリアの条件のテスト |
| 新規 | `src/presentation/canvas/OperationResult.tsx` | presentation | 操作の結果を表示するコンポーネント(×で閉じる) |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 既存の `<Panel position="top-center">` に `OperationResult` を `OpeningFixBanner` と並べて置く |
| 変更 | `src/index.css` | presentation | `.operation-result` の見た目(傾向ごとの左の線の色) |
| 新規 | `e2e/operation-result-feedback.spec.ts` | E2E | 受け入れ基準のE2E |

`domain` / `application` / `infrastructure` は変更しない。新しい依存は足さない。`ErrorToast.tsx` は変更しない。

## データ・型の変更

```ts
// src/presentation/stage/describeOperationResult.ts
import type { Score } from '../../domain/scoring/score';

/** 減点の合計が減った・増えた・同じ(増えたルールと消えたルールが打ち消し合った)。 */
export type OperationTone = 'better' | 'worse' | 'mixed';

export type OperationResult = {
  readonly tone: OperationTone;
  /** 1〜2行。 */
  readonly lines: readonly string[];
};

/** 操作の前後の採点から、増えた減点・消えた減点を文にする。どのルールも件数が変わらなければ null。 */
export function describeOperationResult(before: Score, after: Score): OperationResult | null;
```

ストアに足す状態(`useGameStore.ts` の `GameState`):

```ts
/** 直前のプレイヤーの操作で増えた・消えた減点。8秒(NOTICE_VISIBLE_MS)で消える。 */
operationResult: OperationResult | null;
dismissOperationResult: () => void;
```

保存形式(下書き・進捗)の変更はなし。

## 動きの仕様

### `describeOperationResult(before, after)`

- ルールごとに `after` と `before` の `count` の差(`diff`)と `points` の差を取る。ルールの対応は `rule` で取る(`describeScoreGap` と同じく、見つからなければ0として扱う)。
- `diff > 0` のルール: `「${RULE_LABEL[rule]}」の減点が${diff}件増えました(-${pointsの差})`
- `diff < 0` のルール: `「${RULE_LABEL[rule]}」の減点が${-diff}件消えました(+${pointsの差の絶対値})`
- 並び順: 増えたルールを先に、消えたルールを後にする。それぞれの中では `points` の差の大きい順にし、同じなら `after.deductions` の並び順(`scoreCodebase` のルールの順)にする。
- 変わったルールが1つか2つなら、その文をそのまま `lines` にする。3つ以上なら、`lines` は `[先頭の文, `ほかに${残りの数}項目の減点も変わりました(「減点の内訳」で確認できます)`]` にする。
- `tone`: `after.deducted < before.deducted` なら `'better'`、`>` なら `'worse'`、同じなら `'mixed'`。
- どのルールも `count` が変わらなければ `null`。
- 引数を変更しない。

### 記録(`commit`)

- `commit` がコードベースを差し替えるとき、`celebrate` が true で、変更依頼の実装中(`changeSession !== null`)でなければ、前後の `scoreCodebase(…, state.stage)` から `describeOperationResult` を呼び、その結果(`null` も含む)を `operationResult` に入れる。
- 前後の `scoreCodebase` の計算は `celebrationFor` と共有し、1回の操作で同じ採点を2回しない(`celebrationFor` に計算済みの `Score` を渡す形に変える)。
- `celebrate` が false(「最初に戻す」)・変更依頼の実装中は `operationResult: null` にする。
- `travelTo`(Undo/Redo)・ステージ切り替え(下書きからの再開を含む)・変更依頼の開始(`startChangeRequests`)では `operationResult: null` にする。
- 失敗した操作(`message` が出るとき)・選択の変更(`selectMethod`/`selectField`)・`dismissMessage` では `operationResult` を変えない。

### 自動で消す(`clearStaleToasts`)

- `operationResult` が前の状態と違う(参照が変わった)とき、前のタイマーを止める。`null` でなければ `NOTICE_VISIBLE_MS` 後に `operationResult: null` にする。`notice` のタイマーとは別に持つ。

### 表示(`OperationResult.tsx`)

- `operationResult` が `null` のときは何も出さない。
- `role="status"`(`aria-live="polite"` 相当)、`data-testid="operation-result"`、`className="operation-result operation-result--${tone}"` の箱に、`lines` を1行ずつ出す(各行は `data-testid="operation-result-line"`)。
- 箱の先頭に、傾向を示す飾りの記号(`better`: ↑、`worse`: ↓、`mixed`: ↕。`aria-hidden="true"`)を出す。色だけに頼らず、文で意味が分かるようにする。
- 左の線の色は `better` → `--success`、`worse` → `--danger`、`mixed` → `--warning`(どれも `src/index.css` に定義済みのトークン。新しいトークンは足さない)。
- 右端に×ボタン(`aria-label="操作の結果を閉じる"`)。押すと `dismissOperationResult` で消える。キーボード(Tab→Enter/Space)で閉じられる。
- dnd-kit・React Flow の操作を奪わないよう、箱には `nodrag nopan` を付ける。幅は `max-width: min(560px, calc(100vw - 32px))` 程度にし、長い行は折り返す。
- アニメーションは付けない(`success-feedback` の演出と重ねない)。

## TDD対象

### `describeOperationResult`(presentation、`src/presentation/stage/describeOperationResult.ts`)

テストの `Score` は、`scoreCodebase` を通さず `deductions` を手で組み立ててよい(純粋関数の入力として十分なため)。

- 正常系: `mixed-method` だけが0→1件(0→10点) → `{ tone: 'worse', lines: ['「責務の混ざったメソッド」の減点が1件増えました(-10)'] }`
- 正常系: `line-limit` だけが1→0件 → `{ tone: 'better', lines: ['「行数」の減点が1件消えました(+10)'] }`
- 正常系: `line-limit` が1件消え、`mixed-method` が1件増えた(合計は同じ) → `tone: 'mixed'`、`lines` は増えた文が1行目、消えた文が2行目
- 正常系: 1つのルールで2件増えた → `…2件増えました(-20)`
- 並び順: 増えたルールが2つ(`coupling` が+20、`cycle` が+10) → `points` の差の大きい `結合度` が先
- 並び順: 増えたルールの差が同じ → `after.deductions` の順
- 境界: 変わったルールが3つ → `lines` は2行で、2行目が `ほかに2項目の減点も変わりました(「減点の内訳」で確認できます)`
- 境界: どのルールの件数も変わらない(前後が同じ `Score`) → `null`
- 境界: 0点の下限で `total` が前後とも0でも、減点の件数が増えていれば文が出る(`tone: 'worse'`)
- 引数の `Score` を変更しない

### ストア(`useGameStore.test.ts`)

- チュートリアル1で、表の組み立てと出力の処理を1つのメソッドとして抽出すると、`operationResult.lines` に `「責務の混ざったメソッド」の減点が1件増えました(-10)` が入る
- チュートリアル1で、集計の処理だけを抽出すると、`operationResult.tone` が `'better'` で、「増えました」を含む行がない
- 減点が変わらない操作(例: クラス名の変更)の後は、前の `operationResult` が `null` になる
- `undo` / `redo` の後は `null`
- `resetStage`・`selectStage` の後は `null`
- 失敗した操作(`message` が出る)の後は、前の `operationResult` が残る
- `selectMethod` の後も、`operationResult` が残る
- `dismissOperationResult` で `null` になる
- `NOTICE_VISIBLE_MS` 後に `null` になり、途中で新しい結果に置き換わると数え直す(`vi.useFakeTimers`)

## 受け入れ基準

1. チュートリアル1で、`printMonthlyReport` から「表のヘッダーを組み立てる」「表の行を組み立てる」「画面に出力する」を1つのメソッドとして抽出すると、キャンバス上部中央に「「責務の混ざったメソッド」の減点が1件増えました(-10)」を含む結果が出る。左の線が赤系で、↓の記号が付く。
2. チュートリアル1で、「今月の売上を集計する」「前月比を計算する」だけを抽出すると、「…の減点が…件消えました(+…)」の行が出る。「増えました」の行は出ず、左の線は緑系で↑が付く。点数の演出(`success-feedback`)もこれまでどおり出る。
3. 結果は8秒で消える。×を押すとすぐ消え、キーボードだけでも閉じられる。
4. 結果が出たあと、Undo(Ctrl+Z)・「最初に戻す」・ステージ切り替えをすると結果は消える。Undo では「消えました」「増えました」の新しい結果は出ない。
5. 減点が変わらない操作(例: クラス名の変更)をすると、前の結果は消え、新しい結果も出ない。
6. 抽出の初回のお知らせ(`notice`)や、移動で public にしたお知らせが出る操作でも、そのお知らせ(画面下のトースト)と操作の結果(上部中央)の両方が読める。
7. スクリーンリーダーでは、結果の文が `role="status"` で読み上げられる。
8. E2E(`e2e/operation-result-feedback.spec.ts`): 1・2・3(×で消える)・4(Undoで消える)・6を確かめる。8秒で消えることは E2E では確かめない(ストアのフェイクタイマーのテストで守る)。既存の `e2e/refactor.spec.ts`・`e2e/visibility-violation-edge.spec.ts`・`e2e/toast-clears-when-stale.spec.ts`・`e2e/success-feedback.spec.ts` が変更なしで通る。
9. `describeOperationResult` とストアの変更に、AAAパターンのテストがある。
10. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 操作の内容を言葉にした原因の説明(「表の組み立てと出力を1つにまとめたので」のような、どの処理を・どう動かしたかを含む文)。操作の種類とフラグメントの責務ごとに文を作る必要があり、1つのIssueに収まらない。ルール名と件数で足りないと分かったら別仕様にする。
- 文に原因のブロック名(メソッド名・クラス名)を入れること。場所は、減点の内訳の名前つき表示(`deduction-targets-named`)とホバーの光(`score-hover-preview`)で分かる。
- 「なぜそのルールが悪いのか」の説明を結果の中に出すこと。減点の内訳の説明(`rule-why-explanations`)に任せる。
- 結果からの減点の内訳・該当ブロックへのジャンプ(`score-jump-to-violations` で扱う)。
- 点数が上がったときの演出、解決したブロックの光(`success-feedback` で扱う)。0点のまま減点が減ったときの読み上げ(`score-floor-progress` で扱う)。
- 失敗の理由・お知らせのトーストの見た目や消え方の変更(`canvas-error-toast`、`toast-clears-when-stale` で扱う)。
- 変更依頼の実装中の操作の結果表示(採点の対象が挑戦前のコードのため。変更依頼の結果は既存の結果画面で出る)。
- 過去の操作の結果の履歴一覧、表示時間の設定、アニメーション。
