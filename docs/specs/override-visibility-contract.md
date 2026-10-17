# override-visibility-contract: 親のメソッドを上書きするとき、公開範囲を狭めたら「約束違反」にする

## 背景・目的

2026-10-17 に上級8「取り込みの手順を Template Method にまとめる」で、子クラス `CsvOrderImporter`・`JsonOrderImporter` に変換処理を抽出すると、
自動で付く名前は親の抽象メソッドと同じ `parse` になり(よくできている)、可視性は **private**(`-`)で作られた。
親 `OrderImporter` の `parse()` は **protected**(`#`)の抽象メソッドである。

この状態(子が private の `parse()` で親の protected の `parse()` を上書きしている)でも、「インターフェースの約束違反」は0件のままだった。
Java・C#・TypeScript などでは、**上書きで公開範囲を狭めることはできない**(コンパイルエラー)。また private では親から呼べないので、Template Method として動かない。
解答例では「parse を protected にしよう」という手順があるが、飛ばしても採点で気付けない。

約束違反の判定(`domain/scoring/interfaceContracts.ts`)は、実装の有無をメソッド名だけで見ていて、可視性は見ていない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/scoring/interfaceContracts.ts` | domain | 祖先(extends の先祖・implements のインターフェース役)の同名メソッドより公開範囲が狭い上書きを見つける `findNarrowedOverrides` を足し、約束違反(`contract`)に数える |
| 変更 | `src/domain/scoring/interfaceContracts.test.ts` | domain | 上のテスト |
| 変更 | `src/domain/scoring/score.ts`(約束違反を数える箇所) | domain | 可視性の欄を出すステージ(`showsVisibilityControl`)でだけ、狭めた上書きを数える |
| 変更 | `src/domain/scoring/violationTargets.ts` | domain | 狭めた上書きのメソッドを、約束違反の対象に入れる(光らせる・内訳に出す) |
| 変更 | 約束違反の理由の文(`presentation/stage/ruleWhy.ts` など) | presentation | 狭めた上書きの説明を足す |
| 変更 | `docs/stages/report.md` | docs | `npm run stage-report` で作り直す |

## データ・型の変更

- 公開範囲の広さ: `private` < `protected` < `public`
- 上書きの判定: クラスのメソッドと**同じ名前**のメソッドが、extends の先祖、または implements しているインターフェース役(とその先祖)にあるとき、それを上書きしているとみなす
- 祖先側のメソッドより狭い可視性なら、狭めた上書き。1メソッドにつき1件
- 可視性の欄を出さないステージ(`showsVisibilityControl(stage) === false`)では数えない(プレイヤーが可視性を直せないため)

## 理由の文(約束違反の「なぜ?」に足す)

- `親のメソッドを上書きするときは、公開範囲を狭められません。private にすると親から呼べず、多くの言語ではコンパイルエラーになります。親と同じか、広い公開範囲にしましょう`

## TDD対象の純粋関数

### `findNarrowedOverrides`(`domain/scoring/interfaceContracts.ts`)

- 親の protected `parse` を子が private `parse` で上書き → 子の `parse` を返す
- 子が protected・public で上書き → 返さない
- インターフェース役の public `charge` を実装クラスが private `charge` で持つ → 返す
- 同名でも継承関係の無いクラス → 返さない
- 孫クラスが祖父の protected を private で上書き → 返す

### 採点

- 可視性の欄を出すステージ(上級8)では、狭めた上書き2件で約束違反が2件増える
- 可視性の欄を出さないステージでは数が変わらない

## 受け入れ基準

1. 上級8で、子クラスの変換処理を抽出して `parse()`(private)にし、継承元を `OrderImporter` にすると、`インターフェースの約束違反` が2件になり、内訳の「なぜ?」に上の文が出る
2. 2つの `parse()` を protected にすると約束違反が0件になる
3. 全ステージの解答例の点数(`npm run stage-report`)が変わらない(解答例はすでに protected にしている)。変わるステージが出たら、採点ではなくそのステージの解答例(可視性の手順)を直す
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 戻り値・引数の型(シグネチャ)の違いの判定
- 可視性の欄を出さないステージで、上書きの可視性を自動でそろえること
