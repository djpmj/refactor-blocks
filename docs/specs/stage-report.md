# ステージの一覧表(難易度のバランスと注意点の自動生成)

## 背景・目的

ステージは20を超え、このあとも増える(#62・#63・#72 など)。正しさ(模範解答で100点・初期は減点あり・ID重複なし・依頼の整合)は
`src/infrastructure/stages/stageCatalog.test.ts` がすでに**合否**で守っている。足りないのは、**全ステージを横に並べて見渡す手段**。

- 初級なのに模範解答の手数が多すぎないか、中級より上級のほうが簡単になっていないか
- 初期点が高すぎて(すぐ100点に近い)手応えが無いステージはないか
- どのステージがどの操作(抽出・移動・統合・継承…)を練習させているか、偏りは無いか

これを人が20ステージぶん確かめるのは限界がある。そこで、全ステージの数字を**1枚の Markdown の表**にまとめて `docs/stages/report.md` に自動生成し、
目安から外れたものに**注意**を付ける。表はリポジトリに置き、ステージ定義を変えたのに表を更新し忘れたら `npm test` が落ちるようにする。

合否のテストは増やさない(`stageCatalog.test.ts` の役割)。注意は**落とさない**目安として出すだけ。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/infrastructure/stages/stageReport.ts` | infrastructure | 新規 | `stageReportRows(stages)`(各ステージの数字と注意)と `renderStageReport(rows)`(Markdown の表)。下記 |
| `src/infrastructure/stages/stageReport.test.ts` | infrastructure | 新規 | 行の計算の単体テストと、`docs/stages/report.md` とのファイルスナップショット比較(下記) |
| `docs/stages/report.md` | — | 新規(生成物) | 生成された一覧表。手で編集しない(先頭に注記) |
| `package.json` | — | 変更 | `"stage-report": "vitest run src/infrastructure/stages/stageReport.test.ts -u"` を足す |
| `docs/specs/README.md` または `CLAUDE.md` の「コマンド」 | — | 変更 | `npm run stage-report` の1行を足す |

新しい依存は足さない。Vitest の `toMatchFileSnapshot` で、表の生成と「更新し忘れ」の検出を兼ねる
(`npm test` では表が古いと落ち、`npm run stage-report` で書き直す)。

`stageReport.ts` は `domain`(採点・模範解答・行数)と `infrastructure/stages` の `stages` を使う。ステージ定義の付属物なので `infrastructure/stages/` に置く。

## 表の中身

### 1行 = 1ステージ(`stages` の並び順)

| 列 | 中身 | 出どころ |
| --- | --- | --- |
| ステージ | `stage.title` | |
| レベル | `チュートリアル` / `初級` / `中級` / `上級` | `stage.level` |
| 初期点 | 初期コードの点数 | `scoreCodebase(stage.codebase, stage).total` |
| 主な減点 | 初期の減点のうち点数の大きい順に3つまで(`行数 -20` のように) | `deductions` と `RULE_LABEL` |
| 手数 | 模範解答の手順の数 | `sampleAnswerSteps[stage.id].length`(無ければ `-`) |
| 使う操作 | 模範解答で使う操作の種類(`抽出`・`移動`・`統合`・`フィールド移動`・`可視性`・`継承`・`実装`・`クラス追加`・`ファイル追加`・`削除`・`名前変更` など)を、重複なく出てくる順に | `SolutionStep` のキー |
| 規模 | `3ファイル / 5クラス / 9メソッド` | 初期コード |
| 最長メソッド | 初期コードで一番長いメソッドの行数 | `methodLines` |
| 依頼 | `ルール変更 2 / 機能追加 1` | `changeRequests` と `changeKindOf` |
| 注意 | 下記の目安から外れたものを `、` 区切りで。無ければ空 | |

`RULE_LABEL` は presentation 層にあるが、表は人が読む開発用の資料なので import してよい(`stageReport.ts` は画面からは使わない)。
これが lint の層の制約に引っかかる場合は、ルールのキー(`line-limit` など)をそのまま出す。

### 注意の目安(落とさない)

`stageReport.ts` に定数として置き、`// ponytail: 目安は感覚で決めた初期値。プレイの感想や意見が集まったら見直す` を付ける。

| 注意の文言 | 条件 |
| --- | --- |
| `初期点が高い` | 初期点が 80 以上 |
| `手数が多い` | 手数が、チュートリアル 3・初級 8・中級 15・上級 25 を超える |
| `レベルの中央値の手数が前のレベルより少ない` | レベルごとの手数の**中央値**が、1つ前のレベルの中央値より小さいとき、そのレベルの**先頭のステージにだけ**付ける(ステージ単位で比べると、易しい中級が1つあるだけで注意だらけになるため) |
| `解答が未登録` | `sampleAnswerSteps[stage.id]` が無い |
| `依頼が機能追加だけ` | `changeRequests` に `modify` が1件も無い |

### 表の外側

- 先頭に `<!-- このファイルは npm run stage-report で生成する。手で編集しない -->` と、見出し `# ステージ一覧表`
- 表の下に、レベルごとの集計(ステージ数・手数の中央値・初期点の平均)を小さな表で出す
- 生成日時は**入れない**(入れるとスナップショットが毎回変わってしまう)

## データ・型の変更

```ts
// src/infrastructure/stages/stageReport.ts
export type StageReportRow = {
  readonly stageId: string;
  readonly title: string;
  readonly level: StageLevel;
  readonly initialScore: number;
  readonly topDeductions: readonly string[];
  readonly steps: number | undefined;
  readonly operations: readonly string[];
  readonly files: number;
  readonly classes: number;
  readonly methods: number;
  readonly longestMethodLines: number;
  readonly modifyRequests: number;
  readonly extendRequests: number;
  readonly warnings: readonly string[];
};

export function stageReportRows(
  stages: readonly Stage[],
  solutions?: Partial<Record<string, readonly SolutionStep[]>>, // 省略時は sampleAnswerSteps。テストで差し替える
): readonly StageReportRow[];

export function renderStageReport(rows: readonly StageReportRow[]): string;
```

## TDD対象の純粋関数

`stageReport.ts` は infrastructure 層だが、純粋関数なのでテストを先に書く(テスト用の小さなステージを `stageReport.test.ts` の中で組み立てる)。

### `stageReportRows`

1. 初期点・規模(ファイル・クラス・メソッドの数)・最長メソッドの行数が、ステージの初期コードから計算される
2. 主な減点は、点数の大きい順に最大3つ
3. 手数と使う操作は、渡した手順から出る。操作は重複なく、出てくる順
4. 手順が無いステージは `steps: undefined` で、`解答が未登録` の注意が付く
5. 初期点 80 以上で `初期点が高い` が付く。79 では付かない
6. 手数の上限をレベルごとに判定する(初級で9手なら `手数が多い`、8手なら付かない)
7. レベルの中央値が前のレベルより小さいとき、そのレベルの先頭のステージにだけ注意が付く
8. `modify` が0件なら `依頼が機能追加だけ`

### `renderStageReport`

1. 先頭に生成の注記と見出しがある
2. 行の数 = ステージの数。列の順が上の表のとおり
3. Markdown の表として壊れない(セル内の `|` はエスケープする)
4. 生成日時など、実行するたびに変わる内容を含まない

### ファイルスナップショット

`expect(renderStageReport(stageReportRows(stages))).toMatchFileSnapshot('../../../docs/stages/report.md')`。
ステージ定義を変えて表が変わったのに更新していなければ、`npm test` が落ちる。`npm run stage-report` で書き直してコミットする。

## 受け入れ基準

- `npm run check` が通る
- `npm run stage-report` で `docs/stages/report.md` が生成・更新される
- 生成した表に、全ステージが `stages` の順に並び、上の列がすべてある
- ステージ定義の数字(例: ある Fragment の `lines`)を変えて `npm test` を実行すると、ファイルスナップショットの比較で落ちる。`npm run stage-report` のあとは通る
- 目安から外れたステージに注意が出る(表の今の中身に注意があれば、それをPRの説明に一覧で書く。直すかどうかは別のIssueで判断する)
- `stageCatalog.test.ts` の既存の合否のテストは変えない

## スコープ外

- 注意で `npm test` を落とすこと(目安は合否ではない)
- 画面(アプリ内)への表示・ステージ一覧(#67)への反映
- プレイヤーの実データ(クリア率・所要時間)の集計
- 白紙設計の問題・設計くらべクイズの一覧
- 注意に引っかかったステージの修正
- CI で表を自動コミットすること
