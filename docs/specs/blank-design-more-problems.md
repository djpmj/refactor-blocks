# blank-design-more-problems: 白紙設計の問題を2問足し、問題を選べるようにする

## 背景・目的

実機で確認したところ、「白紙設計」モードには `白紙1: 注文と発送` の1問しかない
(`src/infrastructure/blankDesigns/blankDesignProblems.ts`)。`src/presentation/blank/BlankDesignView.tsx` は
`const [problem] = blankDesignProblems;` で先頭の1問に固定しており、コメントにも「2問目を足すときに問題の選択欄を作る」とある。
1問解き終わると、白紙から設計する練習の場がなくなってしまう。

既存ステージと題材が被らない白紙問題を2問足し、上部パネルで問題を切り替えられるようにする。
あわせて、問題データが書き方の決まりを満たすかを調べる検証関数を domain に置き、全問をテストで検証する。

題材を選んだ理由: 依頼の例に挙がった「ユーザー登録と通知」は `初級1: 何でも屋の UserController`、
「レポート出力と形式の切替」は `中級5: 変わるのは帳票の形式`・`上級4: レポート生成処理をFactoryへ集約する` と被る。
そのため、既存のステージ・白紙1のどちらにもない「会議室の予約」と「勤怠の打刻」を使う。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/blank/validateBlankDesignProblem.ts` | domain | 問題データの検証(純粋関数、`Result` で返す) |
| 新規 | `src/domain/blank/validateBlankDesignProblem.test.ts` | domain | 上の関数のテスト(壊した問題データを使う) |
| 変更 | `src/infrastructure/blankDesigns/blankDesignProblems.ts` | infrastructure | 白紙2・白紙3を追加する |
| 変更 | `src/infrastructure/blankDesigns/blankDesignProblems.test.ts` | infrastructure | 全問に検証をかける。`'order-flow'` 決め打ちのテストを全問で使える形にする。白紙2・3にも「機能ごとに分けた設計は模範解答より低い」テストを足す |
| 変更 | `src/presentation/blank/BlankDesignView.tsx` | presentation | 先頭の1問への固定をやめ、ストアの `stage.id` から今の問題を引く |
| 変更 | `src/presentation/blank/BlankDesignPanel.tsx` | presentation | 問題の選択欄(`<select>`)を足す |
| 変更 | `e2e/blank.spec.ts` | (E2E) | 問題を切り替えるテストを足す |

application 層は変更しない(問題の切り替えには、既存のストア操作 `selectStage` を使う)。新しい依存は足さない。

## データ・型の変更

型(`BlankDesignProblem`・`Stage`)は変更しない。追加するのは検証関数だけ。

```ts
// src/domain/blank/validateBlankDesignProblem.ts
export type BlankDesignProblemError =
  | 'tray-shape'                      // codebase がファイル1つ(id が TRAY_FILE_ID)・クラス1つ になっていない
  | 'no-parts'                        // 部品(部品置き場のメソッド)が0個
  | 'duplicate-part-id'               // 部品のメソッドID、または Fragment ID が重複している
  | 'unknown-use'                     // Fragment.uses に、部品にないメソッドIDが入っている
  | 'missing-responsibility-name'     // 'call' 以外の部品の責務について、classNames か responsibilityNames に項目がない
  | 'unknown-change-responsibility'   // changeRequests[].responsibility が部品の責務に存在しない
  | 'model-answer-unplaced';          // 模範解答を当てても部品置き場に部品が残る(findUnplacedParts が空でない)

/** 白紙設計の問題データが書き方の決まりを満たすかを調べる。満たせば ok、満たさなければ上の順で最初に見つかった誤り。 */
export function validateBlankDesignProblem(problem: BlankDesignProblem): Result<BlankDesignProblem, BlankDesignProblemError>;
```

- 既存の `validateCheck`(`src/domain/stage/conceptCheck.ts`)と同じ形にする(`err`/`ok`、最初の誤りを返す)。
- 部品の取り出しには `allClasses`(`src/domain/codebase/Codebase.ts`)、模範解答の確認には `applySolutionSteps`(`src/domain/stage/sampleAnswer.ts`)と `findUnplacedParts`(`src/domain/blank/tray.ts`)を再利用する。
- 判定の分岐が12を超えそうなら、判定ごとに小さな関数へ分けて上から順に呼ぶ(循環的複雑度の lint 対策)。

### 追加する問題データ(`blankDesignProblems` の2・3番目)

各フィールドの書き方は白紙1に合わせる。全部品に `code: { csharp }` を付け、コードの行数を `lines` と合わせる
(`src/infrastructure/stages/stageCode.test.ts` が全ステージと白紙問題を検査している)。
`limits: { method: 41, class: 86, file: 200 }`・`dependencyLimit: 3`・`responsibilityLimit: 1`・`learns`・`checks` 2問
(`validateCheck` を満たす)・`why`・`goal`・`problem`・`explanation` も白紙1と同じ粒度で書く。
メソッドIDは `method-blank-…`、Fragment IDは `frag-blank-…` の形にし、白紙1とも重ならないようにする。

**白紙2: 会議室の予約** — `id: 'blank-room-reservation'`, `level: 'beginner'`

| 部品(メソッド) | 責務 | 行数 | uses |
| --- | --- | --- | --- |
| `reserveRoom` | `reservation-flow` | 3 | `checkRoomAvailability`, `saveReservation`, `addToCalendar` |
| `cancelReservation` | `reservation-flow` | 2 | `deleteReservation`, `removeFromCalendar` |
| `checkRoomAvailability` | `availability`(空き確認) | 4 | — |
| `saveReservation` | `persistence`(DBへの保存) | 3 | — |
| `deleteReservation` | `persistence` | 3 | — |
| `addToCalendar` | `calendar`(カレンダー連携) | 3 | — |
| `removeFromCalendar` | `calendar` | 3 | — |

- 模範解答: `ReservationService`(流れ)・`RoomAvailability`(空き確認)・`ReservationRepository`(保存)・`CalendarSync`(カレンダー連携)の4クラス。
  `classNames` はこの4つに対応させる。
- 要求文(description)で「予約の前後に準備時間を空けるルールが近く入る」「社内カレンダーを別サービスへ乗り換える話がある」とほのめかす。
- 変更依頼: `req-blank-room-buffer`(前後10分の準備時間を空けて / `availability`)、`req-blank-calendar-switch`(カレンダーを別サービスに切り替えて / `calendar`)。

**白紙3: 勤怠の打刻** — `id: 'blank-attendance'`, `level: 'beginner'`

| 部品(メソッド) | 責務 | 行数 | uses |
| --- | --- | --- | --- |
| `clockIn` | `attendance-flow` | 2 | `saveClockIn` |
| `clockOut` | `attendance-flow` | 3 | `saveClockOut`, `calculateOvertime`, `alertOvertime` |
| `saveClockIn` | `persistence`(DBへの保存) | 3 | — |
| `saveClockOut` | `persistence` | 3 | — |
| `calculateOvertime` | `overtime`(残業の計算) | 4 | — |
| `alertOvertime` | `alert`(上長への通知) | 3 | — |
| `summarizeMonthlyOvertime` | `overtime` | 4 | — |

- 模範解答: `AttendanceService`(流れ)・`AttendanceRepository`(保存)・`OvertimeCalculator`(残業の計算)・`ManagerNotifier`(上長への通知)の4クラス。
- 要求文で「深夜の割増の計算が入る予定」「通知先をメールからチャットへ変える話がある」とほのめかす。
- 変更依頼: `req-blank-night-overtime`(深夜残業を分けて計算して / `overtime`)、`req-blank-alert-channel`(上長への通知をチャットにして / `alert`)。

クラス名は自動命名(`classNames`)で付く。プレイヤーに名前を付けさせることも、名前を採点することもしない。

## 動きの仕様

- 上部パネル(`BlankDesignPanel`)の見出しの上に、ラベル「問題」付きの `<select data-testid="blank-problem-select">` を置く。
  選択肢は `blankDesignProblems` の順に、各問題の `title` を並べる。値は問題の `id`。
- 選択欄を変えると、ストアの `selectStage(id)` を呼ぶ。部品置き場がその問題の初期状態に戻り、履歴(元に戻す)も空になる。
  白紙設計のストアは `saveDraftsOn = false` なので、下書きは残らない。
- 今の問題で部品を1つ以上配置している(`findUnplacedParts` の数 < 部品の総数)ときは、切り替える前に `window.confirm` で
  「今の配置は消えます。別の問題に切り替えますか?」と確かめる。キャンセルしたら選択欄の値を元に戻し、何もしない。
  未配置のままなら確かめずに切り替える。
- 答え合わせの結果パネルを開いたまま切り替えたら、結果パネルを閉じる(`reviewing` を `false` にする)。
- `BlankDesignView` は `useGameStore((state) => state.stage.id)` で `blankDesignProblems` から今の問題を探す。
  見つからないとき(起こらない想定)は先頭の問題を使う。モジュール直下の `const [problem] = …` と、そのコメントは消す。
- リファクタリングモードとの行き来では、今の問題と配置が残る(ストアは既存のまま1つ)。
- 選択欄はネイティブの `<select>` なので、キーボード(Tab・矢印キー)で操作できる。

## TDD対象

### `validateBlankDesignProblem`(domain)

白紙1をもとに、1か所だけ壊した問題データを作ってテストする(テストファイル内の小さな fixture で十分。白紙1を import してスプレッドで上書きしてもよい)。

- 白紙1・2・3 → `ok`(この3件は `blankDesignProblems.test.ts` の `describe.each` で検査する)
- 部品置き場のファイルが2つある / ファイルIDが `TRAY_FILE_ID` でない → `'tray-shape'`
- 部品置き場のクラスに部品が0個 → `'no-parts'`
- 2つの部品のメソッドIDが同じ → `'duplicate-part-id'`。Fragment IDが同じ → `'duplicate-part-id'`
- 流れの部品の `uses` に、存在しない `method-blank-nothing` が入っている → `'unknown-use'`
- `classNames` から `tax` を消す → `'missing-responsibility-name'`。`responsibilityNames` から `tax` を消す → 同じ
- 変更依頼の `responsibility` を `'unknown'` にする → `'unknown-change-responsibility'`
- 模範解答から `move` の手順を1つ消す → `'model-answer-unplaced'`
- 2つの誤りを同時に入れる(`no-parts` かつ変更依頼の責務が不正)→ 先の `'no-parts'` を返す

### `blankDesignProblems.test.ts`(infrastructure、既存テストの更新)

- `describe.each` に「`validateBlankDesignProblem` が ok を返す」を足す。
- 「プレイヤー操作で作ったクラスには…」のテストは `'order-flow'` を決め打ちしているので、
  `problem.changeRequests[0].responsibility` の部品を使う形に直す(全問で流れ以外の責務になる)。
- 白紙2・3それぞれに、機能ごと(白紙2: 予約/取消、白紙3: 出勤/退勤)に部品をまとめた設計の点数が、
  模範解答より `score.total` で低く、`changeScore` が模範解答以下になるテストを足す(白紙1の既存テストと同じ形)。
- 既存の「模範解答は100点」「模範解答が全部品を配置している」は、追加した問題にもそのまま `describe.each` でかかる。

## 受け入れ基準

1. `npm run dev` で「白紙設計」を開くと、選択欄に `白紙1: 注文と発送`・`白紙2: 会議室の予約`・`白紙3: 勤怠の打刻` の3つが並び、最初は白紙1が選ばれている。
2. 未配置のまま白紙2を選ぶと、確認なしで要求文が会議室の予約の内容に変わり、部品置き場に7つの部品(`reserveRoom` など)が並んで「あと7個」と出る。
3. 白紙2で部品を1つ配置してから白紙3を選ぶと確認ダイアログが出る。キャンセルすると白紙2の配置と選択欄の値はそのまま。OKすると白紙3の部品7つが「あと7個」で並び、「元に戻す」は押せない。
4. 白紙2・白紙3とも、部品を新しいクラスへドラッグすると `classNames` どおりの名前(例: `checkRoomAvailability` → `RoomAvailability`)が自動で付く。全部品を配置して答え合わせをすると、プレイヤーと模範解答の点数・2件の変更依頼の結果・模範解答の図が出る。模範解答は100点。
5. 答え合わせの結果を開いたまま問題を切り替えると、結果パネルが閉じてメソッドエディタに戻る。
6. 白紙2に切り替えてからリファクタリングモードへ移って戻ると、白紙2の選択と配置が残っている。
7. 選択欄はキーボードだけで切り替えられる。
8. `e2e/blank.spec.ts` に「問題を切り替えると部品が入れ替わる」「配置済みで切り替えると確認が出て、キャンセルで配置が残る」テストがある。既存の白紙1のテストはそのまま通る。
9. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 問題ごとの配置を覚えておく(切り替えても配置を残す)こと。今回は確認ダイアログで消失を防ぐだけにする。要望が出たら、白紙設計のストアの下書き(`holder.drafts`)をメモリ上で使う形で足す。
- 白紙設計の進捗・クリア記録・ロードマップへの表示。白紙問題はステージ一覧・進捗に入れない方針(`blankDesignProblems.ts` のコメント)のままにする。
- 問題の難易度別の並べ替え・絞り込みUI。3問なら `<select>` 1つで足りる。
- 実行時(読み込み時)の検証。問題データはアプリに同梱する TS の定数で、外部から入ってこない。そのため検証は `npm run check` のテストで全問にかけるだけにする。外部ファイルから問題を読み込むようになったら、読み込み口で `validateBlankDesignProblem` を呼ぶ。
- 4問目以降の追加、既存の白紙1の内容の変更。
- クラス名をプレイヤーに付けさせる・採点する仕組み。
