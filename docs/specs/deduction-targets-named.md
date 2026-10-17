# deduction-targets-named: 減点の内訳に、どのクラス・メソッドが原因かを名前で出す

## 背景・目的

2026-10-17 に中級7「getter/setter だけの口座クラス」と中級11「Controller に全部書いてある注文API」を遊んで、
減点の内訳(ヘッダーの「減点の内訳」、`ScoreBreakdown`)が**ルール名と件数と一般論**しか出さないことに困った。

- 中級7: `カプセル化の破れ ×2` →「なぜ?」を開くと「データを外から自由に書き換えられると…」。どのメソッドが原因か(public の `setBalance()`・`setDailyWithdrawn()`)は書かれていない
- 中級11: `層の依存の向き ×1` →「Controller が Repository を直接呼んだりすると…」。どの依存か(`OrderController → OrderRepository`)は書かれていない

ヒント1「どこが問題?」で場所を光らせる方法はあるが、内訳を見ている最中には分からない。
クラス設計を学ぶには、「このルールに、自分のどの設計判断が引っかかったのか」が分かることが大事。

違反の対象は `domain/scoring/violationTargets.ts` の `violationTargets`(ルールごとにファイル・クラス・メソッドのID)で、すでに求められている。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/stage/describeTargets.ts` | presentation | 違反の対象のIDを、表示用の名前(`Class.method()`・`Class`・`<クラス名> のファイル`)の一覧にする純粋関数 |
| 新規 | `src/presentation/stage/describeTargets.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/stage/ScoreBreakdown.tsx` | presentation | ルールの行の下に「対象:」として名前を並べる。名前を押すとキャンバスでその場所を選ぶ(光らせる) |
| 変更 | 依存のルール(層・循環・結合度)の対象 | domain | 依存の向きを名前で出すため、`violationTargets` とは別に、違反した依存(`from → to`)の一覧を返す既存の関数(`findLayerViolations`・循環の `findCycles` など)を使う。無ければ `domain/scoring/` に足し、テストを書く |
| 変更 | 減点の内訳の E2E | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

なし(表示用の変換を足すだけ)。

## 表示の仕様

- 各ルールの行(`カプセル化の破れ ×2`)の下に `対象: Account.setBalance()、Account.setDailyWithdrawn()` を出す
- 依存に関するルール(層の依存の向き・循環依存・結合度)は `対象: OrderController → OrderRepository` のように矢印で出す
- 対象が5件を超えるときは、5件と `ほか N 件` にする
- 名前はボタンにし、押すとキャンバスでそのクラス・メソッドを選んで画面内へ寄せる(メソッドなら右のエディタも開く)
- 「なぜ?」の説明は今のまま

## TDD対象の純粋関数

### `describeTargets(codebase, target)`(`presentation/stage/describeTargets.ts`)

- メソッドのID → `Account.setBalance()`
- クラスのID → `OrderService`
- ファイルのID → `CartService・PointService のファイル`
- 6件 → 5件と `ほか 1 件`
- 存在しないIDは飛ばす

依存の一覧を返す関数を domain に足した場合は、その関数にも正常系(違反あり・なし)のテストを書く。

## 受け入れ基準

1. 中級7で、debit・credit を Account へ移して public にしたあと、減点の内訳に `カプセル化の破れ ×2` と `対象: Account.setBalance()、Account.setDailyWithdrawn()` が出る
2. 中級11で、保存のメソッドを OrderController から OrderRepository へ直接移すと、`層の依存の向き` の下に `対象: OrderController → OrderRepository` が出る
3. 対象の名前を押すと、キャンバスでそのメソッドが選ばれている
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 「なぜ?」の説明文の書き換え
- ヒントの段の変更
