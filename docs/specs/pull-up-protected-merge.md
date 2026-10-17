# pull-up-protected-merge: 基底クラスへ移したメソッドは protected にし、もう片方との統合候補を消さない

## 背景・目的

2026-10-17 に上級1「通知クラスの共通処理を基底クラスへ集める」を、次の自然な順番(Pull Up Method)で解こうとして詰まった。

1. `EmailNotifier` と `SmsNotifier` の継承元を `NotifierBase` にする
2. 両方から「送信ログを記録する」を抽出する → `logEmailNotification()`・`logSmsNotification()`(どちらも private)。
   この時点では、エディタに「似た処理を持つメソッドと統合: SmsNotifier.logSmsNotification() と統合する」が出る
3. `logEmailNotification()` を `NotifierBase` へドラッグする → **自動で public になる**(`auto-public-on-move`)
4. `NotifierBase.logEmailNotification()` を開くと、**統合の候補が消えている**。`SmsNotifier.logSmsNotification()` 側から開いても出ない

原因は2つある。

- 統合(`findMergeCandidates`)は「形が一致する private 同士」または「同じ可視性」が条件(`mergeableVisibility`)。移した側が public になったので候補から外れる
- 自動の public 化(`publicizeCrossClassCalls` → `findVisibilityViolations`)は、private を**子孫クラスから**呼ぶ場合でも public にする。
  子孫からだけ呼ばれるなら protected で足り、継承を教えるステージではそれが正しい形

結果として「統合してから移す」順番でないと解けず、しかもその理由が画面に出ない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/publicizeCrossClassCalls.ts` | domain | 呼び出し元がすべて子孫クラスなら protected、それ以外は public にする |
| 変更 | `src/domain/codebase/publicizeCrossClassCalls.test.ts` | domain | 上のテスト |
| 変更 | `src/domain/codebase/mergeMethods.ts` | domain | 統合の可視性の条件を「private / protected 同士なら統合できる(結果は広い方)」に広げる |
| 変更 | `src/domain/codebase/mergeMethods.test.ts` | domain | 上のテスト |
| 変更 | 自動で可視性を変えたときのトースト(「…public にしました」) | presentation | protected にしたときは `protected にしました` と出す |
| 新規 | `e2e/pull-up-protected-merge.spec.ts` | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

- `PublicizeCrossClassCallsResult` の `publicized: readonly string[]` を `changed: readonly { readonly methodId: string; readonly visibility: 'public' | 'protected' }[]` にする(トーストで出し分けるため)。呼び出し側をすべて直す
- 関数名は今のまま(`publicizeCrossClassCalls`)でよい

## 振る舞い

### 自動の可視性

- 違反(`findVisibilityViolations`)になった private / protected のメソッドについて、そのメソッドを呼んでいるクラスを集める
  - 呼び出し元が**すべて**そのメソッドの持ち主の子孫(`extendsChainIds` で判定)→ `protected`
  - 1つでも子孫でないクラスから呼ばれる → `public`
- `visibilityEnforced` のステージでは今どおり何もしない

### 統合の条件

- 今の `mergeableVisibility`(同じ可視性で、private 同士なら統合できる / それ以外は呼び出し行だけの骨組み同士のときだけ)を、次のように広げる
  - private・protected のどの組み合わせ(private+private / private+protected / protected+protected)でも統合できる。統合結果の可視性は広い方
  - public を含む組み合わせは今どおり(同じ可視性の骨組み同士だけ)。公開範囲が広がるのを黙って起こさない

## TDD対象の純粋関数

### `publicizeCrossClassCalls`(`domain/codebase/publicizeCrossClassCalls.ts`)

- 子クラスのメソッドが、親クラスの private メソッドを呼ぶ → 親のメソッドが `protected`
- 子と、継承関係の無いクラスの両方から呼ばれる → `public`
- 孫クラスから呼ばれる → `protected`
- 違反が無い → 何も変えない

### `findMergeCandidates` / `mergeMethods`(`domain/codebase/mergeMethods.ts`)

- private と protected で形が一致 → 候補に出る。統合結果は `protected`
- protected 同士で形が一致(骨組みではない) → 候補に出る
- public と private → 候補に出ない(今どおり)
- public 同士の骨組み → 今どおり候補に出る

## 受け入れ基準

1. 上級1で、背景の手順1〜3のとおりに操作すると、`NotifierBase.logEmailNotification()` が `#`(protected)になり、トーストが `…protected にしました` になる
2. 続けて `NotifierBase.logEmailNotification()` を開くと、「SmsNotifier.logSmsNotification() と統合する」が出て、押すと1つのメソッドにまとまる
3. 継承関係の無いクラスへメソッドを移したときは、今どおり public になる
4. 全ステージの解答例の点数(`npm run stage-report`)が変わらない
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 統合先のクラスを選べるようにすること(統合結果は今どおり選んでいるメソッドの位置に残る)
- 「Pull Up Method」を1回の操作でできるようにすること
