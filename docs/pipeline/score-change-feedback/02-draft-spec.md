# 仕様草案: 操作のたびに「その1手で、どのルールの減点が何件増えた・減ったか」を知らせる

- slug: `score-change-feedback`
- 元: `docs/pipeline/score-change-feedback/01-discovered.md`

## 1. 背景・目的

- リファクタリング画面で出している採点は、`StagePanel.tsx` 105〜107行目の1行だけである(`70点(行数 -10 / 責務の混在 -10 / …)`)。
  操作の**前後で何が変わったか**は、プレイヤーが頭の中で見比べるしかない。
- リファクタリングの手には**トレードオフ**がある。たとえば Move Method で責務の混在が1件減っても、代わりに結合度が1件増えることがある。
  このように減点が1つ消えて別の1つが増えると、合計点も1行の文字数もほとんど変わらないので、変化に気づけない。
- `docs/specs/visibility-scoring.md` 9行目が狙った学びは「private メソッドを移すと自然に減点される、という相互作用」を作ることだった。
  しかし、その相互作用を**その場で**伝える表示が無い。
- 今回やること: 採点の対象になるコードが変わるたびに、その1手でルールごとの件数と合計点がどう変わったかを、1行で出す。
  例: `直前の操作: 責務の混在 -1件、空のクラス・ファイル -1件(+20点)`

### 調査で分かったこと

- **件数はもう出ている。** `scoreCodebase`(`src/domain/scoring/score.ts`)は `Score = { total, deductions: { rule, count, points }[] }` を返す。
  `deductions` にはどのルールも(件数0でも)毎回入っている。そのため、前後の `deductions` を `rule` で突き合わせれば増減が出る。
  ルールの名前は `describeScore.ts` の `RULE_LABEL` を使う。
- **`StagePanel` が採点に使う `codebase` の参照は、変更依頼の出入りでは変わらない。** `StagePanel` は `changeSession?.base ?? codebase` を採点する。
  - `startChangeRequests` は `base: codebase` を入れる(同じ参照)
  - `endChangeRequests` は `codebase: base` に戻す(同じ参照)
  - 実装中は `base` が固定される
  - つまり、「表示中の `codebase` の参照が変わったとき」だけを1手として数えれば、変更依頼の出入りは自然に1手に数えない
- **何も変わらない操作は、`codebase` の参照が変わらない。** `commit`(`useGameStore.ts` 136〜140行目)は、同じ参照なら何もしない。
  失敗した操作も `message` しか変えない。そのため、失敗やコードの変わらない操作では、表示は前のまま残る。
- **ステージの切り替えは `stage.id` で分かる。** `HintPanel`・`PreviewButtons` と同じく、`key={stage.id}` で作り直せば、前のステージとは比べない。
  `stage-draft-persistence` が入った場合、途中経過の復元はステージの切り替え、または最初の表示(リロード)と同時に起きる。
  そのため、この仕組みで「1手の増減」と誤って表示されることは無い。
- `e2e/refactor.spec.ts` は、`getByTestId('score')` の文言を25か所で確かめている。本件は `data-testid="score"` の中身・`aria-live` を**変えず**、
  新しい要素(`data-testid="score-change"`)に出す。

### 本当に新しい仕組みが要るか(ponytail)

- **新しい採点ロジック・ドメインの型は要らない。** 前後の `Score` を比べて文にするだけで足りる。
  これは表示の文言なので、`src/presentation/stage/` に純粋関数を1つ置く(`describeScore.ts` と同じ層)。
  domain に「増減」の型を作る案は、使い道が表示しかないので作らない(AI講評に渡すなどの要望が出てから)。
- **ストア・履歴には手を入れない。** 「前」の点数は、表示用のコンポーネントの中で前回の値を覚えておけば取れる(未決事項1の推奨案)。
- **`describeScore.ts` には足さない。** `score-deduction-locations` が同じファイルに関数を足す予定で、差分をぶつけないため。`RULE_LABEL` の import だけにする。
- 増減の原因の名前(どのクラスか)、キャンバスを光らせる演出は作らない(7章)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/presentation/stage/describeScoreChange.ts` | presentation | 純粋関数 `describeScoreChange(before, after)`(4章) |
| 新規 | `src/presentation/stage/describeScoreChange.test.ts` | presentation(test) | 上記のAAAテスト(先に書く) |
| 新規 | `src/presentation/stage/ScoreChangeNote.tsx` | presentation | 前回の点数を覚え、採点対象のコードが変わったら増減の1行を出すコンポーネント(5章) |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | import 1行と、`ScoreChangeNote` を置く1行(5章)。これ以外は触らない |
| 変更 | `src/index.css` | presentation | `.stage-panel__change` を1行足す(5章) |
| 新規 | `e2e/score-change-feedback.spec.ts` | E2E | 6章のテスト。`refactor.spec.ts` には追記しない |

**読むだけで変更しないファイル**: `score.ts`・`describeScore.ts`・`useGameStore.ts`・`history.ts`・`BlankDesignPanel.tsx`・`e2e/refactor.spec.ts`

**触らないファイル**: `src/domain/`・`src/application/`・`src/infrastructure/` のすべて、`CritiquePanel.tsx`・`HintPanel.tsx`・`App.tsx`・`workers/`

## 3. データ/型の変更

- ドメインモデル・永続化スキーマ・ストアの状態の変更は無い。`Score`・`ScoreDeduction`・`ScoreRule` も変えない。
- 新しい公開の型は作らない。関数の引数・戻り値は、既存の `Score` と `string` で足りる。

## 4. TDD対象の純粋関数

### `describeScoreChange(before: Score, after: Score): string`

```ts
// src/presentation/stage/describeScoreChange.ts
/**
 * 前後の点数を比べ、件数が変わったルールと合計点の差を1文にする。ルールの並びは after.deductions の順。
 * 例: 「直前の操作: 責務の混在 -1件、結合度 +1件(±0点)」
 */
export function describeScoreChange(before: Score, after: Score): string;
```

- `before.deductions` を `rule` → `count` の `Map` にし、`after.deductions` の順に `after.count - (before の count ?? 0)` を出す。
  差が0のルールは出さない。
- 件数の差: `+1件`・`-2件`(`describeScore` の `-10` に合わせ、半角の `+`/`-`)
- 合計点の差: `after.total - before.total` を使う。`+20点`・`-10点`・`±0点`。
  減点の合計ではなく `total` の差を使う。0点で頭打ちになるときも、画面の点数の動きと食い違わないようにするため。
- 件数の変わったルールが1つも無ければ、`直前の操作: 減点の増減なし` を返す(未決事項5の推奨案)。
- 文言は、良い・悪いを言わない中立な形にする。「悪化」「失敗」などの評価の言葉や、赤・緑の色分けは使わない。
  トレードオフのある手は正常な手であり、責める言い方にしないため。
- 文言の形(接頭辞・件数と点数のどちらを出すか)は未決事項4の推奨案で書いている。選択肢が変わったら、この節とテストの期待値を読み替える。

テストケース(AAA。`Score` は手で組み立てる。ルールの数・並びに依存させないため、2〜3ルールだけの `deductions` で書く):

| # | 種類 | before → after | 期待 |
|---|---|---|---|
| 1 | 正常系(1ルール減) | `responsibility` 1→0、`total` 70→80 | `直前の操作: 責務の混在 -1件(+10点)` |
| 2 | 正常系(トレードオフ) | `coupling` 0→1、`responsibility` 1→0、`total` 80→80 | `直前の操作: 結合度 +1件、責務の混在 -1件(±0点)`(after の並び順) |
| 3 | 正常系(複数件・減点) | `visibility` 0→2、`total` 90→70 | `直前の操作: アクセス制御 +2件(-20点)` |
| 4 | 正常系(変化なし) | 件数も `total` も同じ(別オブジェクト) | `直前の操作: 減点の増減なし` |
| 5 | 境界(0点で頭打ち) | `line-limit` 11→10、`total` 0→0 | `直前の操作: 行数 -1件(±0点)` |
| 6 | 境界(before に無いルール) | before の `deductions` に `cohesion` が無く、after は `cohesion` 1 | `無関係なデータの塊が同居(凝集度が低い) +1件` を含む(0件として扱う) |
| 7 | 並び順 | after の `deductions` の順が before と違う | after の順で並ぶ |

`ScoreChangeNote.tsx`・`StagePanel.tsx` の変更は表示なので、ユニットテストの対象外にする(6章のE2Eで守る)。

## 5. 画面

### 5.1 `ScoreChangeNote.tsx`(新規)

```tsx
/**
 * 採点対象のコードが変わるたびに、直前の点数との差を1行で出す。最初の表示では何も出さない。
 * 呼び出し側で key={stage.id} を付ける。ステージを切り替えたら作り直し、前のステージとは比べない。
 */
export function ScoreChangeNote({ codebase, score }: Readonly<{ codebase: Codebase; score: Score }>) {
  const [previous, setPrevious] = useState({ codebase, score });
  const [text, setText] = useState<string | null>(null);
  if (previous.codebase !== codebase) {
    setPrevious({ codebase, score });
    setText(describeScoreChange(previous.score, score));
  }
  return (
    <div className="stage-panel__change" data-testid="score-change" role="status">
      {text}
    </div>
  );
}
```

- 比べるのは `codebase` の**参照**である。`score` は `useMemo` の結果なので、StrictMode の二重描画などで参照が揺れても誤判定しないように、`codebase` を見る。
- React 公式の「前回のレンダーの情報を保存する」書き方(条件付きで描画中に `setState`)にする。
  - `useRef` の値を描画中に読む書き方は、`react-hooks/refs` に当たるので使わない
  - `useEffect` の中で同期的に `setState` する書き方は、`react-hooks/set-state-in-effect` に当たるので使わない
- 万一 `react-hooks` の lint がこの書き方を弾いた場合は、lint を無効化しない。代わりに、`useGameStoreApi().subscribe((state, prev) => …)` を `useEffect` で購読する。
  そのうえで、`(prev.changeSession?.base ?? prev.codebase)` と `(state.changeSession?.base ?? state.codebase)` の参照を比べ、
  コールバックの中で `setText` する形に切り替える。どちらにしたかをPR本文に書く。
- **要素は常に描画する**(文が無いときは空)。`role="status"` の領域が先に DOM にあるので、中身が変わったときに読み上げられる。
- 表示は、次にコードが変わるまで出したままにする。数秒で消す表示にはしない。
  消えるまでに読み切れない人がいるため(WCAG 2.2.1)。これは決めてしまい、未決事項にはしない。

### 5.2 `StagePanel.tsx`(変更は2か所だけ)

1. import を1行足す: `import { ScoreChangeNote } from './ScoreChangeNote';`(9行目 `HintPanel` の import の直後)
2. 見出しの `</div>`(104行目)と、`score` の `<div>`(105行目)の**間**に1行足す(未決事項6の推奨案)。

   ```tsx
   {!investigating && <ScoreChangeNote key={stage.id} codebase={codebase} score={score} />}
   ```

- `codebase`・`score`・`investigating` は、`StagePanel` にすでにある変数をそのまま渡す。新しいストアの読み出しは足さない。
- 変更依頼の実装中(`investigating`)は出さない(未決事項3の推奨案)。
  - 実装中は採点対象が挑戦前のコードに固定され、その間の操作は採点されない
  - そのため、最後のリファクタリングの増減が出たままだと、実装中の操作の結果に見えてしまう
  - 変更依頼を終えると作り直され、空から始まる
- 差し込み位置は、他の件の差し込み位置のどれとも隣り合わない。
  - `stage-rules-summary`: 98行目の直後(6行離れる)
  - `score-deduction-locations`: 107行目の直後(3行離れる)
  - `codebase-code-view`: 53〜72行目の中
- 次のものは変えない。
  - `score` の `<div>`(105〜107行目)の中身・属性
  - JSDoc
  - `CritiquePanel`・`HintPanel`・`PreviewButtons`・ボタンの行

### 5.3 `index.css`

`.stage-panel__status`(70行目)の直後に1行足す。見た目は `goal` と同じ小さな灰色の文字にし、折り返せるようにする(`.stage-panel__status` は `nowrap` なので流用しない)。

```css
.stage-panel__change { flex: 0 1 auto; min-width: 0; font-size: 12px; color: var(--muted); }
```

文が空のときも、フレックスの `gap` 分の隙間が1つ残る。見た目の差は小さいので許容する。
`:empty { display: none }` にすると、表示されたときに読み上げられないスクリーンリーダーがあるため、使わない。

## 6. 受け入れ基準

1. `describeScoreChange.test.ts` に4章の7ケースがあり、AAAで書かれ、実装より先に(または同じコミットでテストが先に)書かれている
2. `npm run check`(lint + typecheck + test)が通る。`domain`/`application` のカバレッジ閾値を割らない
3. `data-testid="score"` の要素の中身・`aria-live`・文言に差分が無い。`e2e/refactor.spec.ts` は変更せず、そのまま通る
4. `StagePanel.tsx` の差分は5.2の2か所だけ。`src/domain/`・`src/application/`・`src/infrastructure/`・`useGameStore.ts` に差分が無い
5. `npm run test:e2e` が通り、新規の `e2e/score-change-feedback.spec.ts` に次のテストがある。
   ヘルパー(`openOrderStage`・`dragMethodToClass` など)は、`blank.spec.ts` と同じく、このファイルに必要な分だけ写す。
   1. **最初は何も出ない・切り替えても比べない**: `/` を開いてチュートリアル2を選ぶと、`score-change` は空である(`toBeEmpty()`)
   2. **点数が変わらない1手**: 「消費税を計算する(軽減税率あり)」を `calculateTax` として抽出すると、`score-change` が `直前の操作: 減点の増減なし` になる
   3. **トレードオフのない改善**: 続けて `calculateTax` を `TaxCalculator` へドラッグすると、`score-change` に次の3つが含まれる。
      - `責務の混在 -1件`
      - `空のクラス・ファイル -1件`
      - `+20点`

      ほかのルールの件数が一緒に動く場合は、`score` の点数(70点→90点)と合わせて期待値を直す。実装時に1回実機で確かめる
   4. **取り消しも1手として出す**(未決事項2の推奨案): 3のあと「元に戻す」を押すと、`責務の混在 +1件` と `-20点` が含まれる
   5. **ステージを切り替えたら消える**: 3のあと別のステージ(中級1)を選ぶと、`score-change` は空である
   6. **変更依頼の実装中は出さない**: チュートリアル2を100点にしてから「変更依頼に挑戦」を押すと、`score-change` が無い(`toHaveCount(0)`)。
      `change-request-close` で終えると、`score-change` は空で再び現れる
6. 失敗した操作(例: 同じクラスへのドロップ)や、コードの変わらない操作のあとは、表示が前のまま残る(コードレビューで確認。`codebase` の参照比較なので自然に守られる)
7. 新しい依存を足していない

## 7. スコープ外

- **増減の原因の名前**(`責務の混在 -1件(OrderService)` など)。
  `score-deduction-locations` のマージ後に、その `findViolationTargets` を前後で比べれば足せる。まず件数だけで学びが伝わるか、実機で確かめてから
- **白紙設計・設計くらべクイズ・変更依頼の実装中への表示**
  - 白紙設計は点数を出していない
  - 実装中は採点対象が変わらない
- **キャンバス上で、増減したクラスを光らせる・色を付ける演出**
- **1手ごとの増減の履歴**(直前の1手だけを出す)、および操作の種類(「Move Method で」など)を文に入れること。
  操作の種類を知るには、履歴に操作の説明を積む変更(`history.ts`・`useGameStore.ts`)が要る。これは `stage-rules-summary` の01で見送られた論点
- AI講評に増減を渡すこと
- `describeScore`・`RULE_LABEL`・`Score` 型の変更

## 8. 未決事項

### 未決事項1: 「前」の点数をどこから取るか

- 選択肢A(推奨): `ScoreChangeNote` が前回描画したときの `codebase`・`score` を覚えておき、`codebase` の参照が変わったら比べる(5.1)。
  - ストア・履歴に手を入れない
  - 変更依頼の出入り・ステージの切り替え・途中経過の復元を「1手」に数えない、という性質が、調査で分かった参照の性質から自然に出る
- 選択肢B: 描画のたびに `history.past.at(-1)` を採点し直し、今の点数と比べる。
  - 「今のコードを作った1手」の増減を、いつでも出せる。変更依頼を終えて戻ったときも、最後の1手の増減が再び出る
  - 一方で、次の問題がある
    - 実装中は `history` が実装用の履歴に入れ替わるので、実装中は別の扱いが要る
    - Undo 直後は「取り消した手」ではなく「その1つ前の手」の増減が出るので分かりにくい
    - 採点が毎回2回走る

### 未決事項2: 「元に戻す」「やり直し」「最初に戻す」のあとも増減を出すか

- 選択肢A(推奨): 通常の操作と同じく出す(例: 元に戻す → `直前の操作: 責務の混在 +1件(-10点)`)。
  - どれもコードを変える1手であり、取り消して点数がどう戻ったかが分かるのも役に立つ
  - 追加のコードは要らない
- 選択肢B: この3つのあとは表示を消す(空にする)。
  - 「操作」を狭く捉えるならこちらが自然
  - ただし、コンポーネントからは Undo かどうかが分からない。`useUndoRedoShortcut.ts`(Ctrl+Z)・ボタン・`resetStage` のそれぞれで知らせるか、
    ストアの `history` の長さの変化から推測する処理が要る。触るファイルが増える

### 未決事項3: 変更依頼の開始・実装中・終了の扱い

- 選択肢A(推奨): 実装中は表示ごと出さず、終えたら空から始める(5.2の `!investigating &&`)。
  - 実装中の操作は採点されないので、残った表示を実装の結果と取り違えない
- 選択肢B: 実装中も、挑戦前の最後の1手の増減を出したままにする。
  - 追加の条件が要らない
  - ただし、実装中の操作の結果に見えるおそれがある

### 未決事項4: 文言の形

- 選択肢A(推奨): 件数の増減と合計点の差の両方を出す。例: `直前の操作: 責務の混在 -1件、結合度 +1件(±0点)`
  - トレードオフ(件数は動いたが点数は同じ)が1行で分かる
- 選択肢B: 件数の増減だけを出す。例: `直前の操作: 責務の混在 -1件、結合度 +1件`
  - 短いが、点数の変化は隣の `score` の行と見比べることになる
- 選択肢C: ルールごとの点数で出す。例: `直前の操作: 責務の混在 +10点、結合度 -10点`
  - `describeScore` の `-10` と見た目がそろう
  - ただし、「減点が減った」が `+10点` になり、`score` の行の `-10` と符号の意味が逆になって紛らわしい

### 未決事項5: 減点が何も変わらなかった1手(抽出しただけ・名前の変更など)で何を出すか

- 選択肢A(推奨): `直前の操作: 減点の増減なし` と出す。
  - 「抽出しただけでは責務の混在は直らず、移して初めて減る」といった学びが伝わる
  - 表示が前の手のまま残って、今の手の結果と取り違えることもない
- 選択肢B: 何も出さない(空にする)。
  - 静かだが、今の手が採点されたのかどうかが分かりにくい

### 未決事項6: どこに置くか

- 選択肢A(推奨): 見出しと点数の1行の間に置く(5.2。フレックスの並びでは点数の1行の左、画面が狭いときは上)。
  - 点数のすぐそばに出る
  - 他の件の差し込み位置とも隣り合わない
- 選択肢B: 点数の1行の直後に置く。
  - 読む順は「今の点数 → その変化」で自然
  - ただし、`score-deduction-locations` の差し込み位置(107行目の直後)と重なり、マージのときに手で直す衝突がほぼ確実に起きる
- 選択肢C: ボタンの並び(`stage-panel__actions`)の後ろ、ステージ欄の末尾に置く。
  - 衝突は無い
  - ただし、点数から離れ、画面の幅によってはヒントやボタンの向こうへ回り込む

### 未決事項7: スクリーンリーダーでの読み上げ

- 選択肢A(推奨): 増減の1行も `role="status"`(`aria-live="polite"` 相当)にする。
  - 点数の1行と増減の1行の両方が、1手ごとに順に読まれる
  - 同じ文を2回読むわけではなく、内容は重ならない
  - `score` の要素には手を入れない
- 選択肢B: 増減の1行は読み上げない(`role` を付けない)。
  - 読み上げは今のまま短い
  - ただし、目の見えない人だけがトレードオフの情報を受け取れない
- 選択肢C: 増減の1行だけを読ませ、`score` の要素の `aria-live` を外す。
  - 1手ごとの読み上げが1回で済む
  - ただし、01で「中身を変えない」とした `score` の要素に差分が出て、`score-deduction-locations` の差し込み位置のすぐ上と衝突しやすい
