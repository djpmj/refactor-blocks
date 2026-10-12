# pain-request-alignment: 「もし、この変更が来たら?」の依頼を、そのステージの組み替えが効くものにする

## 背景・目的

各ステージの1件目の modify の変更依頼(`painRequestsOf(stage).modify`)は、次の3か所で使う。

- 100点前のカード「もし、この変更が来たら?」(直す場所の数・読む行数)
- #160 で入れる、冒頭と仕上げの「手で直す」問題
- #164 の答え合わせ画面

「組み替えたおかげで、同じ変更がこんなに楽になった」を体験させる中心の依頼である。

ところが全ステージで計算すると、模範解答どおりに組み替えても、この依頼の直す場所も読む量もほとんど変わらないステージが5つあった。

| ステージ | 依頼 | 直す場所(初期 → 解答例) | 読む量(初期 → 解答例) |
| --- | --- | --- | --- |
| 中級1 intermediate-cyclic-dependency | req-price-rule | 3 → 3 | 37 → 34 行(8%減) |
| 中級2 intermediate-god-file | req-shipping-rule | 3 → 3 | 21 → 21 行 |
| 中級8 intermediate-extract-class | req-building-name | 2 → 2 | 18 → 18 行 |
| 中級12 intermediate-middle-man | req-stock-rule | 2 → 2 | 66 → 66 行 |
| 上級5 advanced-collapse-hierarchy | req-tab-delimiter | 4 → 4 | 29 → 29 行 |

これらのステージでは、冒頭と仕上げで同じ変更を手で直しても「何も変わらなかった」になり、設計の良さを体験できない。
ステージのテーマ(循環をほどく・ファイルを分ける・クラスを分ける・横流しをなくす・継承を畳む)が、今の数え方(直す場所のメソッドの数と、その行数の合計)に表れる依頼になっていない。

そこで、カタログのテストで「模範解答で1件目の依頼がはっきり楽になる」ことを守り、5ステージの依頼を見直す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 模範解答で1件目の modify の依頼がはっきり楽になることを確かめるテスト |
| 変更 | `src/infrastructure/stages/intermediateStages.ts`・`advancedStages.ts` | infrastructure | 5ステージの変更依頼(1件目の modify)を見直す |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | 依頼に合わせて模範解答の手順を直す必要があれば直す |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 章の結び(`outro`)が1件目の依頼を指している場合、依頼に合わせて直す |
| 変更 | 依頼の文言・点数を確かめている既存の E2E | E2E | 新しい依頼に合わせる |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する |

`application` / `presentation` は変更しない。

## データ・型の変更

なし(ステージ定義の中身だけを変える)。

## 「はっきり楽になる」の基準

`measurePain(stage, sampleAnswerCodebase(stage))` の `initial` と `current` について、次のどちらかが成り立つこと。

- 直す場所の数が減る(`current.siteIds.length < initial.siteIds.length`)
- 読む行数が初期の 75% 以下になる(`current.readLines <= initial.readLines * 0.75`)

## 依頼の見直し方

5ステージそれぞれで、次のどれかで直す(ステージのテーマが体験に表れるものを選ぶ)。

- `changeRequests` の中に、すでに基準を満たす modify の依頼があれば、それを1件目に並べ替える
- 依頼の `responsibility` を、ステージの組み替えで切り出される・まとまる処理の責務に変える(例: 中級12 なら、横流しをなくすと直接の呼び出しだけになる受付の処理)
- 新しい modify の依頼を1件目として足す(`partName` も書く)。足したら `rumor`(#165)・`boss`(#170)のテストとの整合も取る

依頼を変えたら、次も合わせる。

- `change-request-fairness`(#176)のテスト(解答例の設計で100点で入ること)を通す
- 章の結び(`storyChapters` の `outro`)が依頼の内容に触れていれば直す

## TDD対象の純粋関数

なし(ステージ定義の変更)。次のカタログのテストを先に書き、5ステージが失敗することを確かめてから依頼を直す。

### ステージカタログ(`stageCatalog.test.ts`)

- 解答例があり、modify の依頼があるリファクタリングのすべてのステージで、上の「はっきり楽になる」の基準を満たす
- 失敗したときのメッセージに、ステージID・依頼ID・直す場所と読む行数の前後を出す

## 受け入れ基準

1. カタログのテストが、全ステージで1件目の modify の依頼が模範解答ではっきり楽になることを確かめている
2. 表の5ステージで、模範解答どおりに組み替えると「もし、この変更が来たら?」の数字(直す場所か読む行数)がはっきり減る
3. ほかのステージの1件目の依頼は変わっていない
4. `change-request-fairness`(#176)のテストと、既存のカタログのテスト・E2E が通る
5. `npm run check` と `npm run test:e2e` が通る。`npm run stage-report` を再生成してコミットする

## スコープ外

- 痛みの数え方(`measurePain`)に、ファイルの数や呼び出しの段数などを足すこと(依頼の見直しで足りるため)
- 2件目以降の依頼の見直し(#176 で扱う)
- ステージのテーマ・初期コード・クリア条件の変更
