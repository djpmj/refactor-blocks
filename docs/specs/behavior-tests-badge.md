# 振る舞いを守るテストを見せる(リファクタリングのなぜ)

## 背景・目的

このゲームは「分け方」を練習するが、**リファクタリングの定義(振る舞いを変えずに、構造だけを変える)**と、
**なぜリファクタリングの前にテストが要るのか**を伝える場所が無い。プレイヤーは、ブロックを動かしても「動作が壊れていない」ことを
確かめる手段を持たず、実務で「テストが無いコードは怖くて触れない」ことにも結びつかない。

ゲームの操作(抽出・移動・統合・インライン化)は、もともと振る舞いを変えないように作られている(処理は消えずに場所が変わるだけ。
本物の処理の削除は `delete-class-code-guard` で防いでいる)。これを**テストの形で見せる**。

- ステージの入口になるメソッド(他から呼ばれていない、初期コードのメソッド)ごとに「振る舞いのテスト」を1本ずつ用意したことにする
- テストは「その入口から呼び出しをたどって実行される処理の集まり」が、初期コードと同じかどうかを調べる
- 抽出・移動・統合をしてもテストは**緑のまま**。「構造は変わったが振る舞いは変わっていない」ことが見える
- 呼べないメソッドを呼ぶようになった(可視性の越境)ときは、テストは**赤(コンパイルエラー)**になり、どこが壊れたかを示す

ヘッダーにテストの状態のバッジを出し、開くとテストの一覧と説明を見せる。採点・点数は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/testing/behaviorTests.ts` + `.test.ts` | domain | 新規 | `behaviorTests(stage)` と `runBehaviorTests(stage, codebase)`(TDD、下記) |
| `src/presentation/stage/TestStatus.tsx` | presentation | 新規 | ヘッダーのバッジと、開いたときのテスト一覧(下記) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | ヘッダーの `ScoreBadge` の隣に `TestStatus` を置く |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 全ステージの模範解答で、どの手の後もテストが全部緑(下記) |
| `src/index.css` | presentation | 変更 | `.test-status` のスタイル |
| `e2e/behavior-tests.spec.ts` | E2E | 新規 | 抽出・移動してもテストが緑のまま。開くと一覧と説明が出る(下記) |

新しい層 `src/domain/testing/` はドメインの中のサブディレクトリ(`domain/scoring/` と同じ扱い)。`application` 層の変更は無い。

## 見た目・内容の仕様

### バッジ(`TestStatus`)

- ヘッダーのスコアバッジの隣に、`<details>` で置く。サマリは `🧪 テスト 4/4 ✓`(全部緑)または `🧪 テスト 3/4 ✗`(赤がある)
  - 色だけに頼らず、`✓` / `✗` と数で状態を出す。`aria-live="polite"`(スコアバッジと同じ)
- 対象のコードは、採点と同じく `changeSession?.base ?? codebase`(変更依頼の実装中は、挑戦前のコード)
- テストが1本も無いステージ(入口のメソッドが無い)では、バッジを出さない

### 開いたときの中身

1. 説明(常に出す、2文):
   「リファクタリングは、振る舞いを変えずに構造だけを変えることです。テストが緑のままなら、分け方を変えても動作を壊していない証拠になります」
2. テストの一覧(入口ごとに1行): `✓ UserController.register の振る舞い(処理 6 個)`
   - 赤のテストは、その下に理由を出す:
     - `missing`: 「実行されなくなった処理: <ラベル>、…」(処理が入口から呼ばれなくなった)
     - `added`: 「新たに実行されるようになった処理: <ラベル>、…」
     - `compile`: 「コンパイルエラー: <呼び出し元クラス> から <クラス>.<メソッド> は呼べません(private)」
     - `entry-missing`: 「テストが呼んでいるメソッドが見つかりません」
3. 一覧の名前(`クラス名.メソッド名`)は、**今のコード**での名前と所属で出す(入口のメソッドIDを追う。名前を変えた・移したら、その新しい名前で出す)

### いつ赤くなるか(プレイヤーから見た挙動)

- 抽出・移動・統合・インライン化・名前の変更・クラスやファイルの追加/移動・継承の設定 → **緑のまま**(振る舞いを変えない操作)
- 可視性の採点があるステージ(`visibilityEnforced: true`)で、操作によって**新しく**別クラスから private メソッドを呼ぶ形になった → **赤**(`compile`)。初期コードにもともとある越境(中級3の題材)は赤にしない
- 上記以外の理由で赤になることは、通常の操作では起きない想定。起きた場合はバグとして扱う(全ステージの模範解答で確かめる。下記)

## データ・型の変更

```ts
// src/domain/testing/behaviorTests.ts
export type BehaviorTest = {
  /** 入口のメソッドID(初期コードで、どの Fragment の uses からも参照されていない、空でないメソッド)。 */
  readonly entryMethodId: string;
  /** 初期コードで、入口から呼び出しをたどって実行される処理の「振る舞いの鍵」の集合(下記)。 */
  readonly expected: ReadonlySet<string>;
};

export type TestFailure =
  | { readonly kind: 'entry-missing' }
  | { readonly kind: 'missing'; readonly keys: readonly string[] }
  | { readonly kind: 'added'; readonly keys: readonly string[] }
  | { readonly kind: 'compile'; readonly violations: readonly VisibilityViolation[] };

export type TestResult = { readonly test: BehaviorTest; readonly failures: readonly TestFailure[] }; // failures が空なら緑

/** ステージの初期コードからテストを作る。入口が無ければ空。 */
export function behaviorTests(stage: Pick<Stage, 'codebase'>): readonly BehaviorTest[];

/** 今のコードでテストを実行する。 */
export function runBehaviorTests(stage: Pick<Stage, 'codebase' | 'visibilityEnforced'>, codebase: Codebase): readonly TestResult[];
```

**実行される処理のたどり方**(`reachableBehavior(codebase, methodId)`。非公開のヘルパー):

- メソッドの各 Fragment を集める。Fragment の `uses` のメソッドIDへ再帰的にたどる(訪問済みで止め、輪になっても無限ループしない)
- `uses` の先が無いID・`fragments: []` の契約メソッドなら、そこで止まる(インターフェース越しの呼び出しは、このゲームでは実装へ届かない。初期と同じ扱いになるので比較に影響しない)
- `responsibility === 'call'` の呼び出し行(抽出で入るもの)と、`stub: true` の空実装は、**振る舞いの鍵に含めない**(呼び出し行は構造、空実装は振る舞いを持たない)
- **振る舞いの鍵** = `${fragment.responsibility}|${fragment.label}`。Fragment の ID ではなく鍵で比べる。統合(`mergeMethods`)は2つの重複した処理を新しいIDの1つにまとめるが、
  同じラベル・責務を持つので鍵は変わらない。**実装時に `mergeMethods` が統合後のラベル・責務をどちらかの元と同じにしていることを確かめる**。違っていたら、
  鍵の作り方をこの仕様の意図(「統合しても振る舞いは同じ」)に合うよう直し、PR の説明に書く

**`compile` の判定**: `stage.visibilityEnforced === true` のときだけ、`countedVisibilityViolations(codebase, true)` のうち、
次の両方を満たすものをそのテストの失敗にする。

- **初期コードに無かった違反**(`methodId` と `callerClassId` の組が、`countedVisibilityViolations(stage.codebase, true)` に無い)。
  中級3のように、初期コードの違反そのものがステージの題材(「越境する private」)になっているため、それは赤にしない。プレイヤーの操作で**新しく**生まれた越境だけを赤にする
- **呼び出しの経路が入口から届く**(違反の `methodId` が `reachableBehavior` のたどった先に含まれる)

`visibilityEnforced` が無いステージでは `compile` は出さない(そのステージの採点・模範解答が可視性を前提にしていないため)。

`// ponytail: 「振る舞い」は実行される処理の集合で近似する。実行順・回数・引数は見ない。順序を入れ替えるような操作を足すときに、順序も比べるようにする`

## TDD対象の純粋関数

### `behaviorTests`

1. どこからも呼ばれていない、処理を持つメソッドが入口になる。他のメソッドの `uses` に含まれるメソッドは入口にならない
2. `fragments: []` のメソッド(契約)は入口にならない
3. 入口ごとの `expected` は、呼び出しをたどった処理の鍵の集合(`call` と `stub` を除く)
4. 呼び出しが輪になっていても止まる

### `runBehaviorTests`

1. 初期コードそのものでは、全テストが緑
2. 入口のメソッドから処理を Extract Method したコードでは緑(呼び出し行は鍵に含めず、抽出先の処理はたどれる)
3. 抽出したメソッドを別クラスへ Move Method したコードでも緑
4. 重複メソッドを `mergeMethods` で統合したコードでも緑
5. 入口のメソッドの名前を変えても緑(IDで追う)
6. 入口から届いていた処理を持つメソッドを、入口から届かないように付け替えたコード(テストで組み立てる)では `missing` で赤
7. `visibilityEnforced: true` のステージで、初期コードに無かった「入口から届く private メソッドを別クラスから呼ぶ」形を作ったコードでは `compile` で赤。`visibilityEnforced` が無ければ同じコードでも緑
7a. 初期コードにもともとある可視性の違反(中級3の題材)は、`compile` にしない(初期コードは緑)
8. 入口のメソッドが消えたコード(テストで組み立てる)では `entry-missing` で赤

### ステージカタログ(`stageCatalog.test.ts`)

全ステージの模範解答について、**先頭から各手を適用した後(1手目の後〜最後まで)**、`runBehaviorTests` が全部緑であること。
(模範解答はゲームの正しい遊び方なので、ここで赤が出るなら、たどり方か鍵の作り方のバグ。)
入口が1つ以上あるステージが全体の大半であることも確かめる(入口が0のステージは、その理由をテストのコメントに書く)。

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- ステージを開くと、ヘッダーに `🧪 テスト N/N ✓` が出る
- 抽出・移動・統合をしても、`✓` のまま。開くと、説明と入口ごとのテスト(処理の数つき)が出る
- 入口のメソッドの名前を変えると、一覧の名前も変わり、緑のまま
- 中級3・中級7(`visibilityEnforced`)の初期状態は `✓`(題材の越境は赤にしない)
- 中級7で、外から呼ばれているメソッドを private にする(新しい越境を作る)と `✗` になり、「コンパイルエラー: …」が出る。public に戻すと `✓` に戻る
- 全ステージの模範解答のどの手の後も、テストが全部緑(`stageCatalog.test.ts`)
- 変更依頼の実装中は、挑戦前のコードでテストする(部品置き場の部品でテストが変わらない)
- 採点・点数・既存のヘッダーの表示が変わらない

## スコープ外

- 実行順・回数・引数まで含めた振る舞いの比較
- プレイヤーがテストを書く・選ぶ・消す操作
- テストを赤くする「わざと壊す」操作・モード(壊してみる案で扱う)
- テストの書きやすさ(モックの数)の表示
- インターフェース越しの呼び出しを実装までたどること
- 変更依頼(振る舞いを変える変更)とテストの関係を見せること(依頼の実装でテストを足す、など)
- 白紙設計モード・設計くらべクイズへの適用
