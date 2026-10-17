# sample-answer-publicize: 解答例の設計で、別クラスから呼ばれる private を残さない

## 背景・目的

2026-10-17 に遊んで、解答例の図に「private なのに別のクラスから呼ばれているメソッド」が出ていることに気付いた。

- 中級2「何でも入った1つのファイル」の「解答例の図を見る」で、`ShippingService.calculateShippingFee()` と `PointService.addPoints()` が `-`(private)のまま、
  `CartService` から矢印(依存)が伸びている
- 設計くらべ1問目の設計A(良い設計)でも、`UserRepository.saveUser()`・`Mailer.sendWelcomeMail()` などが `-` のまま `UserController` から呼ばれている

プレイヤーがメソッドを移したときは、可視性を採点しないステージなら `publicizeCrossClassCalls` で自動的に public になる(`auto-public-on-move`)。
ところが模範解答の再生(`applySolutionSteps`・`sampleAnswerCodebase`)はこの処理を通らないので、**お手本の方が自分の操作結果と違い、しかも実際のコードならコンパイルできない形**になっている。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | 手順を当てるたびに、可視性を採点しないステージでは `publicizeCrossClassCalls` を通す |
| 変更 | `src/domain/stage/sampleAnswer.test.ts` | domain | 上のテスト |
| 変更 | `sampleAnswerCodebase` / `applySolutionSteps` を呼んでいる箇所(`infrastructure/quizzes/comparisonQuizzes.ts`・`domain/blank/reviewBlankDesign.ts`・解答例の図・解答の再生など) | 各層 | 可視性を採点するかどうかを渡す |
| 変更 | 解答例の可視性を前提にしている既存のテスト・E2E | テスト | 新しい可視性に合わせる |

## データ・型の変更

- `applySolutionSteps(codebase, steps, options?: { readonly visibilityEnforced?: boolean })` にする(既定は `false` = 自動で public にする)
- `sampleAnswerCodebase(stage, steps?)` の `stage` の型を `Pick<Stage, 'id' | 'codebase' | 'visibilityEnforced'>` にし、`stage.visibilityEnforced === true` のときだけ自動の public 化をしない
- `solutionSnapshots`(解答の再生で使う途中経過)も同じルールにする(再生の途中のコマでも、別クラスから呼ばれる private が出ない)

## 振る舞い

- `move`(メソッドの移動)・`moveField` など、手順を1つ当てるたびに、`visibilityEnforced` でなければ `publicizeCrossClassCalls` を当てる
  (プレイヤーの移動と同じタイミング・同じ規則。継承の子孫からの protected 呼び出しは今どおり変えない)
- `visibilityEnforced` のステージ(中級3など)は今どおり。模範解答の `changeVisibility` の手順で明示的に直す

## TDD対象の純粋関数

### `applySolutionSteps`(`domain/stage/sampleAnswer.ts`)

- private メソッドを別クラスへ `move` し、元のクラスから呼ばれる → 結果ではそのメソッドが public
- 同じ手順を `{ visibilityEnforced: true }` で当てる → private のまま
- `solutionSnapshots` の途中のコマでも、移した直後のコマで public になっている
- 既存のステージ全体のテスト(`stageCatalog.test.ts` など)で、可視性を採点しないステージの解答例に `findVisibilityViolations` が0件であることを確かめる

## 受け入れ基準

1. 中級2の「解答例の図を見る」で、`calculateShippingFee()` と `addPoints()` が `+`(public)で表示される
2. 設計くらべ1問目の設計Aで、`saveUser()`・`removeUserRecord()`・`sendWelcomeMail()`・`sendFarewellMail()` が `+` で表示される
3. 可視性を採点するステージ(`visibilityEnforced: true`)の解答例の図は、今と同じ可視性のまま
4. 全ステージの解答例の点数(`npm run stage-report` の表)が変わらない
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 自動で public にする規則そのものの見直し(protected を選ぶかどうかは `pull-up-protected-merge` で扱う)
- 模範解答の手順の書き換え
