# 01 機能探索: ステージの採点の上限値(行数・依存先・責務・アクセス制御)を、ステージデータから一覧で見せる

- slug: `stage-rules-summary`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

## 背景・目的

ステージ(`src/domain/stage/Stage.ts`)は、採点に使う上限値を次の5つ+1つの項目で持っている。

| 項目 | 採点での使われ方 | リファクタリング画面での見え方 |
| --- | --- | --- |
| `limits.method` / `limits.class` / `limits.file` | 行数(`line-limit`) | 行数のバッジ(`N行`)が上限を超えると赤くなるだけ。**上限の数字そのものは出ない** |
| `dependencyLimit` | 結合度(`coupling`) | **どこにも出ない** |
| `responsibilityLimit` | 責務の混在(`responsibility`) | **どこにも出ない** |
| `visibilityEnforced` | アクセス制御(`visibility`)を採点するか | **どこにも出ない** |

プレイヤーがこれらの数字を知る手段は、手書きの `goal` の文だけである。ところが `goal` は題材の説明を兼ねた自由な文で、
上限の書き方がステージごとにばらばらで、**採点に使われている上限が書かれていないステージが多い**(`src/infrastructure/stages/*.ts` を読んで確認)。

- 依存先の上限が書かれていない: チュートリアル1・2、初級1・2、中級1・2、上級1〜4
  (例: 上級2は `dependencyLimit: 1`、上級3は `dependencyLimit: 3` で、どちらも「結合度」で減点されうるが、`goal` に数字が無い)
- 責務の上限が書かれていない: チュートリアル1・2、中級3・7・8、上級5・6
- クラス・ファイルの行数の上限: 多くのステージで書かれていない(上級7の `class: 65` のように、解き方を決める値でも一部だけ)
- アクセス制御を採点するステージ(中級3・中級7。`visibilityEnforced: true`)であることが、構造化された形では分からない

その結果、「結合度 -10」「責務の混在 -10」と出ても、**何本・何種類までなら良いのか**が分からず、プレイヤーは矢印の本数を
数えても答え合わせができない。対象プレイヤー(新卒〜4年目)にとって、「ルールの閾値を知ってから直す」は
lint(このリポジトリ自身も `eslint.config.js` で複雑度12・ネスト4段などを数字で決めている)と同じ、実務でも基本の動きである。

設計くらべクイズの問題文には、すでに「行数の上限: メソッド◯行・クラス◯行・ファイル◯行」を `limits` から組み立てて出している
(`src/presentation/quiz/ComparisonQuizView.tsx` 89行目)。リファクタリング画面だけが、この数字を手書きの文に頼っている。
ステージデータから自動で組み立てれば、今後追加されるステージ(`template-method-stage`・`inline-method-stage`・`utils-class-split-stage`)にも
何も書かずに同じ表示が付き、`goal` の書き忘れ・書き間違いに左右されなくなる。

ponytail の階段では「このリポジトリにもうあるか?」で止まる: 値はすべて `Stage` 型にあり、ラベルは `describeScore.ts` の `RULE_LABEL` に揃えられる。
新しい採点・ドメイン操作・状態・依存は要らない。

### 既存テーマとの重複確認

- `score-deduction-locations`(02完了): 減点が**出たあと**に、原因のクラス・メソッド名を採点表示の下に並べる。
  本件は減点の有無に関係なく、**そのステージの閾値**を最初から見せる。表示する情報が別で、補い合う関係
  (「結合度: OrderService」+「依存先は2クラスまで」がそろうと、何本減らせばよいかが分かる)
- `operation-guide`(02作成済み): 操作のやり方(右クリック・ダブルクリック・キーボード)の一覧。採点の閾値は扱わない → 重複しない
- `stage-reference-integrity`(02作成済み): 題材データのID参照切れの検査。上限値や `goal` の文は見ない → 重複しない
- `docs/specs/design-comparison-quiz.md`: クイズの問題文に行数の上限を出す仕様。リファクタリング画面には広げていない → 今回はその延長
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 20件に、リファクタリング画面で `dependencyLimit`・`responsibilityLimit` を
  見せることを主題にしたものは無い(`dependencyLimit`・`responsibilityLimit`・`上限…表示` で `docs/` と `src/presentation/` をgrep。
  `src/presentation/` で `dependencyLimit`/`responsibilityLimit` を参照している箇所は0件)
- 呼び出し元が列挙した20件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **新ステージ(デメテルの法則・Observer・Facade・継承より委譲など)**: 過去の探索と同じく、ステージ定義ファイル3つと `sampleAnswer.ts` が
  `template-method-stage`・`inline-method-stage`・`utils-class-split-stage` で埋まっている
- **行数のバッジを「N / 上限 行」にする**: 上限がキャンバス上で直接分かるが、`MethodChip.tsx`(`color-contrast-a11y`・`method-rename-keyboard`)・
  `ClassNode.tsx`(`class-dependency-focus`・`template-method-stage` が触る可能性)・`FileNode.tsx` の3つに差分が出る。本件の後回し候補にする
- **変更依頼の実装中、メソッドの中身(`InspectedMethod`)がホバーでしか出ない**: キーボードの穴だが、起点が `MethodChip.tsx` で、
  `method-rename-keyboard` が同じ `<button>` のキー操作を触る予定のため見送り(過去の `operation-guide` と同じ判断)
- **フィールドの可視性の変更・Rename Field**: `docs/specs/fields-and-feature-envy.md`・`cohesion-value-object-anemic.md` が意図して作らないと決めている。題材の要望が出てから
- **採点ルールの用語集(Feature Envy・凝集度などの説明)**: 学習上は有用だが、置き場所が `operation-guide` のダイアログと重なりやすく、`RULE_LABEL`(2件が追記予定)とも近い。
  `operation-guide` のマージ後に、そのダイアログへ足すかを検討する方が素直
- **Undo の1手ごとに「何を戻すか」を出す**: `history.ts` と `useGameStore.ts`(`stage-draft-persistence`・`critique-request-robustness`)に差分が出る

## 関連する既存コード

- `src/domain/stage/Stage.ts` — `limits`・`dependencyLimit`・`responsibilityLimit`・`visibilityEnforced`(JSDocに意味が書いてある)。**読むだけ**
- `src/domain/scoring/lineLimits.ts` — `LineLimits` 型
- `src/domain/scoring/score.ts` — 各上限がどのルールで使われるか(`coupling` は依存先の数 > `dependencyLimit`、など)。**読むだけ**
- `src/presentation/stage/describeScore.ts` — `RULE_LABEL`。ルール名の言い回しを揃える先(**読むだけ**。`duplicate-code-scoring`・`inline-method-stage` が追記予定)
- `src/presentation/stage/StagePanel.tsx` — `stage-panel__heading`(タイトル・`goal`・「どんなコード?」の `<details>`)。表示を置く先の候補
- `src/presentation/quiz/ComparisonQuizView.tsx` 89行目 — `limits` から「行数の上限: …」を組み立てている前例(文言の揃え先。**読むだけ**)
- `src/presentation/canvas/layoutCodebase.test.ts`・`clampMenuPosition.test.ts` — presentation 層の純粋関数を Vitest で守っている前例
  (表示の文を組み立てる関数を純粋関数にするなら、この形でテストを書ける)
- `src/infrastructure/stages/*.ts` — 各ステージの上限値と `goal`(上の「書かれていない」の確認元。**読むだけ**)
- `src/presentation/blank/BlankDesignPanel.tsx` — 白紙設計も同じ `Stage` の形(`BlankDesignProblem`)で上限を持つが、今回は触らない(後回し)
- `e2e/` — ステージを切り替えると表示の数字が変わることを確かめるE2Eの追加先

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の新しい小さなコンポーネント(と、文を組み立てる純粋関数+そのテスト)、
`StagePanel.tsx` への数行、CSSの数行、E2E1本が中心。domain / application / infrastructure・ストア・ステージデータは変更しない見込み。

1. **今回やる**:
   - リファクタリング画面で、選択中のステージの上限値(メソッド・クラス・ファイルの行数、依存先の数、責務の種類数、アクセス制御を採点するか)を、
     `Stage` のデータから組み立てて一覧で見せる。ステージを切り替えると追従する
   - 文を組み立てる処理は純粋関数にして、Vitest でテストを先に書く(`visibilityEnforced` の有無・`dependencyLimit: 0` のような端の値を含む)
   - E2E: 2つのステージで表示される数字が、それぞれのステージデータの値になっていることを確かめる
2. **後回し**:
   - 白紙設計の上部パネル(`BlankDesignPanel.tsx`)への同じ表示(`blank-design-second-problem` が同じファイルを触るため、マージ後に)
   - `goal` の文に手書きで入っている上限値の削除・整理(ステージ定義ファイルは他の3件が触るため)
   - `goal` の中の数字と上限値が食い違っていないかを検査するテスト(下の論点。今は食い違いは見つからなかった)
   - 行数のバッジを「N / 上限 行」にする(上の見送り候補)
   - 閾値を持たないルール(循環依存・Feature Envy・凝集度など)の説明

仕様設計者に決めてほしい論点(ここでは決めない):

- **置き場所と見た目**: `goal` の直下に常に出すか、「どんなコード?」と同じく `<details>` で畳むか、採点表示の近くに置くか
  (採点表示の直下は `score-deduction-locations` が減点原因の一覧を足す位置なので、離しておく方が衝突しない。下の衝突を参照)
- **載せる項目**: 行数3つ・依存先・責務・アクセス制御の6つで足りるか。アクセス制御を採点しないステージでは「採点しない」と出すか、何も出さないか
- **文言**: `RULE_LABEL`(「結合度」「責務の混在」「アクセス制御」)と揃えるか、「依存先は2クラスまで」のように `goal` の書き方に揃えるか。
  `dependencyLimit: 0`(中級3)を「依存先は0クラス」と書くか「他のクラスに依存しない」と書くか
- **変更依頼の実装中の扱い**: 実装中も同じステージのルールなので出したままでよいか
- **`goal` との重複**: 表示が入ると、`goal` 内の「メソッドは50行以内」などと同じ数字が2か所に出る。今回は `goal` を変えない前提でよいか
- **`goal` の数字の検査テストを今回に含めるか**: 含める場合は `stageCatalog.test.ts`(他の3件が触る予定)ではなく新しいテストファイルに置く。
  ただし、そのテストは後からマージされる新ステージの `goal` にも効くので、書式(「メソッドは◯行」など)の読み取りをどこまで厳密にするかに注意

### 既存パイプラインとの衝突可能性

- **`src/presentation/stage/StagePanel.tsx`**: `score-deduction-locations` の02が、`data-testid="score"` の要素の直後に減点原因の一覧を足し、
  `StagePanel` のJSDocに1文足す予定。本件の差分は `stage-panel__heading` の中(`goal` の直後、または `<details>` の中)に要素を1つ足すだけにすれば、
  相手の変更箇所と数行離れ、テキスト上の競合は小さい。JSDoc は本件では触らない。
  他に `StagePanel.tsx` を変更すると書いているパイプラインは見当たらない(`stage-draft-persistence`・`critique-request-robustness`・`operation-guide` の02は「変更しない」と明記)
- **新しいコンポーネント・純粋関数・テスト(例: `src/presentation/stage/` 配下の新しいファイル)**: 新規ファイルなので競合なし
- **`src/presentation/stage/describeScore.ts`(`RULE_LABEL`)**: 文言を揃えるために**読むだけ**なら競合なし。
  `duplicate-code-scoring`・`inline-method-stage` がルールを足しても、閾値を持たないルールなので本件の表示には影響しない
- **`src/index.css`**: 多くのパイプラインが追記する。本件も数行を末尾付近に追記する程度で、競合は小さい
- **`e2e/`**: `refactor.spec.ts` は多くのパイプラインが追記するので、新しいspecファイルに置けば競合なし(置き場所は仕様設計で決める)
- **意味上の依存**: ステージデータを読むだけなので、`template-method-stage`・`inline-method-stage`・`utils-class-split-stage` が追加するステージにも自動で表示が付く。
  E2Eで数字を確かめるステージは、それらが変更しない既存ステージ(チュートリアル・中級3など)を選べば、どの順でマージされても影響しない
- `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`stageCatalog.test.ts`・`sampleAnswer.ts` を含む)・`useGameStore.ts`・
  `CodebaseCanvas.tsx`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`MethodChip.tsx`・`ClassNode.tsx`・`FileNode.tsx`・`App.tsx`・`workers/critique/` には触らない想定
