# 機能探索: 知り合いの知り合いに話しかけるメソッドを、委譲の鎖へ組み替える中級ステージ(デメテルの法則 / Hide Delegate)

- slug: `law-of-demeter-stage`
- 想定タイトル: 「中級N: order.getCustomer().getAddress()… と奥まで手を伸ばす配送料の計算」(番号と文言は仕様設計で決める。
  中級9は `inline-method-stage` が使う予定なので、マージ順しだいで中級10以降になる)

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かったため)。

過去の探索で、**題材としては足りないと認められながら、ファイルの衝突だけを理由に5回見送られてきた**候補を採る:

- `color-contrast-a11y/01-discovered.md` 60行目: 「デメテルの法則(Hide Delegate)の中級ステージ: 題材としては足りていないが、ステージ追加は必ず `sampleAnswer.ts` に模範解答を足す必要がある…ため、今回は避ける」
- `stage-rules-summary`・`critique-worker-hardening`・`quiz-change-site-marks`・`identifier-name-validation`・`operation-guide` の各 01-discovered.md でも同じ理由で見送り

今回は、ステージデータを**新しいファイル**に置き、`sampleAnswer.ts` への追加位置を他の件と離すことで、衝突を「1行・1エントリの追記」に抑えられると判断した(下の「既存パイプラインとの衝突の見立て」)。

### 重複していないことの確認

- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 21件を `デメテル|Demeter|Hide Delegate|列車事故|Message Chain` でgrepし、主題にしたものは無い(見送り候補として名前が出ているだけ)
- 既存ステージ(`src/infrastructure/stages/`)にも、2段以上の getter をたどる題材は無い。一番近いのは次の2つだが、どちらも**直接の相手1段**の話:
  - 中級6(`intermediate-feature-envy`): BillingService が Subscription の public フィールドを直接触る(Tell, Don't Ask)
  - 中級7(`intermediate-anemic-domain-model`): AccountService が Account の getter/setter 越しに触る
  - 本件は「相手が返したオブジェクトの、さらに先のオブジェクトの中身まで知っている」**推移的な結合**が主題で、直し方も「データの持ち主へ1回移す」ではなく「各クラスが直接の知り合いにだけ頼む委譲の鎖を、奥から順に作る」になる
- 呼び出し元が列挙した21件のslugのどれとも主題が重ならない

### 検討して見送った候補

- **行き詰まりヒントを今のコードの進み具合に合わせる(済みの手に印・次の手へ飛ぶ)**: `HintPanel.tsx` はどの件も触らない空き地だが、
  `docs/specs/stuck-player-hints.md` が「今のコードベースの状態とヒントの手順を突き合わせる診断はしない(YAGNI)」と明示的に決めている。
  また模範解答の手は名前で指定するので、プレイヤーが別名で抽出すると「済み」の判定が外れて混乱を招く
- **Decorator・Observer の上級ステージ**: 過去の見送り理由(衝突)に加えて、今回コードを読んで**操作の側で作れない**ことが分かった。
  `extractMethod`(`src/domain/codebase/extractMethod.ts`)は必ず「元のメソッドが新しいメソッドを呼ぶ」形になるため、
  「新しいクラスが元のクラスを包んで呼ぶ」向きの依存は作れない
- **Push Down Method(親の、1つの子しか使わないメソッドを子へ下ろす)**: 新しい採点ルールの設計から要る。`score.ts` は
  `duplicate-code-scoring`・`inline-method-stage` の2件が末尾に追記する予定で、3件目は重ねない
- **React Flow 標準の `MiniMap` をキャンバスに足す**: 数行で済むが、`CodebaseCanvas.tsx` は `class-dependency-focus` などが触る予定。
  ファイルが増えるたびに `fitView` し直しているので、困りごととしても弱い
- **100点にしたときの「最初の状態からの変化」(メソッド数・最長メソッドの行数など)の要約**: `StagePanel.tsx` が
  `score-deduction-locations`・`stage-rules-summary`・`stage-draft-persistence` から触られる予定で、競合が大きい
- **VSCode風ファイルツリー・ステージ選択のUX・クイズの正解数の保存**: 過去の探索と同じ理由(1回のPRには大きい/学習の中身が増えない)

## 背景・目的

- 新卒〜4年目が実務で最もよく書き、レビューで最もよく指摘されるコードの1つが
  `order.getCustomer().getAddress().getPrefecture()` のような**メッセージチェーン(列車事故)**である。
  呼び出し側が Order・Customer・Address の3クラスの構造を全部知っているので、住所の持ち方を変えるだけで、住所と関係なさそうな
  配送料の計算・請求書の印刷・ラベルの作成まで直す羽目になる。
- このゲームには、この「推移的な結合」を体験させるステージが無い。中級6・7は Tell, Don't Ask を**1段**で教えるが、
  「直接の知り合いにだけ話しかける(デメテルの法則)」「知り合いに、その先の相手への取り次ぎを頼む(Hide Delegate)」は未着手。
  中級6・7を解いたプレイヤーが次に進む段として自然につながる。
- **新しい操作・採点ルール・UIは要らない見込み**(コードを読んで確かめた範囲):
  - 題材の表現: `Fragment.uses` で getter を呼び、getter は `accessor: true`(`src/domain/codebase/Codebase.ts`)で表せる。
    `accessorFieldAccess` は getter を1段だけたどる(ponytail コメント)が、本件は「getter が getter を呼ぶ」形ではなく
    「呼び出し側が getter を3回呼ぶ」形なので、この上限に当たらない
  - 減点: 呼び出し側の依存先が3クラスになるので結合度(`coupling`、`dependencyLimit`)で減点できる。
    Address の getter を2つ以上読めば、既存の Feature Envy(`fieldAccess.ts`)も効く見込み
  - 直し方: 既存の Extract Method・Move Method の組み合わせで作れる。奥(Address)から順に
    「Address の中身を読んで判断する処理」を抽出して Address へ移し、次に「Customer から住所を取り出して、その判断を頼む処理
    (+前の手で残った呼び出し行)」を抽出して Customer へ移し…と積み上げると、呼び出し側は Order だけに依存する。
    `extractMethod` は呼び出し行(`<id>:call`)も選んで抽出でき、`moveMethod` に可視性の制約は無い
  - 模範解答の手順: `extract`・`move`・`changeVisibility` だけで書ける(`SolutionStep` の型を増やさない)。
    行き詰まりヒント(`describeSolutionStep.ts`)も既存の文言のままで出せる
- ゲームの核である「新機能の追加で何個のブロックを触るか」とも相性が良い。住所の構造の変更依頼に対して、
  列車事故のままだと住所の知識が呼び出し側に散らばり(`classesTouched`・`mixedResponsibilities`)、委譲の鎖にすれば Address だけで済む、
  という差を `measureChange.ts` の指標で見せられる見込み(数値は仕様設計で試算する)

## 関連する既存コード

- `src/infrastructure/stages/intermediateStages.ts` — 中級6・7(Tell, Don't Ask の1段版)。フィールド・getter(`accessor: true`)の書き方の前例。**読むだけ**
- `src/infrastructure/stages/stageCatalog.ts` — ステージの並び。新しいステージを中級の後ろ・上級の前に差し込む先の候補
- `src/infrastructure/stages/stageCatalog.test.ts` — 全ステージ共通の制約(80行以上のメソッドが1つ以上、行数上限は メソッド < クラス < ファイル、
  初期は減点あり、模範解答で100点、変更依頼2件以上、模範解答で変更コストが下がる、変更が必要なクラス数が増えない、近道 `shortcuts`)。
  新ステージは `stages` に入れば自動で検査対象になる
- `src/infrastructure/stages/featureEnvyStage.test.ts` / `anemicDomainModelStage.test.ts` — ステージ固有のテスト(近道で満点にならない等)を別ファイルに置いた前例
- `src/domain/stage/sampleAnswer.ts` — `sampleAnswerSteps` に模範解答を1件足す。`extract` の `fragmentIds` には、前の手で残った
  呼び出し行 `solution-<n>:call` も書ける
- `src/domain/codebase/Codebase.ts` — `Fragment.uses` / `reads` / `accessor`、`isAccessorMethod`、`accessorFieldAccess`
- `src/domain/codebase/dependencies.ts` — `classDependencies`(`uses` と `reads`/`writes` から依存を出す)
- `src/domain/scoring/score.ts` / `fieldAccess.ts` / `cohesion.ts` — 結合度・Feature Envy・凝集度。**変更しない**(既存ルールの減点だけで作る)
- `src/domain/change/measureChange.ts` — 変更コストの内訳。列車事故のままと委譲の鎖とで何が下がるかの試算に使う
- `docs/specs/fields-and-feature-envy.md` / `docs/specs/cohesion-value-object-anemic.md` — フィールド・getter・Feature Envy を導入した仕様。
  中級6・7との観点の分け方の参考

## スコープの見立て

- ステージデータ1件(新規ファイル)+ ステージ一覧への1行 + 模範解答1件 + ステージ固有のテスト(新規ファイル)。
  `domain`/`application` 層のロジック変更と、新しいプレイヤー操作・UI は無い見込みで、1回のPRに収まる。
  E2E は既存の操作だけで解けるので原則不要(要るかは仕様設計で判断。ステージ選択欄で選べることの確認程度)。
- 大きくなりそうなら次のように割る:
  1. 今回: ステージデータ・模範解答・近道のテスト
  2. 後回し: 設計くらべクイズへの追加(「列車事故 vs 委譲の鎖」)、AI講評での言い回しの調整

### 既存パイプラインとの衝突の見立て

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| 新規 `src/infrastructure/stages/<名前>Stage.ts` | ステージデータ | なし | なし |
| 新規 `src/infrastructure/stages/<名前>Stage.test.ts` | 近道・変更コストのテスト | なし | なし |
| `src/infrastructure/stages/stageCatalog.ts` | import と配列への1要素(中級の後ろ・上級の前) | なし(`utils-class-split-stage` は「変更しない」と明記、`inline-method-stage` は `intermediateStages.ts` の末尾に足す) | ほぼなし |
| `src/domain/stage/sampleAnswer.ts` | `sampleAnswerSteps` に1エントリ | `template-method-stage`(末尾に追加)、`inline-method-stage`(`SolutionStep` の型・`applyStep`・中級のエントリ)、`utils-class-split-stage`(`'beginner-invoice-service'` の直後) | **追加位置を `'intermediate-volatile-format'` の直後にすれば、どの件とも行が隣り合わない**。型・`applyStep` は触らない |

- **触らないと決めておくファイル**: `intermediateStages.ts`(`inline-method-stage`・`blank-design-second-problem` が触る)・
  `advancedStages.ts`・`stageCatalog.test.ts`(`inline-method-stage`・`utils-class-split-stage` が `shortcuts` に追記する予定。
  本件の近道は新規のステージ固有テストに書く)・`score.ts`・`describeScore.ts`・`describeSolutionStep.ts`・`StagePanel.tsx`・`useGameStore.ts`
- **採点ルールの追加との順序(内容面の衝突)**:
  - `inline-method-stage` の「分けすぎ」(`over-split`: private・呼び出し行 `<id>:call` あり・そこ以外から呼ばれない・5行以下)は、
    本件の模範解答で作る**取り次ぐだけの小さなメソッド**(例: 住所を取り出して1行で Address に頼む)にそのまま当たりうる。
    どちらが先にマージされても模範解答が100点のままになるよう、取り次ぐメソッドを public にする手(`changeVisibility`)を模範解答に含めるか、
    中身を5行より大きくしておく必要がある
  - `duplicate-code-scoring`: 題材に `duplicateGroup` を使わなければ影響しない
  - `stage-reference-integrity`・`critique-worker-hardening`: 全ステージを自動で検査するテストを足す予定。新ステージも対象に入るので、
    `uses`/`reads` の参照先を切らさないこと(本件にとってはむしろ安全網)
- **仕様設計者に決めてほしい論点**(ここでは決めない):
  - 題材と数値: 呼び出し側のクラス(配送料の計算だけか、請求書・配送ラベルなど複数か)、鎖の長さ(Order → Customer → Address の3段で足りるか)、
    `dependencyLimit`・`responsibilityLimit`・行数の上限、`visibilityEnforced` を付けるか
  - **推移的な結合の悪さが変更コストに出るか**の試算。`measureChange` は責務(`responsibility`)ごとの変更箇所で測るので、
    呼び出し側が1つだけだと「触るクラス数」は列車事故のままでも1のまま変わらないおそれがある。呼び出し側を複数にする、
    行数の上限・責務の混在で差を付けるなど、「模範解答で変更コストが下がる」を満たす形を決める
  - 中級6・7の「データの持ち主へ1回移す」だけで満点になってしまわないか(例: 呼び出し側の処理を丸ごと Address へ移す近道)。
    近道の一覧と、それを100点にしない数値
  - Hide Delegate の結果として Order・Customer に取り次ぐメソッドが増えることと、凝集度(`cohesion.ts`)の採点との兼ね合い
  - ステージの番号(中級9は `inline-method-stage` が使う予定)と、ステージ一覧のどこに並べるか
