# 機能探索: 設計くらべクイズに「データとふるまいの置き場所」の問題を足す

- slug: `data-placement-quizzes`
- 想定: 設計くらべクイズ(`docs/specs/design-comparison-quiz.md`)の5問目以降として、フィールドを持つ中級・上級ステージ
  (Feature Envy・ドメインモデル貧血症・Value Object・Extract Class)の初期コードと模範解答をくらべる問題を2〜3問足す

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

### 他の候補と見送った理由(参考)

- `template-method-stage`・`move-via-context-menu`・`move-class-via-context-menu`・`duplicate-code-scoring`・
  `blank-design-second-problem`・`inline-method-stage`・`utils-class-split-stage` は進行中か完了済みなので対象外。
- 新しいステージの追加: `beginnerStages.ts`(`utils-class-split-stage`)・`intermediateStages.ts`(`inline-method-stage`)・
  `advancedStages.ts`(`template-method-stage`)がすべて埋まっており、どれも `sampleAnswer.ts` にも1件ずつ足す予定。
  4件目を重ねると衝突しやすい。空いている `tutorialStages.ts` には、今のチュートリアル2件(Extract Method・用意されたクラスへの Move)に
  続く題材として足りないものが見当たらなかった(命名などは新しい採点ルールが要り、`score.ts` を触ることになる)。
- 新しい採点ルール: `score.ts` / `RULE_LABEL` は `duplicate-code-scoring`・`inline-method-stage` の2件が触る予定なので、3件目は重ねない。
- Observer・Facade: 過去に見送り済み(`docs/specs/advanced-discount-strategy.md` の Observer 不採用の理由、
  `docs/pipeline/utils-class-split-stage/01-discovered.md` の Facade の理由)。
- クイズの正解数の保存・VSCode風ファイルツリー: 過去の探索と同じ理由で見送る(学習の中身が増えない/1回のPRには大きい)。

## 背景・目的

- 設計くらべクイズは「直す」ではなく「**見分ける**」を練習する唯一のモードで、レビューや設計相談で2案のどちらが良いかを
  判断する力を狙っている(`design-comparison-quiz.md`)。ところが今の4問は、次の観点しか扱っていない:
  - 1問目: 何でも屋のクラスを分けるか(初級1)
  - 2・3問目: よく変わる所を閉じ込める(中級4・5)
  - 4問目: 子が1つしかない継承(上級5)
- クイズを作った後で、**フィールド**(`fields-and-feature-envy.md`)と、それを使うステージ
  (中級6 Feature Envy、中級7 getter/setter だけの口座クラス、中級8 Extract Class、上級7 Money)が入ったが、
  クイズにはそれらの観点が1問も無い。新卒〜4年目のコードレビューで最もよく指摘されるのは
  「そのロジックはデータを持っているクラスに置くべき」「getter で取り出して外で計算しない」「金額と通貨をばらばらに持たない」の類で、
  ゲームの中では直す練習しかできず、2案を見比べて判断する練習ができない。
- 仕組みは揃っている:
  - クイズの設計は既存ステージの初期コードと `sampleAnswerCodebase(stage)` から作る(新しい設計データを手で書かない)
  - 読み取り専用キャンバス `PreviewClassNode` は既にフィールドを表示する
  - `ComparisonQuizView` は `comparisonQuizzes` の件数に依存しない(選択欄・「次のクイズへ」は配列から作る)
  - 各ステージのテストに、変更依頼ごとの点数(`scoreChange`)の前後が既に書かれており、答えが明確(5点以上の差)になる見込みがある:
    - 中級6 `featureEnvyStage.test.ts`: 2件とも 75 → 95
    - 中級7 `anemicDomainModelStage.test.ts`: [70, 60] → [85, 80]
    - 中級8 `extractClassStage.test.ts`: [90, 70] → [100, 85]
    - 上級7 `valueObjectStage.test.ts`: [45, 35] → [85, 85]

## 関連する既存コード

- `src/infrastructure/quizzes/comparisonQuizzes.ts` — クイズの一覧。**問題を足すのはこのファイルの配列の末尾**
- `src/infrastructure/quizzes/comparisonQuizzes.test.ts` — 全問共通の制約(IDの重複なし・引き分けなし・両方の設計に変更箇所がある・
  スコア差5点以上・正解が全問同じ側に偏らない)。`describe.each` なので、問題を足せば自動で対象になる
- `src/domain/quiz/judgeComparison.ts` / `ComparisonQuiz.ts` — 判定と型。変更不要の見込み
- `src/domain/stage/sampleAnswer.ts` — `sampleAnswerCodebase` を**呼ぶだけ**(編集しない)
- `src/infrastructure/stages/intermediateStages.ts`(`intermediate-feature-envy`・`intermediate-anemic-domain-model`・`intermediate-extract-class`)、
  `src/infrastructure/stages/advancedStages.ts`(`advanced-value-object`) — 設計と変更依頼の元。**参照のみで編集しない**
- `src/infrastructure/stages/featureEnvyStage.test.ts` / `anemicDomainModelStage.test.ts` / `extractClassStage.test.ts` / `valueObjectStage.test.ts`
  — 変更依頼ごとの点数の前後(上記)
- `src/presentation/preview/PreviewClassNode.tsx` — クイズのキャンバス。フィールドは出るが、どのメソッドがどのフィールドを読むかは出ない
- `src/presentation/quiz/ComparisonQuizView.tsx` / `src/presentation/change/describeChange.ts` — 答え合わせの表示(変更が必要なメソッド名・減点理由)
- `docs/specs/design-comparison-quiz.md` — クイズ本体の仕様。`docs/specs/lone-superclass-scoring.md` の「設計くらべクイズの4問目」が1問足した前例
- `docs/specs/implement-change-request.md` — 機能追加型の依頼(`kind: 'extend'`)はクイズで使っていない、という前提の記述
- `e2e/quiz.spec.ts` — 既存のクイズE2E(1問目・2問目の見出しを参照している)

## 衝突の見立て

- ステージデータファイル(`tutorial/beginner/intermediate/advancedStages.ts`): **編集しない**。中級6・7・8と上級7を読むだけ。
  ただし `inline-method-stage` が `intermediateStages.ts`、`template-method-stage` が `advancedStages.ts` に新ステージを足すので、
  もしそれらが既存ステージ(中級6〜8・上級7)のデータまで変えると、このクイズの点数が動く。追加だけなら影響しない
- `score.ts` / `RULE_LABEL`: **触らない**。クイズの判定は `scoreChange`(変更依頼の点数)だけを使い、`scoreCodebase` の減点ルールの追加
  (`duplicate-code-scoring`・`inline-method-stage`)の影響を受けない
- `sampleAnswer.ts`: **触らない**(`sampleAnswerCodebase` を呼ぶだけ)。ただし他のパイプラインが中級6〜8・上級7の模範解答の手順を変えると、
  設計の中身が変わる
- `comparisonQuizzes.ts`: 今は他のパイプラインが触る予定は無い。`inline-method-stage`・`utils-class-split-stage` は
  「クイズへの追加は後回し」としており、将来同じ配列の末尾に足す可能性がある

## スコープの見立て

- `comparisonQuizzes.ts` に2〜3問を足し、必要なら `comparisonQuizzes.test.ts` に個別の確認を足すだけ。domain/application のロジック変更・
  新しい操作・新しいUIは要らない見込みで、1回のPRで十分に収まる。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - **どのステージを何問使うか**。候補は中級6・7・8と上級7の4つ。観点が被るもの(中級6と中級7はどちらも「データを持つクラスにふるまいを寄せる」)を
    両方入れるか、1問に絞るか
  - **使う変更依頼**。どれも `kind` が省略(`'modify'`)であることを確かめる。各ステージの2件のうち、差がはっきりしてプレイヤーが直感的に分かる方を選ぶ
  - **設計A・Bの並べ方**。既存4問は正解が A, B, A, B。新しい問題でも片側に偏らないようにする
  - **キャンバスだけで判断できるか**。プレビューはフィールドを出すが、どのメソッドがどのフィールドを読み書きするかは出ない。
    description・設計の label で補えば足りるか。キャンバスの表示を足す必要があるなら、このPRではやらず別件に分ける
  - explanation の文。既存の問題に合わせ、実際の点数・行数(「+◯行」など)と食い違わない文にする
  - E2Eを足すか(操作は変わらないので不要の見込み。足すなら選択欄から新しい問題を選べることの確認程度)
- 大きくなりそうなら次のように割る:
  1. 今回: Feature Envy 系(中級6か7)と Value Object(上級7)の2問
  2. 後回し: Extract Class(中級8)の問題、デザインパターン系(上級2・3・4・6)の問題
     (上級2・3の依頼には `kind: 'extend'` があり、`measureChange` だけで判定するクイズでは「新しいクラスを足すだけで済む」を表しにくいので、別途検討)
