# 機能探索: 何でも入った Utils クラスを、責務ごとのクラスとファイルへ分ける初級ステージ

- slug: `utils-class-split-stage`
- 想定タイトル: 「初級3: 何でも入った CommonUtils」(文言は仕様設計で決める)

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

### 他の候補と見送った理由(参考)

- `template-method-stage`・`move-via-context-menu`・`move-class-via-context-menu`・`duplicate-code-scoring`・
  `blank-design-second-problem`・`inline-method-stage` は進行中か完了済みなので対象外。
- 上級ステージの追加(Observer・Decorator など): `template-method-stage` が `advancedStages.ts` を触る予定で衝突しやすい。
- 中級ステージの追加: `inline-method-stage` が `intermediateStages.ts` を触る予定で衝突しやすい。
- 依存先が多すぎる司令塔クラスに Facade を挟むステージ: `coupling` を主題にするステージは今無いが、今の変更コストの測り方
  (`measureChange.ts`)では Facade を挟んでも触るブロック数が減らず、「模範解答で変更コストが下がる」
  (`stageCatalog.test.ts`)を満たす筋の良い題材にしにくい。また `blank-design-second-problem` が「司令塔クラスの依存先」を
  2問目の題材の候補に挙げており、観点が被りやすい。
- 新しい採点ルール(Middle Man・データクラスなど): 過去の探索と同じ理由で見送る(ゲーム内で直す操作が無い/新しい判定の設計から要る)。
  今は `score.ts` を `duplicate-code-scoring` と `inline-method-stage` の2件が触る予定なので、3件目は重ねない。
- 設計くらべクイズの正解数の保存(`design-comparison-quiz.md` のスコープ外): 小さくまとまるが、学習の中身は増えない。今回は見送る。
- VSCode風ファイルツリー: 新しいペインとドロップ先が要り、1回のPRには大きい(過去の探索と同じ判断)。

## 背景・目的

- **初級のステージが2件しかなく、中級(8件)・上級(7件)との段差が大きい。** 今の並びは次のとおり:
  - チュートリアル1・2: メソッド分け(Extract Method、用意されたクラスへの Move Method)
  - 初級1・2: クラス分け(用意されたクラスへ移す/「クラスを追加」して自分で受け皿を作る)
  - 中級1: いきなり循環依存
- CLAUDE.md の冒頭にある「メソッド分け・クラス分け・**ファイル分け**」のうち、ファイル分けを練習できるのは中級2
  (`intermediate-god-file`)だけで、しかも「private メソッドを持ち主へ返す」と組み合わさっている。初級2の模範解答
  (`sampleAnswer.ts`)も、新しいクラスを元のファイル `InvoiceService.ts` に置いたままで100点になる。
  初級のうちに「クラスを分けたら、ファイルも分ける」を1回通しで練習する場が無い。
- 題材として、新卒〜4年目が実務でいちばんやりがちな「共通っぽい処理はとりあえず `CommonUtils` / `XxxHelper` に置く」を使いたい。
  日付の整形・金額の整形・入力チェック・ファイル名の組み立て…が1クラス1ファイルに溜まり、あちこちのクラスから呼ばれている状態。
  - 責務の混在(`responsibility`)とファイルの行数(`line-limit`)で、既存の採点ルールだけで減点が出せる
  - 変更依頼の結果では、**波及(`rippleClasses`)**が効くはず: Utils を触ると、Utils を呼んでいる全クラスが波及先になる。
    責務ごとに分ければ、たとえば日付の整形を変えても、日付を使うクラスにしか波及しない。これは既存ステージ
    (初級1・2は呼び出し元が1クラス)では見せられていない「呼ばれる側を分けると波及が減る」の実感になる
  - 一方で、分けると呼び出し元の依存先が増える(`coupling`)という引っ張り合いもある。初級向けには、依存先の上限を
    素直に分ければ収まる値にしておき、「分けすぎて依存が増える」のは中級以降の論点として残す想定
- 新しい操作・採点ルール・UIは要らない見込み。必要な操作(Extract Method・「クラスを追加」・「ファイルを追加」・Move Method・
  クラスのファイル移動・名前の変更)と、模範解答のステップ(`addFile`・`addClass`・`move`・`moveClass`・`renameClass`・`renameFile`)は揃っている。

## 関連する既存コード

- `src/infrastructure/stages/beginnerStages.ts` — 初級1・2。**新ステージ(初級3の想定)を足すのはこのファイル**。
  進行中のパイプラインは、`template-method-stage` が `advancedStages.ts`、`inline-method-stage` が `intermediateStages.ts` を触る予定で、
  `beginnerStages.ts` を触るものは無い
- `src/infrastructure/stages/intermediateStages.ts` の中級2(`intermediate-god-file`) — ファイル分けの前例。観点が被りすぎないよう見比べる先(参照のみ)
- `src/infrastructure/stages/stageCatalog.ts` — 一覧の並び(チュートリアル → 初級 → 中級 → 上級)。`beginnerStages` の末尾に足せば中級1より前に並ぶ
- `src/infrastructure/stages/stageCatalog.test.ts` — 全ステージ共通の制約(80行以上のメソッドが1つ以上、行数上限は メソッド < クラス < ファイル、
  初期は減点あり、模範解答で100点、変更依頼2件以上、模範解答で変更コストが下がる、変更が必要なクラス数が増えない)と、
  狙いを飛ばした近道の一覧 `shortcuts`
- `src/domain/stage/sampleAnswer.ts` — `sampleAnswerSteps`(キーはステージID)。模範解答を1件足す場所。
  **`template-method-stage`・`inline-method-stage` もこのオブジェクトに1件ずつ足す予定**なので、`'beginner-invoice-service'` の直後に置けば
  追加位置が離れて衝突しにくい
- `src/domain/change/measureChange.ts` — 変更コストの内訳(`rippleClasses`・`mixedResponsibilities`・`overLimitTouched` など)。
  分ける前後で何が下がるかの試算に使う
- `src/domain/codebase/dependencies.ts` — `classDependencies`。複数の呼び出し元から Utils を呼ぶ形(`uses`)の依存・結合度の数え方
- `src/domain/scoring/score.ts` / `responsibilities.ts` / `lineLimits.ts` — 今回は**変更しない**(既存ルールの減点だけで作る)
- `src/presentation/stage/describeSolutionStep.ts` — 行き詰まりヒントの文。既存のステップ種別だけで足りるなら変更不要の見込み
- `src/infrastructure/quizzes/comparisonQuizzes.ts` — 設計くらべクイズ。今回は足さない想定(下記)
- `docs/specs/volatility-axis-stages.md` — 「波及の採点は呼ばれている側にしか付かない」という既知の性質(誰からも呼ばれないクラスへ
  よく変わる処理を寄せると満点になりうる)。Utils の題材は「呼ばれる側」を分けるので相性は良いが、近道の確認に使う

## スコープの見立て

- ステージデータ1件(`beginnerStages.ts`)+ 模範解答1件(`sampleAnswer.ts`)+ 必要なら近道テスト(`stageCatalog.test.ts` の `shortcuts`)と
  ステージ固有のテスト。`domain`/`application` 層のロジック変更と、新しいプレイヤー操作は無い見込みで、1回のPRで十分収まる。
  E2Eは既存の操作を使うだけなので、追加が要るかは仕様設計で判断する(ステージ選択欄で選べることの確認程度)。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - **題材と数値**。Utils に入れる責務の種類数、呼び出し元のクラス数、行数の上限、`responsibilityLimit`・`dependencyLimit`。
    「80行以上のメソッドが1つ以上ある」を、小さなメソッドが並びがちな Utils の題材とどう両立させるか
    (例: 呼び出し元に長いメソッドを置く/Utils にも抽出が要る長いメソッドを1つ置く)
  - **ファイル分けを必須にするか**。クラスを分けても同じファイルに置いたままだと100点にならない数値(ファイルの行数上限)にするか。
    初級2との違い(自分でファイルも分ける)を出すなら必須にしたいが、初級の難しさとして重すぎないか
  - 分けたクラスの置き場所(ディレクトリ)と名前をプレイヤーに任せるか。名前の変更(`renameClass`/`renameFile`)を解き方に含めるか
  - **呼び出し元の依存先が増える**ことの扱い。`dependencyLimit` をどの値にすれば「素直に責務ごとに分ければ収まり、
    Utils のまま・何もかも1クラスに戻す近道では満点にならない」になるか
  - 変更依頼(2件以上)の中身と、模範解答で `rippleClasses`(波及)が確かに減ることの試算
  - 近道の一覧(`shortcuts`)に何を足すか(例: 責務ごとにクラスは分けたがファイルは分けない/呼び出し元へ全部移して Utils を消す)
  - **進行中パイプラインとの順序**: `duplicate-code-scoring`・`inline-method-stage` が `score.ts` に新しい減点を足した場合も、
    このステージの模範解答が100点のままであること。特に `inline-method-stage` の「分けすぎ」の定義しだいでは、Utils を分けた後の
    小さなメソッド(1〜数行・呼び出し元1か所)が減点される恐れがある。どちらが先にマージされても通る数値にしておく
    (このステージ自体は `score.ts` / `RULE_LABEL` を触らない)
- 大きくなりそうなら次のように割る:
  1. 今回: ステージデータ・模範解答・近道テスト
  2. 後回し: 設計くらべクイズへの追加、行き詰まりヒントの言い回しの調整、「分けすぎて依存が増える」を扱う続編ステージ
