# 01 機能探索: 操作のたびに「その1手で、どのルールの減点が何件増えた・減ったか」を知らせる

- slug: `score-change-feedback`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

### 既存テーマとの重複確認

- `docs/specs/` 24件と `docs/pipeline/*/01-discovered.md` 29件を `点数の変化|スコアの差|前の点数|直前の操作|操作ごと|1手ごと|delta` でgrepした。
  **1手ごとの点数の増減**を主題にしたものは無い(ヒットは設計くらべの「2つの設計のスコアの差」と、見送り候補の「Undo の1手ごとに何を戻すか」だけ)
- 近いものとの違い:
  - `score-deduction-locations`: **今**の減点の原因(クラス・メソッド名)の一覧。「今の操作で何が変わったか」(時間の軸)は扱わない。
    02 のスコープ外にも無い。`Score`・`ScoreDeduction` の型は変えないと明記しているので、本件はそのまま使える
  - `change-outcome-initial-comparison`: 変更依頼の結果を「初期状態のコード」と比べる。リファクタリング中の1手ごとの比較ではない
  - `stage-rules-summary`: 採点の上限値の一覧(静的)。点数の変化は扱わない
  - `stage-rules-summary` の01で見送られた「Undo の1手ごとに何を戻すか」: 履歴に**操作の説明**を積む話で `history.ts`・`useGameStore.ts` に差分が出る。
    本件は操作の種類を知らなくてよく、前後の `Score` を比べるだけ(下の「背景・目的」)なので、履歴やストアに手を入れない
  - `operation-guide`・`drag-announcements-ja`・`flow-aria-labels-ja`: 操作の方法・読み上げ。採点結果の伝え方は扱わない
- 呼び出し元が列挙した29件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **新ステージ(散弾銃手術(Shotgun Surgery)を1か所へ集める・Facade・継承より委譲・Refused Bequest など)**: 題材の余地はあるが、
  散弾銃手術は上級7(`advanced-value-object`: 3サービスに散った金額の処理を Money へ集める)・上級4(Factory へ集約)と操作の形が近い。
  Facade も上級4と同じ「重複を統合して1クラスへ移す」形になる。継承より委譲・Refused Bequest は新しい採点ルールが要り、`score.ts` には
  `duplicate-code-scoring`・`inline-method-stage` が追記予定。ステージ追加の定番の衝突先(`stageCatalog.ts` の1行)も `law-of-demeter-stage` が触る
- **フィールドのチップに「このフィールドを読む・書くメソッド」を出す(逆引き)**: `FieldChip.tsx` は空き地だが、`method-call-references` の02が
  「要望が出たら同じ形で足す」と意図して後回しにしている(182行目)。表示の置き場所(ツールチップはキーボードで見えない)も決めにくい
- **Extract Interface(呼び出し元の `uses` を抽象へ付け替える操作)**: `docs/specs/payment-gateway-true-dip.md` 90〜95行目で却下済み
- **「逆の分け方でも ✅ が付く」問題(`docs/specs/volatility-axis-stages.md` の未決事項)**: 正しい穴だが、進捗の記録(`StagePanel.tsx` の `recordProgress`)・
  `useGameStore.ts`・変更依頼の結果(`ChangeRequestUseCases.ts`、`change-outcome-initial-comparison` が触る)にまたがり、衝突が大きい
- **VSCode風ファイルツリー・ミニマップ・クイズの正解数の保存・ステージURL**: 過去の探索と同じ理由(1回のPRには大きい/困りごとが弱い/学習の中身が増えない)

## 背景・目的

- 採点はルールベースで、今は13種類(`src/domain/scoring/score.ts` の `ScoreRule`。`duplicate-code-scoring`・`inline-method-stage` のマージ後は15種類)。
  画面に出るのは `StagePanel.tsx` 105〜107行目の1行(`70点(行数 -10 / 結合度 -10 / 責務の混在 -10)`)だけで、**操作の前後で何が変わったか**は
  プレイヤーが頭の中で見比べるしかない
- リファクタリングの手には**トレードオフ**がある。Move Method で責務の混在が1件減る代わりに結合度が1件増える、private メソッドを移すと
  アクセス制御の違反が増える、など。減点が1つ消えて別の1つが増えると、**合計点も1行の文字数もほとんど変わらず、変化に気づけない**
- これは既存の仕様が狙った学びそのものでもある。`docs/specs/visibility-scoring.md` 9行目は「Move Method で private メソッドを別クラスへ移すと…
  自然に減点される、という相互作用を作ること。これにより『このメソッドは本当にこのクラスにあるべきか』をプレイヤーに意識させる」と書いているが、
  その相互作用を**その場で**伝える表示が無い
- 対象プレイヤー(新卒〜4年目)にとって「この1手は良かったのか」をすぐ返すことは、ルールの意味を操作と結び付けて覚える一番の近道になる
  (例: 「今の操作: 責務の混在 −1件、結合度 +1件(±0点)」)

ponytail の階段では「このリポジトリにもうあるか?」でほぼ止まる見込み:

- 点数は `scoreCodebase`(`score.ts`)がルールごとの `count` 付きで返しているので、**前後の `Score` を比べるだけ**でルールごとの増減が出る。
  新しい採点ロジック・型・ストアの状態は要らない見込み
- 「前」の点数はコンポーネントの中で直前の値を覚えておけば取れる(`useRef` など)。ストアの `history.past.at(-1)`(`history.ts`)を使う手もある。
  どちらにするかは仕様設計で決める
- ルール名の文言は `describeScore.ts` の `RULE_LABEL` をそのまま使える(ルールが増えても自動で追従する)

## 関連する既存コード

- `src/domain/scoring/score.ts` — `Score`・`ScoreDeduction`(`rule`・`count`・`points`)・`scoreCodebase`。**読むだけ**
- `src/presentation/stage/describeScore.ts` — `RULE_LABEL`・`describeScore`(今の1行の文言)。**読むだけ**の想定(`score-deduction-locations` が関数を足す予定)
- `src/presentation/stage/StagePanel.tsx` 75〜133行目 — 点数の計算(88行目、`changeSession?.base ?? codebase` で数える)と表示(105〜107行目、`aria-live="polite"`)。
  表示を差し込む先の第一候補(下の衝突の見立て)
- `src/presentation/store/useGameStore.ts` — `codebase`・`stage`・`changeSession`・`history`。`commit`(136〜140行目)は**コードベースが変わったときだけ**履歴を積む。
  `resetStage`(402〜406行目)も `commit` を通る(元に戻せる1手)。`selectStage`(407〜410行目)は履歴を空にする。**読むだけ**
- `src/domain/codebase/history.ts` — `past`/`future` のスナップショット。「前」を履歴から取る場合の参考。**読むだけ**
- `src/presentation/blank/BlankDesignPanel.tsx` — 白紙設計は点数を出さず「未配置の数」だけ。本件の対象外にする見込み
- `e2e/refactor.spec.ts` — `getByTestId('score')` の文言を確かめるテストが25か所ある。**`data-testid="score"` の中身は変えない**前提にする
- `docs/specs/visibility-scoring.md` 9行目 — 本件が支える「相互作用に気づかせる」狙い

## スコープの見立て

小さい。1回のPRに十分収まる。

1. **今回やる**:
   - 前後の `Score` からルールごとの件数の増減を出し、文にする純粋関数(+Vitest。AAA)。置き場所は `src/domain/scoring/` の新しいファイルか、
     `src/presentation/stage/` の新しいファイル(`describeScore.ts` には足さない)
   - リファクタリング画面で、コードベースが変わる操作のあとに、その1手での増減を短く出す小さなコンポーネント(新しいファイル)と、それを置く数行
   - E2E(新しい spec ファイル。例 `e2e/score-change-feedback.spec.ts`): チュートリアル2で税の計算を抽出 → TaxCalculator へ移すと、
     「責務の混在」「空のクラス・ファイル」が減ったことが出る、程度
2. **後回し**:
   - 白紙設計・変更依頼の実装中への表示(白紙設計は点数を出していない。実装中は点数を挑戦前のコードで数えているので変わらない)
   - 増減の原因の名前(どのクラスか)まで出すこと(`score-deduction-locations` のマージ後、その `findViolationTargets` を使えば足せる)
   - キャンバス上の該当クラスを一瞬光らせるなどの演出

仕様設計者に決めてほしい論点(ここでは決めない):

- **「前」の取り方**: コンポーネント内で直前の点数を覚えるか、`history.past.at(-1)` を採点し直すか。Undo/Redo(`travelTo`)・「最初に戻す」
  (`commit` を通る)・ステージの切り替え(`selectStage`。前後で題材が違うので比べない)・変更依頼の開始/終了(`changeSession` の出入りで
  数える対象が `base` と `codebase` で入れ替わる)のそれぞれで、出すか・消すか・何と比べるか
- **文言**: 「今の操作: 責務の混在 −1件、結合度 +1件(±0点)」のように件数と点数の両方を出すか。変化が無い1手(名前の変更など)では何も出さないか
  「点数は変わりませんでした」と出すか。点数が下がった1手を責める言い方にしない(トレードオフは正常な手である)工夫
- **置き場所と消え方**: 点数の1行のそば(ステージ欄)か、別の場所か。次の操作まで出したままにするか、数秒で消すか
  (消える表示はアクセシビリティ上避けたい。WCAG 2.2.1 の観点)
- **読み上げ**: 今の点数の1行はすでに `aria-live="polite"` で毎回読まれる。増減の文も読ませるか(二重に読まれないようにする)、
  点数の1行の読み上げを増減の文に置き換えるか
- **E2E の確かめ方**: 既存の `data-testid="score"` の中身・`aria-live` は変えず、新しい `data-testid` で確かめる形でよいか

### 既存パイプラインとの衝突可能性

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| 新規(純粋関数+`.test.ts`、表示用コンポーネント) | 増減の計算・文言・表示 | なし | なし |
| `src/presentation/stage/StagePanel.tsx` | import 1行と、コンポーネントを置く1〜3行 | `score-deduction-locations`(`score` の `<div>` の**直後**に一覧)、`stage-rules-summary`(`goal` の `<p>` の直後に一覧)、`codebase-code-view`(`PreviewButtons` の中)、`critique-request-robustness`・`stage-draft-persistence`(周辺) | **ここが一番の衝突点**。`score` の `<div>`(105〜107行目)の中身は触らず、`score-deduction-locations` の差し込み位置(107行目の直後)と `stage-rules-summary` の差し込み位置(98行目の直後)の**どちらとも隣り合わない行**に置けば、テキスト上の競合は import 文の並び程度に抑えられる見込み。import 文(1〜9行目)は複数件が足すので、そこの競合はありうる(小さい。手で直せる) |
| `src/index.css` | 増減の文の見た目を数行(既存の `.stage-panel__hint-list` などを流用できれば0行) | 多数 | 追記位置の競合はありうる(小さい) |
| 新規 `e2e/<名前>.spec.ts` | E2E | なし | なし(`refactor.spec.ts` には追記しない) |

- **読むだけで変更しないファイル**: `score.ts`・`describeScore.ts`・`useGameStore.ts`・`history.ts`・`BlankDesignPanel.tsx`
- **触らないファイル**: `src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.ts`/`.test.ts` を含む)・
  `src/domain/` の既存ファイル(採点・操作)・`MethodEditor.tsx`・`CodebaseCanvas.tsx`・`MethodChip.tsx`・`ClassNode.tsx`・`App.tsx`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `duplicate-code-scoring`・`inline-method-stage`: `ScoreRule` が増えるが、本件は `deductions` を順に比べて `RULE_LABEL` で名前を引くだけなので、
    どちらが先にマージされても追従する(新ルールの `RULE_LABEL` はそれぞれの件が足す)
  - `score-deduction-locations`: `Score`・`ScoreDeduction` の型を変えないと02で明記している。マージ後は増減の原因の名前まで出せるようになる(後回し欄)
  - `stage-draft-persistence`: ステージを切り替えたとき・リロードで途中経過を復元したときに、復元前後の点数を「1手の増減」と誤って出さないこと
    (ステージの切り替えでは比べない、を仕様で決めておけば自然に守れる)
  - `stage-rules-summary`・`score-deduction-locations`: どちらもステージ欄に一覧を足すので、ステージ欄が縦に伸びる。本件の表示は1行に収め、
    見た目の置き場所を仕様設計で揃える
