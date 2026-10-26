# hint-extract-name-mismatch: ヒントのとおりに抽出したら、ヒントに出てくる名前が自動で付くようにする

## 背景・目的

実機で確認したこと: チュートリアル1(`tutorial-extract-method`)の「次の一手」のヒントは、模範解答(`src/domain/stage/sampleAnswer.ts` の `sampleAnswerSteps['tutorial-extract-method']`)から次の3つの文を作る。

1. 「printMonthlyReport から「今月の売上を集計する・前月比を計算する」をExtract Methodで取り出し、aggregateSales という名前にしよう」
2. 「…「表のヘッダーを組み立てる・表の行を組み立てる」…、buildSalesTable という名前にしよう」
3. 「…「画面に出力する」…、printSalesReport という名前にしよう」

ところが、抽出したときの自動命名(`suggestMethodName`)では `aggregateSales` は一致したが、残り2つは `buildTable()` と `print()` になった。後に続くヒント(「printSalesReport をMove Methodで SalesReportPrinter へ移そう」)の名前のメソッドが画面に無いので、プレイヤーが迷う。

コードを追った原因:

- `methodNamingOf`(`src/domain/stage/methodNaming.ts`)は、模範解答の抽出手順のうち **処理が2つ以上のもの** しか名前の組(`groups`)に入れない(`fragmentIds.length < 2` を捨てている)。
- `suggestMethodName`(`src/domain/codebase/suggestMethodName.ts`)は、処理が1つのときは `groups` を見ずに `Fragment.suggestedName` を使う。`frag-print` の `suggestedName` は `print` なので、手順3はどう選んでも `print()` になる。
- 処理が2つ以上のときは、選んだIDの集合が模範解答と **完全に** 一致したときだけ組の名前を使い、それ以外は責務表(`stage.methodNames`。チュートリアル1の `formatting` は `buildTable`)を使う。`buildTable()` は、模範解答と違う組み合わせ(例: 先に抽出した `aggregateSales` の呼び出し行も含めて選んだ)で選んだときに出る。ヒント文はどの処理を選ぶかを書いているので、そのとおり選べば `buildSalesTable` になる(受け入れ基準2で確かめる)。

ヒント文はさらに「〜という名前にしよう」と、プレイヤーに名前を付けさせるような書き方になっている。このリポジトリでは名前は自動で付け、プレイヤーには付けさせない方針なので、この書き方も直す。

## 設計判断(確定)

- **ヒントのとおりに処理を選んだら、ヒントに出てくる名前を自動で付ける**(呼び出し元が挙げた案のうち「ヒントに沿った抽出ならその名前を採用」の方)。「名前は自動で付く」と書き直すだけの案は採らない。後に続くMove Methodのヒントが `printSalesReport` などの名前で書かれているので、名前が合わないままだと文を直しても迷うから。
- 1処理の抽出でも、模範解答の抽出手順と処理IDが一致すれば模範解答の名前を優先する。`suggestedName` は、模範解答と一致しない1処理の抽出のときに使う(今どおり)。責務表(`byResponsibility`)は今どおり2処理以上のときだけ使う。
- ヒント文は「〜という名前にしよう」をやめて「`<source>` から「`<labels>`」をExtract Methodで取り出そう(名前は自動で `<name>` になる)」にする。名前を付けさせる書き方をやめつつ、後のヒントに出てくる名前を先に知らせる。
- ponytail: 新しい型・データは足さない。`methodNamingOf` のフィルタ1つと `suggestMethodName` の分岐の順番、ヒント文1行を変えるだけ。ステージ定義の `suggestedName` や模範解答の名前をそろえて書き換える案は採らない(全ステージで同じずれが起き得るので、データを直すより仕組みを1か所直す)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/methodNaming.ts` | domain | 1処理の抽出手順も `groups` に入れる(`fragmentIds.length < 2` のフィルタを外す) |
| 変更 | `src/domain/stage/methodNaming.test.ts` | domain | 1処理の手順も組に入るように期待値を直す |
| 変更 | `src/domain/codebase/suggestMethodName.ts` | domain | 処理の数に関係なく、まず `groups` との一致を見る。一致しなければ、1処理は `suggestedName`、2処理以上は今どおり責務表→組み合わせ |
| 変更 | `src/domain/codebase/suggestMethodName.test.ts` | domain | 「選択が1処理なら模範解答や責務表よりsuggestedNameを優先する」を下記TDDのケースに直す |
| 変更 | `src/presentation/stage/describeSolutionStep.ts` | presentation | extract のヒント文を「…取り出そう(名前は自動で X になる)」に変える |
| 変更 | `src/presentation/stage/describeSolutionStep.test.ts` | presentation | extract のヒント文のケースを足す |
| 変更 | `e2e/extract-preview.spec.ts` | E2E | チュートリアル1でヒントのとおりに選ぶと、ヒントの名前が入ることを確かめるテストを足す |

`src/application/`・`src/infrastructure/`(ステージ定義・模範解答のデータ)と `MethodEditor.tsx` は変更しない(`methodNamingOf(stage)` をそのまま渡しているので、domainの変更だけで画面に反映される)。新しい依存は足さない。

## データ・型の変更

なし(`MethodNaming` の型はそのまま。`groups` に1処理の組も入るようになるだけ)。

## 動きの仕様

- メソッドエディタで処理を選ぶと、名前欄(`新しいメソッド名`)の自動の値は次の順で決まる。プレイヤーが入力した名前を優先するのは今どおり。
  1. 選んだ処理IDの集合が、そのステージの模範解答のどれかの抽出手順の `fragmentIds` と一致する(順序は問わない) → その手順の `name`
  2. 処理が1つ → その処理の `suggestedName`、無ければ `extractedMethod`
  3. 処理が2つ以上 → 責務表 → `suggestedName` の組み合わせ(今どおり)
  4. 同じクラスに同名があれば末尾に番号(今どおり)
- チュートリアル1の具体例:

| 選んだ処理 | 今 | 変更後 |
| --- | --- | --- |
| 今月の売上を集計する・前月比を計算する | `aggregateSales` | `aggregateSales` |
| 表のヘッダーを組み立てる・表の行を組み立てる | `buildSalesTable` | `buildSalesTable` |
| 画面に出力する だけ | `print` | `printSalesReport` |
| 表のヘッダー・表の行・画面に出力する | `printReport` | `printReport`(模範解答と一致しないので今どおり) |
| 表の行を組み立てる だけ | `buildTableRows` | `buildTableRows`(模範解答と一致しないので今どおり) |

- 「次の一手」のヒントと模範解答の再生(`SampleAnswerReplayDialog`)の extract の文は、例えば次のようになる。
  「printMonthlyReport から「画面に出力する」をExtract Methodで取り出そう(名前は自動で printSalesReport になる)」

## TDD対象

### `methodNamingOf`(domain)

- 2処理の抽出・1処理の抽出・move が並んだ手順 → 2つの抽出がどちらも `groups` に入り(手順の順)、move は入らない。`byResponsibility` は `methodNames`
- 模範解答も責務名も無い → `{ groups: [], byResponsibility: {} }`(今どおり)

### `suggestMethodName`(domain)

- 1処理で、`groups` にそのIDだけの組がある → 組の名前(`suggestedName` より優先)
- 1処理で、`groups` に一致する組が無く、責務表に名前がある → `suggestedName`(責務表は使わない)
- 1処理で、一致する組が無く `suggestedName` も無い → `extractedMethod`
- 1処理で組の名前が既存名と重なる → 番号付き(例: `printSalesReport2`)
- 既存の2処理以上のケース(ID集合の一致・一部一致なら責務表・行数最大の責務・同点なら先の責務・call責務を集計しない)は今どおり通る

### `describeSolutionStep`(presentation)

- `fromClass` なしの extract → 「`from` から「ラベル1・ラベル2」をExtract Methodで取り出そう(名前は自動で `name` になる)」
- `fromClass` ありの extract → 「`fromClass` の `from` から…」で始まる
- 文に「という名前にしよう」を含まない

## 受け入れ基準

1. `npm run dev` でチュートリアル1を開き、printMonthlyReport をクリックして「画面に出力する」だけを選ぶと、名前欄が `printSalesReport` になる。そのまま抽出するとキャンバスに `printSalesReport` のメソッドが出る
2. 同じく「表のヘッダーを組み立てる」「表の行を組み立てる」の2つを選ぶと名前欄が `buildSalesTable`、「今月の売上を集計する」「前月比を計算する」の2つで `aggregateSales` になる
3. ヒント「次の一手」の extract の文が「…をExtract Methodで取り出そう(名前は自動で aggregateSales になる)」の形になり、「という名前にしよう」が出ない
4. ヒントの手順3まで、ヒントの文のとおりに処理を選んで抽出だけすると、画面のメソッド名がヒントの文の名前(`aggregateSales`・`buildSalesTable`・`printSalesReport`)と一致し、手順10〜12のMove Methodのヒントに出てくる名前のメソッドが画面にある
5. チュートリアル2で「商品が空でないか検証する」だけを選ぶと今どおり `validateItems`、「在庫があるか検証する」も足すと `validateOrder` になる(`e2e/refactor.spec.ts` の既存テストが通る)
6. `e2e/extract-preview.spec.ts` に、受け入れ基準1・2(1処理で `printSalesReport`、2処理で `buildSalesTable`)を確かめるテストがある
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- Merge Methods のヒント文(「〜という名前に統合しよう」)と統合時の名前の決め方。今回は Extract Method の名前のずれだけを直す
- 模範解答と違う組み合わせで選んだときの名前を、模範解答に寄せること(どの手順に近いかを推測する仕組みは作らない)
- ヒントと違う名前で抽出したあと、後に続くMove Methodなどのヒント文を画面上の名前に合わせて書き換えること
- ステージ定義の `suggestedName`・責務表(`methodNames`)・模範解答の名前の書き換え
- ヒントの表示場所(ツールバーのポップオーバーなど)の変更
