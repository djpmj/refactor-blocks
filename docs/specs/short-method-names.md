# 複数の処理を抽出するときの自動メソッド名を短くする

## 背景・目的

Extract Method で処理を選ぶと、新しいメソッドの名前を自動で考える(`src/domain/codebase/suggestMethodName.ts`)。
今は各処理の `suggestedName` を `And` でつなぐため、処理を3つ選ぶと
`buildTableHeaderAndBuildTableRowsAndPrint` のように長くなる(チュートリアル1で報告あり)。
長い名前はキャンバスで読みにくく、「良いメソッド名は中身をひと言で表す」という手本にもならない。
プレイヤーに名前を考えさせることはしない方針(自動で付ける)なので、**自動で付ける名前そのものを短く適切にする**。

一方、模範解答の抽出手順(`sampleAnswerSteps`)には、複数の処理をまとめたときの短い名前がすでに書かれている
(`validateItems`+`validateStock` → `validateOrder`、口座の3処理 → `debit` など)。これを最優先で使い、
模範解答に無い組み合わせは、ステージに書く「責務 → メソッド名」の表から付ける。

処理を1つだけ選んだときの名前・採点・抽出の操作は変えない。プレイヤーが名前を入力したときはそれを優先する(今どおり)。

## 振る舞い

`suggestMethodName(fragments, existingNames, naming)` は次の順で名前を決める。

1. 何も選んでいない → `''`(今どおり)
2. 処理が1つ → その処理の `suggestedName`、無ければ `extractedMethod`(今どおり)
3. 処理が2つ以上で、選んだ処理の ID の集合が模範解答のいずれかの抽出手順の `fragmentIds` の集合と**一致する**(順序は問わない) → その手順の `name`
4. 処理が2つ以上で、3に当たらない → 選んだ処理のうち `responsibility: 'call'` を除いたものを責務ごとにまとめ、`lines` の合計がいちばん多い責務を選ぶ
   (同じなら、選んだ中で先に出てくる処理の責務)。その責務が `naming.byResponsibility` にあれば、その名前
5. 4で名前が決まらない(表に無い責務・`call` だけ・表が空)→ 今の組み合わせ方(動詞が同じなら `validateItemsAndStock`、違えば `And` でつなぐ)
6. どの場合も、同じクラスの既存メソッド名と重なるときは末尾に `2`・`3` …を付ける(今どおり)

例(チュートリアル1「長いメソッドを分ける」):

| 選んだ処理 | 決まり方 | 名前 |
| --- | --- | --- |
| 今月の売上を集計する + 前月比を計算する | 模範解答と一致 | `aggregateSales` |
| 表のヘッダー(formatting 2行)+ 表の行(formatting 3行)+ 画面に出力する(output 9行) | 表の `output` | `printReport` |
| 表のヘッダー + 表の行 | 表の `formatting` | `buildTable` |
| 画面に出力する だけ | 1つなので `suggestedName` | `print` |

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/suggestMethodName.ts` + `.test.ts` | domain | 変更 | 3番目の引数 `naming: MethodNaming` を足し、上の規則で名前を決める(TDD) |
| `src/domain/stage/methodNaming.ts` + `.test.ts` | domain | 新規 | `methodNamingOf(stage, steps = sampleAnswerSteps)`: ステージの模範解答の抽出手順と `methodNames` から `MethodNaming` を作る(TDD) |
| `src/domain/stage/Stage.ts` | domain | 変更 | `Stage` に `methodNames?: Readonly<Record<string, string>>`(責務 → メソッド名)を足す |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | `suggestMethodName` に `methodNamingOf(stage)` を渡す(`useMemo` で、ステージが変わったときだけ作り直す) |
| `src/infrastructure/stages/*.ts`(ステージ定義) | infrastructure | 変更 | ステージカタログの**全ステージ**に `methodNames` を書く(下記) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | `methodNames` の検証(下記) |
| `e2e/`(抽出を扱う既存のspec、またはチュートリアル1のspec) | E2E | 変更 | 3つ選ぶと短い名前が入る(下記)。既存E2Eで長い自動名を前提にしているものは新しい名前に直す |

ステージは TypeScript で書いたカタログで、外部から読み込む経路(`Stage` の型ガード)は無いので、読み込み時の検証は足さない。

### `methodNames` の書き方(`infrastructure`)

- そのステージの Fragment に出てくる責務(`call` を除く)を**すべて**覆う
- 名前は lowerCamelCase の英語で、動詞から始め、その責務の処理をまとめたメソッドとして自然な短い名前にする(目安: 3語以内。例 `printReport`・`buildTable`・`validateOrder`)
- 模範解答の抽出手順に、その責務だけをまとめた名前があればそれに合わせる(例: チュートリアル2の `validation` → `validateOrder`)
- 白紙設計モード・設計くらべクイズの `Stage` には書かなくてよい(無ければ5の規則で今どおり)

## データ・型の変更

`src/domain/codebase/suggestMethodName.ts`:

```ts
export type MethodNaming = {
  /** 模範解答の抽出手順の、処理IDの組と名前。 */
  readonly groups: readonly { readonly fragmentIds: readonly string[]; readonly name: string }[];
  /** 責務 → メソッド名。 */
  readonly byResponsibility: Readonly<Record<string, string>>;
};

export const NO_METHOD_NAMING: MethodNaming = { groups: [], byResponsibility: {} };

export function suggestMethodName(
  fragments: readonly Fragment[],
  existingNames: readonly string[],
  naming: MethodNaming = NO_METHOD_NAMING,
): string;
```

`src/domain/stage/methodNaming.ts`:

```ts
export function methodNamingOf(
  stage: Pick<Stage, 'id' | 'methodNames'>,
  steps: Partial<Record<string, readonly SolutionStep[]>> = sampleAnswerSteps,
): MethodNaming;
```

- `groups` は、そのステージの模範解答のうち `extract` の手順で `fragmentIds` が2つ以上のものだけ
- 模範解答が無いステージ・`methodNames` が無いステージでも例外を投げず、空の `groups` / `{}` を返す

## TDD対象の純粋関数

### `suggestMethodName`(既存のテストは引数を足さずにそのまま通ること)

1. 処理が1つなら、`naming` に一致する組や表があっても `suggestedName` をそのまま使う
2. 処理が2つ以上で、ID の集合が `groups` の組と一致 → その名前(選んだ順が違っても一致する)
3. `groups` の組と一部だけ重なる(多い・少ない)ときは一致とみなさない
4. 一致しなければ、`lines` の合計が最大の責務の `byResponsibility` の名前
5. 行数が同じ責務が並んだら、選んだ中で先に出てくる処理の責務
6. `call` の処理は責務の集計から除く。`call` だけを選んだら5の規則(今の組み合わせ方)
7. 責務が表に無い → 今の組み合わせ方(`validateItemsAndStock` / `saveOrderAndSendConfirmationMail`)
8. 決まった名前が既存メソッドと重なる → `2`・`3` …が付く

### `methodNamingOf`

1. 模範解答の `extract` で `fragmentIds` が2つ以上の手順だけが `groups` に入る(1つの手順・`move` などは入らない)
2. `byResponsibility` はステージの `methodNames` をそのまま返す
3. 模範解答が無いステージ・`methodNames` が無いステージでは、空の `groups` と `{}`

### ステージカタログ(`stageCatalog.test.ts`)

1. 全ステージに `methodNames` があり、そのステージの Fragment の責務(`call` を除く)をすべて覆う
2. `methodNames` の名前はすべて lowerCamelCase(`/^[a-z][a-zA-Z0-9]*$/`)
3. チュートリアル1で `frag-table-header`・`frag-table-rows`・`frag-print` を渡すと `printReport` になる
   (`suggestMethodName(..., methodNamingOf(stage))`。上の例の表どおり)

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- チュートリアル1で「表のヘッダーを組み立てる」「表の行を組み立てる」「画面に出力する」を選ぶと、名前欄に `printReport` が入る(`And` でつないだ長い名前にならない)
- チュートリアル1で「今月の売上を集計する」「前月比を計算する」を選ぶと `aggregateSales`、チュートリアル2で検証の2処理を選ぶと `validateOrder` になる
- 処理を1つだけ選んだときの名前は今と変わらない
- 名前欄を書き換えたら、その名前で抽出される(今どおり)
- 採点・模範解答の再生・既存ステージの点数が変わらない

E2E: チュートリアル1で3つの処理(ヘッダー・行・出力)のチェックを入れ、名前欄の値が `printReport` であること、
抽出後にキャンバスに `printReport()` のメソッドが出ることを確かめる。

## スコープ外

- AI による命名
- プレイヤーが付けた名前の採点・命名の良し悪しの講評
- 処理を1つ選んだときの名前(`suggestedName`)の見直し
- 抽出済みのメソッドの名前を、後から選び直した中身に合わせて付け直すこと
- 白紙設計モード・設計くらべクイズの問題への `methodNames` の追加
