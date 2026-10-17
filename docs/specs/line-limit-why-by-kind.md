# line-limit-why-by-kind: 行数の減点の説明を、超えているのがメソッド・クラス・ファイルのどれかで出し分ける

## 背景・目的

2026-10-17 に中級2「何でも入った1つのファイル」でヒント1「どこが問題?」を開くと、
`いちばん大きい減点: 行数(-20点)` のあとに `長いメソッドは、どこを直せばよいか探すだけで全体を読むことになります…` と出た。
このとき超えていたのは**クラス(37行/上限28行)とファイル(74行/上限29行)**で、メソッドは上限内だった。
課題は「ファイルを分ける」なのに、説明が「メソッドを短くする」方へ誘導してしまう。

行数ルールの説明(`RULE_WHY['line-limit']`、`presentation/stage/ruleWhy.ts`)はメソッドの話に固定されていて、ヒント(`ProblemHint`)・減点の内訳(`ScoreBreakdown`)・ファイルの印の説明(`FileMarkPopover`)で同じ文が使われている。
行数の違反は `LineLimitViolation.kind`(`'method' | 'class' | 'file'`)で種類が分かる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/stage/ruleWhy.ts` | presentation | 行数の説明を種類ごとに持ち、違反の種類から選ぶ関数 `lineLimitWhy` を足す |
| 変更 | `src/presentation/stage/ruleWhy.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/stage/ProblemHint.tsx` | presentation | 行数のときは `lineLimitWhy` の文を出す |
| 変更 | `src/presentation/stage/ScoreBreakdown.tsx` | presentation | 同上 |
| 変更 | `src/presentation/canvas/FileMarkPopover.tsx` | presentation | 同上(印を付けたファイル・クラスの違反の種類で選ぶ) |

`domain` は変更しない(`findLineLimitViolations` の `kind` を使う)。

## データ・型の変更

`ruleWhy.ts` に次を足す。`RULE_WHY['line-limit']` はメソッドの文のまま残す(種類が分からない場所の既定)。

```ts
export const LINE_LIMIT_WHY: Record<'method' | 'class' | 'file', RuleWhy> = {
  method: /* 今の RULE_WHY['line-limit'] と同じ */,
  class: {
    trouble: '大きいクラスは、1か所を直すつもりでも、関係のないメソッドまで読むことになります。変わる理由が違う処理が同居していることも多く、巻き込んで壊しやすくなります。',
    because: '変わる理由ごとにクラスを分けると、直すときに開くクラスが小さくなります。',
  },
  file: {
    trouble: '大きいファイルは、何がどこにあるか探すだけで時間がかかり、複数人が同じファイルを同時に直して衝突しやすくなります。',
    because: '持ち主(クラス)ごとにファイルを分けると、探す場所と衝突が減ります。',
  },
};
```

## TDD対象の純粋関数

### `lineLimitWhy(kinds)`(`presentation/stage/ruleWhy.ts`)

入力: 今の行数の違反の種類の配列。出力: 出す説明(`RuleWhy`)の配列(重複なし、`method → class → file` の順)。

- `['class', 'file']` → クラスとファイルの説明の2件
- `['method', 'method']` → メソッドの説明の1件
- `[]` → メソッドの説明の1件(既定)

## 受け入れ基準

1. 中級2を開いてヒント1を見ると、`大きいクラスは…` と `大きいファイルは…` が出て、`長いメソッドは…` は出ない
2. チュートリアル1(メソッドだけが長い)のヒント1は今どおり `長いメソッドは…` が出る
3. 減点の内訳の「こう困ります:」も同じ出し分けになっている
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 行数以外のルールの説明の見直し
- ヒントの段の構成の変更
