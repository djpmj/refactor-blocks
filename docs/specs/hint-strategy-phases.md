# hint-strategy-phases: ヒント「次の一手」を、方針(なぜその手順か)のまとまりごとに見せる

## 背景・目的

2026-10-17 に上級8「取り込みの手順を Template Method にまとめる」でヒント2「次の一手」を開くと、**20手の操作手順**が1手ずつ出てきた。

```
CsvOrderImporter の importOrders から「ファイルを開いて1行ずつ読み込む」をExtract Methodで取り出し、readLines という名前にしよう
CsvOrderImporter の importOrders から「必須項目と金額を検証する」をExtract Methodで取り出し、validateOrders という名前にしよう
…(同じ形の文が8手続く)
CsvOrderImporter の readLines と JsonOrderImporter の readLines は同じ処理なので、Merge Methodsで readLines という名前に統合しよう
…
```

手順は正しいが、**「なぜそうするのか」(共通の手順を親クラスに集め、違う部分だけを子クラスに残す、という Template Method の考え方)がどこにも無い**。
1手ずつ押していくと操作はできるが、方針が分からないまま手を動かすことになり、別の場面で同じ設計を自分で組み立てられない。
中級10(14手)など、手数の多いステージでも同じ。

ヒントは模範解答の手順(`sampleAnswerSteps`)を `describeSolutionStep` で文にして、先頭から順に見せている(`useHints`)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/stage/solutionPhases.ts` | domain | 方針の型と、手順の番号から方針を引く関数 |
| 新規 | `src/domain/stage/solutionPhases.test.ts` | domain | 上のテスト |
| 新規 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | ステージごとの方針の表(題・理由・何手目から) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 模範解答が8手以上のステージには方針の表があること、方針の開始位置が手順の範囲内で昇順であることを確かめる |
| 変更 | `src/presentation/stage/useHints.ts` | presentation | 見せる手順に、属する方針を添える |
| 変更 | `src/presentation/stage/HintList.tsx` | presentation | 方針が変わる手順の前に、方針の題と理由を見出しとして出す |
| 変更 | ヒントの E2E | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

```ts
/** 模範解答の手順のまとまり。from は、このまとまりが始まる手順の番号(0始まり)。 */
export type SolutionPhase = { readonly title: string; readonly why: string; readonly from: number };
export function phaseOfStep(phases: readonly SolutionPhase[], stepIndex: number): SolutionPhase | undefined;
```

- 表は `Record<stageId, readonly SolutionPhase[]>`。模範解答の手順(`sampleAnswer.ts`)は変えない
- 8手未満のステージは表が無くてもよい(今どおり手順だけ)

上級8の方針の例:

| from | title | why |
| --- | --- | --- |
| 0 | 2つの取り込みを、同じ部品に分ける | どこが共通で、どこが違うのかを見えるようにするため。違うのは「変換」だけです |
| 8 | 共通の部品を1つにまとめる | 同じ処理が2か所にあると、検証ルールを変えるたびに両方を直すことになるため |
| 11 | 親クラスに流れを持たせ、違う部分を子に任せる(Template Method) | 取り込みの流れは親が1か所で持ち、形式ごとに違う「変換」だけを子が上書きすれば、新しい形式は子を足すだけで済むため |

(番号は実際の模範解答の手順に合わせて、実装時に確かめる)

## 表示の仕様

- 「次の一手」を押して出した手順が、方針の最初の手順なら、その前に見出し `方針: <title>` と理由(`why`)を出す
- 方針の見出しは、その方針の手順を1つでも出したら出す(まだ出していない方針の見出しは出さない。先回りしてネタバレしない)
- 「次の一手(8/20)」の数え方は今どおり手順の数

## TDD対象の純粋関数

### `phaseOfStep`(`domain/stage/solutionPhases.ts`)

- 方針 `[{from: 0}, {from: 8}, {from: 11}]` で手順 0 → 1つ目、7 → 1つ目、8 → 2つ目、19 → 3つ目
- 方針が空 → `undefined`

### `stageCatalog.test.ts`(infrastructure)

- 模範解答が8手以上の全ステージに方針の表がある
- 各表の `from` は 0 から始まり、昇順で、手順の数より小さい

## 受け入れ基準

1. 上級8でヒント2を1回押すと、`方針: 2つの取り込みを、同じ部品に分ける` と理由が出て、その下に1手目が出る
2. 9回押すと、2つ目の方針の見出しが出る。3つ目の方針の見出しはまだ出ていない
3. 手数の少ないステージ(チュートリアル1など)は今どおり
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 模範解答の手順そのものの見直し
- 「動きで見る」(ゴースト)への方針の表示
