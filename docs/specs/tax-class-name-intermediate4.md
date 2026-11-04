# tax-class-name-intermediate4: 中級4で税のメソッドを新しいクラスへ移すと `CopyTaxCalculator` という名前が付く

## 症状

中級4「変わるのは税の計算」(`intermediate-volatile-tax`)で、税のメソッド(`calculateMonthlyTax` など)を抽出して新しいクラスへ移すと、
自動で付くクラス名が `CopyTaxCalculator` になる。右クリックメニューの移動先・キャンバスのクラスノードにもこの名前がそのまま出る。
中級4はコピペの話ではないので、「Copy」が付いた名前は題材と合わず、プレイヤーを混乱させる。

## 原因

`src/infrastructure/stages/intermediateStages.ts` の中級4(`volatileTaxStage`、520行付近)の `classNames.tax` が `"CopyTaxCalculator"` になっている。
これは中級9(`copyPasteTaxStage`、1195行付近)の値を流用したもの。新しいクラスの名前は `autoNameClasses(codebase, stage.classNames)`
(`src/domain/codebase/autoNameClasses.ts`、呼び出し元は `src/presentation/store/useGameStore.ts` の2か所)が `classNames` から引くだけなので、
直す場所はステージ定義の1行で済む。domain・presentation のロジックに不具合は無い。

中級9の `"CopyTaxCalculator"` は意図的なので触らない。中級9の初期コードには空の `TaxCalculator` クラス(`src/sales/TaxCalculator.ts`)がすでにあり、
`stageCatalog.test.ts` の `classNameFailures` が「`classNames` の値に初期のクラス名を使わない」ことを強制しているため、`TaxCalculator` は使えない
(チュートリアル2の `OrderTaxCalculator` も同じ理由)。

## 修正

- `src/infrastructure/stages/intermediateStages.ts`(infrastructure): 中級4の `classNames.tax` を `"CopyTaxCalculator"` から `"TaxCalculator"` に変える。
  - 中級5(`volatileFormatStage`)の `classNames.tax` と同じ値。中級4・中級5の初期コード(`salesReportCodebase`)に `TaxCalculator` クラスは無いので、`classNameFailures` に引っかからない。
  - 中級4の解答例(`src/domain/stage/sampleAnswer.ts` の `addClass: { name: 'TaxCalculator' }`)・比較クイズの文言(`src/infrastructure/quizzes/comparisonQuizzes.ts` の「税の計算を TaxCalculator に分けた設計」)とも一致する。新しい名前を考える必要は無い。

### 名前の参照箇所(grep 結果)と影響

| 場所 | 参照 | 影響 |
| --- | --- | --- |
| `src/infrastructure/stages/intermediateStages.ts` 520行 | 中級4 `classNames.tax` | **変更する** |
| `src/infrastructure/stages/intermediateStages.ts` 1195行 | 中級9 `classNames.tax` | 変更しない(上記の理由) |
| `src/domain/stage/sampleAnswer.ts` 308〜313行 | 中級4の解答例。`addClass` で `TaxCalculator` を明示的に作る(自動命名を通らない) | 変更なし。解答再生の結果も変わらない |
| `src/infrastructure/stages/volatilityStages.test.ts` | 中級4・5の解答例・採点 | 変更なし。新しいテストをここに足す |
| `src/infrastructure/stages/stageCatalog.test.ts` | `classNameFailures`(初期のクラス名と重ならない)・`responsibilityNameFailures`(日本語名が `classNames` の値と重ならない)・`rumorViolations`(噂の文に `classNames` の値を含めない) | 変更なし。新しい値で全部通る(中級4の噂の文・`responsibilityNames` に `TaxCalculator` は出てこない) |
| `src/infrastructure/quizzes/comparisonQuizzes.ts` | 中級4の解答例を「TaxCalculator に分けた設計」として使う | 変更なし |
| `src/infrastructure/stages/runtime/intermediate-volatile-tax.ts` | C# 実行用。クラス名を参照していない | 変更なし |
| `e2e/` | 中級4は `reference-menu.spec.ts` の zip ダウンロードだけ。`CopyTaxCalculator` も中級4での `class-TaxCalculator` も参照していない | 変更なし |
| `docs/specs/` | `CopyTaxCalculator` への言及なし。中級4のクラス名を扱う既存の仕様書も無い(重複なし) | 変更なし |

## テスト

- 先に書く失敗するテスト(Vitest、`src/infrastructure/stages/volatilityStages.test.ts` の `describe('中級4・中級5…')` に追加):
  - `中級4: 税のメソッドだけを持つ新しいクラスには、自動で TaxCalculator という名前が付く`
    - Arrange: `sampleAnswerCodebase(taxStage)` の `TaxCalculator` クラスを `mapClasses` で `{ name: 'NewClass', autoNamed: true }` に書き換える(プレイヤーが新しいクラスへ税のメソッドを移した状態)
    - Act: `autoNameClasses(codebase, taxStage.classNames)`
    - Assert: `allClasses(named).map((c) => c.name)` に `'TaxCalculator'` が含まれ、`'CopyTaxCalculator'` が含まれない
  - 修正前は `CopyTaxCalculator` になるので赤、`classNames.tax` を直すと緑になる
- 中級9の名前を守るテストは足さない(`classNameFailures` が `TaxCalculator` への変更を既に防いでいる)

## 受け入れ基準

1. 中級4で税の計算を抽出し、新しいクラスへ移すと、キャンバスと右クリックメニューの移動先に `TaxCalculator` と出る(`CopyTaxCalculator` は出ない)
2. 中級9で税の計算を新しいクラスへ移したときの名前は、今どおり `CopyTaxCalculator`(初期の `TaxCalculator` と重ならない)
3. 上の新しいテストが修正前に赤、修正後に緑になる
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 中級9の `classNames.tax`(`CopyTaxCalculator`)の改名。初期クラスと重ならない別の名前(例: `SharedTaxCalculator`)にするかは、中級9で実機の違和感が報告されてから別件で扱う
- ほかのステージの `classNames` の総点検(今回の報告は中級4だけ。「別ステージの値の流用」を検出するテストは、同じ不具合が2件目に出たら考える)
- E2E の追加。表示はステージ定義の値をそのまま出すだけで、ドラッグ操作やUIの変更は無い。Vitest の自動命名テストで足りる
