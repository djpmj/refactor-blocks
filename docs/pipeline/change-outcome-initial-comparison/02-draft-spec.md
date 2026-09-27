# 仕様草案: 変更依頼の結果カードに「初期状態のコードなら、どこを何か所触る必要があったか」と減点の理由を、今のコードの行と並べて出す

- slug: `change-outcome-initial-comparison`
- 元になった探索: `docs/pipeline/change-outcome-initial-comparison/01-discovered.md`
- 関連する既存仕様: `docs/specs/change-request.md` 122〜123行目(「初期状態」列と「現在」列を並べる、と書かれたが未実装)、
  `docs/specs/implement-change-request.md` 305〜316行目(今の結果カードの正本。初期状態は点数だけ)

## 1. 背景・目的

ゲームの核は「リファクタリング後に新機能の追加課題を出し、**何個のブロックを触る必要があったか**で設計の良し悪しを実感させる」こと。
ところが変更依頼の結果カード(`ChangeRequestPanel.tsx` の `CostRows`)は、初期状態については点数(`outcome-initial`、例: 70点)しか出さず、
「初期状態では何を何か所触る必要があり、なぜ減点されたか」が見えない。プレイヤーには「70点 → 95点」という数字の差しか見えない。

チュートリアル2の軽減税率の依頼なら、初期状態では104行の `placeOrder` を触る必要があり「巻き込み(無関係な責務が4種類同居)」「上限超え」が付く。
`TaxCalculator` へ分けたあとはそれが消え、代わりに「波及」が1つ付く。**この差そのものが学びの中身**なので、今のコードの行と並べて見せる。

### ponytail の階段での判断

- 作る必要があるか: ある(元の仕様 `change-request.md` に書かれていたのに入っていない。上の背景のとおり、差の中身が見えない)
- もうあるか: **ある。ここで止まる。**
  - データ: `ChangeOutcome.initial`(`src/application/ChangeRequestUseCases.ts`)は `measureChange(stage.codebase, …)` の結果の `ChangeAssessment`
    を丸ごと持っている(`impact.sites`・`classesTouched`・`filesTouched`・`linesAdded`・`rippleClasses`・減点の内訳)。画面が `initial.score.total` しか使っていないだけ
  - 文: `describeChange.ts` の `siteNames` / `describeDeductions` は `(assessment, codebase)` を取るので、`initial` と初期状態のコードベースを渡せばそのまま使える
  - 見た目: 既存の `.change-outcome__facts` / `.change-outcome__reasons` のCSSクラスで足りる
  - 初期状態のコードベース: ストアの `stage.codebase`(`useGameStore.ts` 250・405行目で初期化・「最初に戻す」に使っている、ステージ定義そのもの)。
    同じファイルの `SampleAnswer` が `useGameStore((state) => state.stage.limits.method)` でストアから直接読んでいる前例がある
- domain / application / infrastructure・ストア・ステージデータ・`describeChange.ts`・`index.css` の変更は要らない。新しい依存も足さない

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割・変更内容 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/change/ChangeRequestPanel.tsx` | presentation | `CostRows` に初期状態の行(変更が必要なメソッド名・クラス数・ファイル数・追加行数)と初期状態の減点理由を足す(3章) |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 変更依頼の結果カードのテスト(844〜857行目)の直後に1本足す(5章。置き場所は未決事項5) |

**変更しないもの**: `src/domain/**`、`src/application/**`、`src/infrastructure/**`、`src/presentation/store/useGameStore.ts`、
`src/presentation/change/describeChange.ts`(未決事項2で選択肢B・Cを選んだ場合のみ変更)、`src/presentation/change/ChangeMemo.tsx`、
`src/presentation/quiz/ComparisonQuizView.tsx`、`src/presentation/blank/BlankDesignResultPanel.tsx`、`src/index.css`(未決事項1で選択肢Bを選んだ場合のみ追記)、
`ChangeRequestPanel.tsx` の `SampleAnswer`・`OutcomeCard`・`Results`(`CostRows` の props は変えず、中でストアから読むので呼び出し元に差分は出ない)、
`docs/specs/change-request.md`・`docs/specs/implement-change-request.md`(過去の仕様は書き換えない。正本は最終仕様フェーズで `docs/specs/change-outcome-initial-comparison.md` になる)。

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの型の変更は無し。`CostRows` の props も変えない。

### 表示(未決事項がすべて推奨案の場合)

`'modify'` の依頼のカード(`change-outcome-<id>`)の `CostRows` を次の形にする。`'extend'` の依頼(`current`/`initial` が `null`)は今のまま
(`OutcomeCard` がすでに `CostRows` を出し分けている)。

```
今のコード 95点 / 初期状態 70点 / 前回 …          ← 既存(文言・data-testid とも変えない)
変更が必要: calculateTax(1クラス・1ファイル・+8行)  ← 既存(変えない)
初期状態なら: placeOrder(1クラス・1ファイル・+8行)  ← 追加
  ・巻き込み: 変更するメソッドに、依頼と関係ない責務が4種類同居していて、巻き込んで壊すおそれがある   ← 追加
  ・上限超え: 変更を入れると行数の上限を超えるメソッド・クラス・ファイルが1個ある                     ← 追加
置き方 100点(置いた先: TaxCalculator)             ← 既存
解答例: …                                           ← 既存
・波及: 変更したクラスを呼んでいる OrderService も…  ← 既存(今のコストの理由+置き方の理由。変えない)
```

実装の形(目安):

```tsx
function CostRows({ current, initial, codebase, previous }: /* 既存と同じ */) {
  const initialCodebase = useGameStore((state) => state.stage.codebase);
  const initialReasons = describeDeductions(initial, initialCodebase);
  return (
    <>
      {/* 既存の2つの <p> はそのまま */}
      <div data-testid="outcome-initial-cost">
        <p className="change-outcome__facts">初期状態なら: {siteNames(initial, initialCodebase)}(…クラス・…ファイル・+…行)</p>
        {initialReasons.length === 0 ? null : <ul className="change-outcome__reasons">{/* 理由を li で */}</ul>}
      </div>
    </>
  );
}
```

- 「(Nクラス・Nファイル・+N行)」の組み立てが今のコード側と2回になるので、`ChangeRequestPanel.tsx` の中に小さな関数
  (例: `impactSummary(assessment, codebase): string` → `"placeOrder(1クラス・1ファイル・+8行)"`)を1つ置いて両方の行で使ってよい。
  `ComparisonQuizView.tsx`・`BlankDesignResultPanel.tsx` の同じ形の文は**寄せない**(他パイプラインが触るファイルで、今回の目的ではない)
- 初期状態の減点が無いとき(`initialReasons` が空)は理由のリストを出さない(点数の「初期状態 100点」で分かる。「減点なし」の文は足さない)

### 決めたこと(未決事項にしないもの)

- **既存の `data-testid` と文言**: `outcome-current`・`outcome-initial`・`outcome-previous` の文言と位置、「変更が必要: …」の行は変えない。
  既存のE2E(`e2e/refactor.spec.ts` 810〜857行目・919〜923行目など)が変更なしで通る
- **新しい `data-testid`**: 初期状態の行と理由のまとまりに `outcome-initial-cost` を1つだけ付ける(E2Eはこの中の文で確かめる)
- **初期状態の行の見出し**: 「初期状態なら:」。今のコードの行(「変更が必要: …」)は既存のまま残し、ラベルを「今のコードなら:」などに書き換えない
- **`ChangeMemo.tsx`(編集パネルの「前回の変更依頼」)**: 触らない(01の「後回し」のとおり。手がかりとして短く保つ)
- **読み上げ・キーボード**: 追加するのは静的な文とリストだけで、操作できる要素は増えない(未決事項1で選択肢Cを選んだ場合のみ `<details>` の開閉が増えるが、ブラウザ標準でキーボード操作できる)

## 4. TDD対象の純粋関数

**なし(未決事項がすべて推奨案の場合)。** domain / application 層に新しいロジックを書かない。
初期状態の変更コストは既存の `measureChange`・`scoreChange`(`measureChange.test.ts`・`scoreChange.test.ts`)が計算・テスト済みで、
`ChangeOutcome.initial` の中身は `ChangeRequestUseCases.test.ts` で守られている。presentation 層で書くのは既存の `siteNames`/`describeDeductions` の
呼び出しと、上の `impactSummary` 程度の文字列の組み立てだけ。プレイヤーの操作の結果に関わる表示なので、CLAUDE.md の方針どおり **Playwright の E2E で守る**。

**未決事項2で選択肢B・Cを選んだ場合のみ**、`src/presentation/change/describeChange.ts` に次の純粋関数を足し、
先に `src/presentation/change/describeChange.test.ts`(新規、AAA)を書く。

```ts
/** 初期状態で減点があり、今のコードで減点が無くなったルールの表示名(例: ['巻き込み', '上限超え'])。規則の並びは CHANGE_RULE_LABEL の順。 */
export function resolvedDeductions(initial: ChangeAssessment, current: ChangeAssessment): string[];
```

- 正常系: 初期状態で `entangled`・`limit-break` が減点、今は `ripple` だけ減点 → `['巻き込み', '上限超え']`
- 正常系: 初期状態も今も減点なし → `[]`
- 正常系: 初期状態と今で同じルールが減点(件数が減っただけ、例: `shotgun` 3→2) → `[]`(「無くなった」ものだけ数える)
- 境界: `points: 0` の内訳(`scoreChange` は4ルールすべてを `points: 0` 込みで返す)は減点が無いものとして扱う

## 5. 受け入れ基準

1. チュートリアル2で、`e2e/refactor.spec.ts` に足した次のE2Eが通る(テスト名の例: 「変更依頼の結果に、初期状態のコードなら変更が必要だったメソッドと減点の理由が並ぶ」。AAAのコメントを付ける)
   - Arrange: `openOrderStage` → `reachFullScoreOnOrderStage`
   - Act: `implementRequests(page, TAX_PARTS, ['TaxCalculator', 'OrderService', 'OrderService'])`
   - Assert(`change-outcome-req-reduced-tax` の中で):
     - `outcome-initial-cost` が「初期状態なら: placeOrder(1クラス・1ファイル・+8行)」を含む
     - `outcome-initial-cost` が「巻き込み:」と「上限超え:」を含む
     - `outcome-initial-cost` が「波及:」を含まない(今のコード側にだけ付く減点が、初期状態側に混ざっていないこと)
     - 既存の `outcome-initial` が「70点」、`outcome-current` が「95点」のまま
2. 既存の `e2e/refactor.spec.ts`(変更依頼の結果・前回・変更メモのテストを含む)と他のE2Eが変更なしで通る
3. `'extend'` の依頼のカードには `outcome-initial-cost` が出ない(`OutcomeCard` の既存の出し分けに乗るので、コード上 `CostRows` の外で新しい分岐を足していないことで確認)
4. 初期状態側のメソッド名・波及のクラス名は `stage.codebase` から引いている(未決事項3が推奨案の場合)。プレイヤーが名前を変えたり、メソッドを消したりしても空欄にならない
5. `npm run check`(lint + typecheck + test)が通る。`as`・非nullアサーション・不要な `?.`/`??` を使わない。関数60行・複雑度12以内に収まる
6. 2章の「変更しないもの」に差分が無い(未決事項で推奨以外を選んだ場合はその分だけ例外)

## 6. スコープ外

- `ChangeMemo.tsx`(編集パネルの「前回の変更依頼」)に同じ比較を出すこと。同じ `siteNames`/`describeDeductions` で出せるが、手がかりは短く保ちたいので要望が出てから
- キャンバス・「変更前の図」(`CodebasePreviewDialog`)の上に、初期状態で変更が必要だったメソッドの印を出すこと(`quiz-change-site-marks` のマージ後、同じ部品で)
- 依頼を積み重ねたとき(2件目以降)に、「前の依頼までの実装を当てた初期状態のコード」で測り直すこと。`initial` は今どおり常に `stage.codebase` で測る
  (application の変更になり、「変更容易性スコア(初期状態)」の意味も変わる)
- 「前回」(`outcome-previous`)の内訳を出すこと(点数だけのまま)
- `ComparisonQuizView.tsx`・`BlankDesignResultPanel.tsx`・`CostRows` にある「変更が必要: …(Nクラス・Nファイル・+N行)」の組み立てを共通関数に寄せること
- 置き方(`placement`)の初期状態との比較(「初期状態で一番良い置き方の点数」。`implement-change-request.md` のスコープ外のまま)
- `domain`/`application`/`infrastructure` 層・ストア・ステージデータの変更

## 未決事項

### 未決事項1: 初期状態と今のコードを、結果カードの中でどう並べるか

サイドパネルは幅360px(`.method-editor`)で、減点理由は1文が長い。

- 選択肢A(推奨): 2段の文。今のコードの「変更が必要: …」の行のすぐ下に「初期状態なら: …」の行を足し、その下に初期状態の減点理由を箇条書きで出す(3章の図)。
  既存のCSSクラスだけで済み、`index.css` に差分が出ない
- 選択肢B: 表。「初期状態」列と「今のコード」列を並べ、行を「変更が必要なメソッド・クラス数・ファイル数・追加行数・散らばり・波及・巻き込み・上限超え(件数)」にする
  (元の `change-request.md` の案)。360pxに収めるため理由の文は表に入れず件数だけになり、`index.css` に表のスタイルを数行足す(他パイプラインと追記位置が近く、軽い競合の可能性)
- 選択肢C: Aと同じ中身を `<details>`(「初期状態ならどうだったか」)に入れて、最初は畳んでおく。カードは短く保てるが、開かないと差が見えない

### 未決事項2: 初期状態の減点理由をどこまで出すか

- 選択肢A(推奨): 初期状態の減点理由を全部そのまま並べる(`describeDeductions(initial, …)`)。新しい関数が要らず、今のコード側の理由と同じ文なので読み比べやすい
- 選択肢B: 全文は出さず、「初期状態から無くなった減点: 巻き込み・上限超え」の1行だけにする。短いが「なぜ困るのか」の文が初期状態側から消える。
  `describeChange.ts` に純粋関数 `resolvedDeductions` を足し、Vitest を先に書く(4章)
- 選択肢C: Aの全文に加えて、Bの「無くなった減点」の1行も出す。いちばん分かりやすいが、カードがいちばん長くなり、Bと同じく新しい関数とテストが要る

### 未決事項3: 初期状態側のメソッド名・波及のクラス名を、どのコードベースから引くか

`initial.impact.sites`・`rippleClasses` のIDは初期状態のコードのもの。プレイヤーが名前を変えたり、メソッドを消したり(インライン化など)していることがある。

- 選択肢A(推奨): `stage.codebase`(初期状態のコード)から引く。初期状態の名前で必ず全部出る。波及のクラス名も同じ扱いにする
- 選択肢B: 今のコード(`Results` の `codebase` = 積み重ねたコード)から引く。プレイヤーが付けた名前で出るが、消えたメソッドは名前が空になる(`siteNames` は見つからないIDを飛ばすため)
- 選択肢C: `stage.codebase` から引き、今のコードで名前が変わっていれば「placeOrder(今は submitOrder)」のように補う。親切だが、名前の突き合わせ処理が増える(presentation に新しい関数とテスト)

### 未決事項4: 2件目以降の依頼で、比較の見出し「初期状態」に補足を足すか

2件目以降の依頼の `current` は前の依頼までの実装を積み重ねたコード(`carried`)で測り、`initial` はいつも `stage.codebase`(前の依頼の実装を含まない)で測っている。

- 選択肢A(推奨): 補足しない。「初期状態」はステージ開始時のコードそのもので、既存の「初期状態 N点」「変更容易性スコア(初期状態は N点)」とも同じ言葉。積み重ねの差は数行分の部品で、比較の中身はほぼ変わらない
- 選択肢B: 結果画面の冒頭(`change-readiness` の下)に1行だけ「初期状態は、ステージを始めたときのコードに依頼を1件ずつ当てたときの結果です」と足す
- 選択肢C: 2件目以降のカードの「初期状態なら:」の行にだけ「(前の依頼の実装は含まない)」と添える。`CostRows` に依頼の番号を渡す props が増える

### 未決事項5: E2Eの置き場所・形

ヘルパー(`openOrderStage`・`reachFullScoreOnOrderStage`・`implementRequests`・`TAX_PARTS`)は `e2e/refactor.spec.ts` の中にあり、export されていない。

- 選択肢A(推奨): `e2e/refactor.spec.ts` の844〜857行目のテスト(「責務を分けたあとで同じ依頼を受けると、初期状態より変更容易性スコアが高くなる」)の直後に、新しいテストを1本足す。
  他パイプラインの追記位置(名前の変更・右クリックメニュー・移動など)とは離れている
- 選択肢B: 新しいテストは足さず、844〜857行目の既存テストの Assert に数行足す。E2Eの実行時間が増えないが、既存テストの名前と中身がずれる(名前も変えると差分が広がる)
- 選択肢C: 新しいspec(例: `e2e/change-outcome.spec.ts`)に切り出す。ヘルパーを export するか写す必要があり、`refactor.spec.ts` 側の差分がかえって増えて他パイプラインと衝突しやすい
