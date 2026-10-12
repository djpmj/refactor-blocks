# cycle-count-display: 循環依存を「矢印の本数」ではなく「輪の組」で表示する

## 背景・目的

循環依存の採点は、循環している依存の矢印1本ごとに1件(-10点)と数えている(`dependencies.filter((d) => d.cyclic)`)。
中級1は `Order ⇄ Customer` の**1つの輪**だが、画面には次のように出る。

- クリア条件: `循環依存: 0件にする (今2件)`
- 減点の内訳: `循環依存 ×2`
- ヘッダー: `循環依存 -20`

プレイヤーは「輪が2つある?」と探してしまい、1つ直すと2件まとめて消えることにも戸惑う。

採点(矢印1本ごとに -10)は変えず(各ステージの点数のバランスを保つため)、**表示を「輪の組」にそろえる**。
クリア条件と内訳には、輪の数と、どのクラスがつながっているかを出す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/dependencies.ts` | domain | 循環している輪(クラスの組)を返す `findCycles` を足す |
| 変更 | `src/domain/codebase/dependencies.test.ts`(無ければ新規) | domain | `findCycles` のテスト |
| 変更 | `src/domain/stage/clearConditions.ts` | domain | `WorstMeasures` に循環の輪を足す |
| 変更 | `src/domain/stage/clearConditions.test.ts` | domain | 上のテスト |
| 変更 | `src/presentation/stage/describeCondition.ts` | presentation | 循環依存の条件の文を輪の組で書く |
| 変更 | `src/presentation/stage/describeCondition.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/stage/ScoreBreakdown.tsx` | presentation | 循環依存の行を `×2` ではなく輪の組で書く |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | ヘッダーの循環依存の減点に輪の数を添える |
| 変更 | 循環依存の文言を確かめている既存の E2E | E2E | 新しい文言に合わせる |

`application` / `infrastructure` は変更しない。採点(`scoreCodebase`・`fileDeductions`)は変更しない。

## データ・型の変更

```ts
// src/domain/codebase/dependencies.ts
/**
 * 循環している輪。依存のグラフの強連結成分のうち、2クラス以上のもの。
 * 各輪のクラスIDは、そのクラスが classDependencies に初めて出てくる順。輪どうしの並びは、先頭のクラスの出現順。
 */
export function findCycles(dependencies: readonly ClassDependency[]): readonly (readonly string[])[];

// src/domain/stage/clearConditions.ts
export type WorstMeasures = {
  // 既存のフィールドに加えて
  /** 循環している輪(findCycles の結果)。循環が無ければ undefined。 */
  readonly cycles?: readonly (readonly string[])[];
};
```

## 見た目・動きの仕様

文中のクラス名は今のコードから引く。輪が2クラスなら `Order ⇄ Customer`、3クラス以上なら `A → B → C → A` のように依存の向きに沿って書く。
向きをたどれないときは `A・B・C` とする。

### クリア条件(`describeCondition`)

- 目標: `循環依存: 輪を0組にする`(今の `0件にする` を置き換える)
- 未達成のときの今の値: `今: 1組(Order ⇄ Customer)`。2組以上なら `今: 2組(Order ⇄ Customer / A → B → C → A)`
- `clear-condition-badges`(#162)で目標と今の値が分かれている場合は、その形に合わせる(今の値の文をこの形にする)

### 減点の内訳(`ScoreBreakdown`)

- 循環依存の行を `循環依存 1組(矢印2本)` とする(今の `循環依存 ×2` を置き換える)。ほかのルールの行は今のまま
- 「なぜ?」の中身は今のまま

### ヘッダー(`describeScore`)

- `循環依存 -20` を `循環依存 1組 -20` とする

## TDD対象の純粋関数

### `findCycles`(`domain/codebase/dependencies.ts`)

- A→B、B→A → `[[A, B]]`
- A→B、B→C、C→A → `[[A, B, C]]`
- A→B、B→A、C→D、D→C → `[[A, B], [C, D]]`
- A→B だけ → 空
- A→B、B→A、B→C(C は輪の外) → `[[A, B]]`

### `worstMeasures`(`domain/stage/clearConditions.ts`)

- 循環があるコード → `cycles` に輪が入る
- 循環が無いコード → `cycles` は `undefined`

### `describeCondition`(`presentation/stage/describeCondition.ts`)

- 循環依存の達成 → `循環依存: 輪を0組にする`
- 未達成・2クラスの輪1組 → `今: 1組(Order ⇄ Customer)`
- 未達成・3クラスの輪 → `今: 1組(A → B → C → A)`

## 受け入れ基準

1. 中級1を開くと、クリア条件が `循環依存: 輪を0組にする` で、今の値が `1組(Order ⇄ Customer)` になっている
2. 減点の内訳が `循環依存 1組(矢印2本)`、ヘッダーが `循環依存 1組 -20` になっている
3. 点数は今と同じ(中級1の初期状態は 60点のまま)
4. 輪を解消すると、クリア条件が達成になり、内訳から循環依存の行が消える
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 循環依存の採点の変更(輪1組ごとに -10 にするなど)
- キャンバスの「循環」バッジ・矢印の見た目の変更
- `file-mark-reasons`(#161)の吹き出しの循環依存の書き方(矢印ごとの理由のまま)
