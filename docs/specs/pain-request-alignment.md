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


### 調べて分かったこと(2026-10-17 追記)

5ステージの組み替えは、どれも**メソッドの中身は変えず、置き場所を変える**もの(メソッドの移動・ファイル分け・クラスの抽出・横流しの除去・継承の畳み込み)である。
メソッドの中身が変わらないので、どの modify の依頼を選んでも「直す場所のメソッドの数と行数」は変わらない。依頼の差し替えでは直らない。
一方で、組み替えの効果は次の数字には表れている(全ステージで計測)。

| ステージ | 直すクラス | 直すファイル | 直す場所があるクラスの行数 |
| --- | --- | --- | --- |
| 中級1 | 2 → 1 | 2 → 1 | 60 → 48 行 |
| 中級2 | 2 → 1 | 1 → 1 | 55 → 26 行 |
| 中級8 | 1 → 1 | 1 → 1 | 40 → 22 行 |
| 中級12 | 1 → 1 | 1 → 1 | 70 → 70 行 |
| 上級5 | 2 → 1 | 2 → 1 | 37 → 35 行 |

直すクラスの数・ファイルの数は、今も `measurePain` が測り、`improved` の判定にも使っているが、カードには「今」の数しか出していない。

そこで、**依頼は変えず**、次の2つで「はっきり楽になる」を体験できるようにする。

- 直すクラスの数・ファイルの数が減ったら、カードにも前後を出す(中級1・中級2・上級5)
- 「直す場所があるクラスの行数」(そのクラスを開いて目を通す量)を新しく測り、カードに出す(中級8)

中級12(横流しの除去)は、呼び出しの中継(`OrderManager`)を消すだけのステージで、中継のメソッドは呼び出ししか持たない。
直す場所・クラス・行数のどれにも組み替えの効果が表れないため、理由を書いて基準の対象外にする(呼び出しの段数を数えるのは別の仕様で扱う)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/change/changePain.ts` | domain | `PainSummary` に `classLines` を足す。`improved` に `classLines` の減少を足す |
| 変更 | `src/domain/change/changePain.test.ts` | domain | 上のテスト |
| 新規 | `src/domain/change/painRelief.ts` | domain | 「はっきり楽になる」の判定の純粋関数 |
| 新規 | `src/domain/change/painRelief.test.ts` | domain | 上のテスト |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | クラス数・ファイル数・クラスの行数の前後を出す |
| 変更 | `src/presentation/stage/ManualFixPanel.tsx` | presentation | 冒頭と仕上げの比較の文に、クラス数の前後を足す(減ったときだけ) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 模範解答で1件目の modify の依頼がはっきり楽になることを確かめるテスト |
| 変更 | 痛みカードの文言を確かめている既存の E2E | E2E | 新しい文言に合わせる |
| 新規 | `e2e/pain-request-alignment.spec.ts` | E2E | 下の受け入れ基準を確かめる |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(差分が出る場合) |

ステージ定義(`*Stages.ts`)・模範解答・`application` は変更しない。

## データ・型の変更

```ts
// src/domain/change/changePain.ts
export type PainSummary = {
  // 既存のフィールドに加えて
  /** 直す場所があるクラスの行数(classLines)の合計。そのクラスを開いて目を通す量。同じクラスは1回だけ数える。 */
  readonly classLines: number;
};
```

- `measurePain` の `improved` は、今の条件に「`current.classLines < initial.classLines`」を足す

```ts
// src/domain/change/painRelief.ts
/** 「はっきり楽になる」の判定。どれか1つでも成り立てば true。 */
export function isClearlyRelieved(initial: PainSummary, current: PainSummary): boolean;
```

## 「はっきり楽になる」の基準

`measurePain(stage, sampleAnswerCodebase(stage))` の `initial` と `current` について、次のどれかが成り立つこと(`isClearlyRelieved`)。

- 直す場所の数が減る(`current.siteIds.length < initial.siteIds.length`)
- 直すクラスの数が減る(`current.classes < initial.classes`)
- 直すファイルの数が減る(`current.files < initial.files`)
- 読む行数が初期の 75% 以下になる(`current.readLines <= initial.readLines * 0.75`)
- 直す場所があるクラスの行数が初期の 75% 以下になる(`current.classLines <= initial.classLines * 0.75`)

### 対象外のステージ

`stageCatalog.test.ts` に、理由つきの対象外の一覧を置く(理由が空なら失敗。対象外のステージが基準を満たすようになったら、一覧から消すよう失敗する)。

- `intermediate-middle-man`: 横流しの除去は呼び出しの中継を消すだけで、直す場所・クラス・行数のどれも変わらないため。呼び出しの段数を数えるようにしたときに外す

## 見た目・動きの仕様

### 100点前のカード「もし、この変更が来たら?」(`ModifyBefore`)

- 直す場所の行: 今と同じ `直す場所は今 N か所(C クラス・F ファイル)`。クラスの数かファイルの数が減っていれば、`(最初は C0 クラス・F0 ファイルでした)` を足す。
  直す場所の数が減ったときの今の `(最初は N0 か所でした)` はそのまま(両方減れば `(最初は N0 か所・C0 クラス・F0 ファイルでした)` にまとめる)
- 行を1つ足す: `そのクラスを開くと、目を通す行数は今 L 行`。減っていれば `(最初は L0 行でした)` を足す

### 100点のあとのカード(`ModifyAfter`)

- 今の2文に加えて、減ったものだけ次を出す
  - `直すクラスは C0 クラス → C クラス に まとまりました。`(ファイルが減ったときは `C0 クラス・F0 ファイル → C クラス・F ファイル`)
  - `開いて読むクラスの行数は L0 行 → L 行 になりました。`

### 冒頭と仕上げの比較(`ManualFixPanel` の `fix-comparison`)

- 今の文の「直す場所 … か所」の後ろに、クラスの数が減ったときだけ `(C0 クラス → C クラス)` を足す

## TDD対象の純粋関数

### `measurePain`(`domain/change/changePain.ts`)

- 2つのクラスに直す場所があるとき、`classLines` は2つのクラスの行数の合計
- 同じクラスに直す場所が2つあっても、そのクラスの行数は1回だけ数える
- 直す場所の数・読む行数が同じでも、`classLines` が減れば `improved: true`

### `isClearlyRelieved`(`domain/change/painRelief.ts`)

- 直す場所が減る → true
- 場所は同じ・クラスが 2 → 1 → true
- 場所・クラスは同じ・ファイルが減る → true
- 読む行数が 100 → 75 → true、100 → 76 → false
- クラスの行数が 40 → 22 → true
- どれも変わらない → false

### ステージカタログ(`stageCatalog.test.ts`)

- 解答例があり、modify の依頼があるリファクタリングのすべてのステージ(対象外を除く)で、`isClearlyRelieved` が成り立つ
- 失敗したときのメッセージに、ステージID・依頼ID・直す場所・クラス・ファイル・読む行数・クラスの行数の前後を出す
- 対象外の一覧の理由が空でない。対象外のステージが基準を満たしたら失敗する

## 受け入れ基準

1. カタログのテストが、対象外の中級12を除く全ステージで、1件目の modify の依頼が模範解答ではっきり楽になることを確かめている
2. 中級1・中級2・上級5で模範解答どおりに組み替えると、100点前のカードに `(最初は 2 クラス…でした)` が出る
3. 中級8で模範解答どおりに組み替えると、100点前のカードの `そのクラスを開くと、目を通す行数は今 22 行(最初は 40 行でした)` が出る(数字はステージ定義から計算した値)
4. どのステージの変更依頼・模範解答も変わっていない
5. `change-request-fairness`(#176)のテストと、既存のカタログのテスト・E2E が通る
6. `npm run check` と `npm run test:e2e` が通る。`npm run stage-report` の出力に差分が出る場合は再生成してコミットする

## スコープ外

- 呼び出しの段数(入口から直す場所までにたどるメソッドの数)を数えること。中級12を対象に戻すときに別の仕様で扱う
- 答え合わせ画面(`ChangeImpactDialog`、#164)の数字の変更
- 2件目以降の依頼の見直し(#176 で扱う)
- ステージのテーマ・初期コード・クリア条件・変更依頼の変更
