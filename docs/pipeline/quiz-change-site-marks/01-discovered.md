# 01 機能探索: 設計くらべの答え合わせで、「変更が必要なメソッド」を設計A・Bの図の上に印で示す

- slug: `quiz-change-site-marks`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

## 背景・目的

CLAUDE.md の中心の考え方は「新機能の追加課題を出し、**何個のブロックを触る必要があったか**で設計の良し悪しを実感させる」ことである。
これをいちばん短い手数で体験させるのが設計くらべクイズ(`docs/specs/design-comparison-quiz.md`)で、1問が数十秒で終わる。

ところが今のクイズの答え合わせは、触る必要があったブロックを**文字でしか**見せていない。

- `ComparisonQuizView.tsx` の `DesignResult` は「変更が必要: `siteNames(...)`(Nクラス・Nファイル・+N行)」を図の**下**に1行の文で出すだけ
- 図(`CodebasePreviewCanvas` → `PreviewClassNode`)は回答の前後で何も変わらない。プレイヤーは文に出たメソッド名を、
  自分で左右の図から探して見比べることになる
- 一方でリファクタリング画面では、変更依頼に挑戦したあと、キャンバスのメソッドに「変更×N」の印(`MethodChipView` の `changeCount`、
  `data-testid="change-site-badge"`)がすでに出る(`MethodChip.tsx` 47〜52行目)。**同じ印の部品が、クイズの図では使われていない**

答え合わせのときに、設計A・Bそれぞれの図の上で「ここを触る必要があった」メソッドに同じ印を付ければ、
「Aは1か所、Bは3クラスに散らばっている」が図を見ただけで分かる。新卒〜4年目のプレイヤーにとって、散らばり(Shotgun Surgery)や
巻き込みは文で読むより図で見るほうが体感しやすく、ゲームの中心の学びに直結する。

既存の部品(`judgeComparison` が返す `assessments[choice].impact.sites`、`MethodChipView` の `changeCount`、`.method-chip__badge` のCSS)を
つなぐだけで実現でき、ドメインの変更は要らない見込み(ponytail の「このリポジトリにもうあるか?」で止まる)。

### 既存テーマとの重複確認

- `docs/specs/design-comparison-quiz.md`: 答え合わせは「変更が必要なメソッド名・クラス数・ファイル数・スコア」と減点理由を**文で**出す仕様。
  図への印は仕様にもスコープ外にも書かれていない → 今回はその表示を図に広げるもので、重複しない
- `data-placement-quizzes`(02完了): クイズの**問題データ**を足すだけで、02で「domain / application / presentation は変更しない。
  `ComparisonQuizView`・`PreviewClassNode`・`CodebasePreviewCanvas` はそのまま使う」と明記 → 重複しない(むしろ増えた問題でも印が出る)
- `class-dependency-focus`(02完了): メインのキャンバスで**依存の矢印**を強調する。02で「変更前の図・解答例の図・設計くらべ
  (`CodebasePreviewCanvas.tsx`)への同じ強調はスコープ外」と明記。今回は矢印ではなくメソッドの印で、対象も読み取り専用の図 → 重複しない
- `method-call-references`(02完了): メソッドエディタに呼び出し関係を出す。02で「設計くらべ(`PreviewClassNode`)には出さない」と明記 → 重複しない
- `score-deduction-locations`(02完了): リファクタリング画面の**採点**の減点原因をクラス・メソッド名で出す。クイズの変更依頼の結果とは別物
- `color-contrast-a11y`(02完了): `.method-chip__badge` の色のコントラストを直す。今回はその印を別の場所でも出すだけで、色は変えない
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 17件に、クイズの図の上に変更箇所を示すものは無い
  (`クイズ`/`設計くらべ` と `印`/`ハイライト`/`強調`/`バッジ` でgrep。該当は `class-dependency-focus` のスコープ外の1行だけ)

### 検討して見送った候補

- **新ステージ(デメテルの法則・Observer・Facade など)**: 過去の探索と同じく、`sampleAnswer.ts` への模範解答の追加が必須で、
  `template-method-stage`・`inline-method-stage`・`utils-class-split-stage` が同じファイルに手を入れる予定
- **VSCode風ファイルツリー(CLAUDE.md の「予定」)**: 過去の探索と同じ理由(新しいペイン・dnd-kitのドロップ先・E2Eが要り、1回のPRには大きい)
- **行き詰まりヒント(`HintPanel`)・進捗の保存のE2Eが無い**: `e2e/` に `ヒント`・`reload` を扱うテストが無いのは事実だが、機能の追加ではなく
  テストの穴埋めで学習の中身が増えない。`stage-draft-persistence` が保存まわりのE2Eを足す可能性もある
- **ステージを100点にしたあとの「このステージで学んだ設計原則」の解説**: `Stage` 型と全ステージ定義に項目を足し、`StagePanel.tsx`
  (`score-deduction-locations` などが触る予定)に表示を足す必要があり、競合が大きい
- **白紙設計の答え合わせ・変更依頼の「解答例の図」にも同じ印を出す**: 同じ部品で出せるが、`BlankDesignResultPanel.tsx` は
  `blank-design-second-problem` が、`ChangeRequestPanel.tsx` は他の件がスコープ外として言及している。今回はクイズに絞り、
  要望が出てから広げる(下の「スコープの見立て」の後回しを参照)
- **履歴(Undo)の長さの上限**(`history.ts` の ponytail コメント): 実害が報告されておらず YAGNI

## 関連する既存コード

- `src/presentation/quiz/ComparisonQuizView.tsx` — 主な変更先。`DesignPanel`(47行目で `CodebasePreviewCanvas` を描く)に
  回答後の `verdict` がすでに渡っている。`DesignResult`(24行目)が `siteNames(assessment, codebase)` で文の一覧を出している
- `src/domain/quiz/judgeComparison.ts` — `ComparisonVerdict.assessments[choice]`(`ChangeAssessment`)を返す。読むだけ
- `src/domain/change/measureChange.ts` / `scoreChange.ts` — `ChangeAssessment.impact.sites`(変更が必要なメソッドのID)・
  `rippleClasses`(影響を受けるクラスのID)の出どころ。読むだけ
- `src/presentation/preview/CodebasePreviewCanvas.tsx` — 読み取り専用のキャンバス。今の props は `codebase`・`methodLimit`・`wheelZoom`
- `src/presentation/preview/CodebasePreviewContext.ts` — プレビュー用ノードへ `codebase`・`methodLimit` を渡す Context。
  印を付けるメソッドの情報をノードへ渡す経路の候補
- `src/presentation/preview/PreviewClassNode.tsx` — `MethodChipView` を `method`・`overLimit` だけで呼んでいる(40行目)
- `src/presentation/canvas/MethodChip.tsx` — `MethodChipView` の `changeCount`(「変更×N」の印。`title` は「直前の変更依頼で、変更が必要だったメソッド」)。
  props はすでにあるので、**このファイルは変更不要の見込み**(`title` の文言がクイズの文脈に合うかは下の論点)
- `src/index.css` — `.method-chip__badge` がすでにある。変更不要の見込み
- `src/presentation/change/describeChange.ts` — `siteNames`。文の一覧の出し方の前例
- `src/presentation/stage/StagePanel.tsx`・`src/presentation/change/ChangeRequestPanel.tsx`・`src/presentation/blank/BlankDesignResultPanel.tsx` —
  `CodebasePreviewDialog`(→ `CodebasePreviewCanvas`)の他の呼び出し元。**props を任意にすれば変更不要**で、今までどおり印は出ない
- `e2e/quiz.spec.ts` — 答え合わせのE2E(`quiz-choose-a` を押して `quiz-result-a/b` を見る)。ここに「回答前は印が無く、回答後は
  `quiz-design-a`/`quiz-design-b` の中の変更が必要なメソッドに印が出る」を足す形になる見込み
- `src/infrastructure/quizzes/comparisonQuizzes.ts` — 問題データ。読むだけ(E2Eで使うメソッド名の確認用)

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の数ファイルと E2E 1本が中心で、domain・application・infrastructure は変更しない見込み。

1. **必須**: 答え合わせのあと、設計A・Bそれぞれの図で、その設計に依頼を当てたとき変更が必要なメソッド(`impact.sites`)に印を出す。
   回答前は出さない(答えが見えてしまうため。リファクタリング画面で「実装中は印を出さない」としているのと同じ考え方)
2. **必須**: 「次のクイズへ」・選択欄で問題を変えたら印が消える(今の `key={quiz.id}` による回答のリセットにそのまま乗る見込み)
3. **必須**: E2Eを1本足す(クイズの操作はプレイヤーの操作なので CLAUDE.md の方針でE2Eで守る)
4. **任意**: 影響を受けるクラス(`rippleClasses`、減点の「波及」)にもクラス単位の印を出す(膨らむなら後回し)
5. **後回し**: 白紙設計の答え合わせ・変更依頼の「解答例の図」・「変更前の図」への同じ印(同じ部品で出せるが、他パイプラインが触るファイルなので要望が出てから)

仕様設計者に委ねる論点(ここでは決めない):

- 印の情報をノードへ渡す経路: `CodebasePreviewCanvas` に任意の props を足して `CodebasePreviewContext` に載せるか、別の方法か
  (他の呼び出し元を変えずに済む形にしたい)
- 印の見た目・文言: 既存の「変更×N」バッジをそのまま使うか(クイズの依頼は1件なので常に「×1」になる)、クイズ用に「要変更」などの文言にするか。
  `MethodChipView` の `title`「直前の変更依頼で、…」はクイズでは意味がずれるので、文言を差し替えられるようにするか
  (差し替えるなら `MethodChip.tsx` に差分が出る。下の衝突を参照)
- 印の付いたメソッドを含むクラス・ファイル(`classesTouched`・`filesTouched`)まで枠で示すか、メソッドだけにするか
- 読み上げ: 図の印はスクリーンリーダー向けには文の一覧(`DesignResult`)がすでにあるので、図側は `aria-hidden` でよいか
- 回答後に図が変わったことを、ズームしていない小さい図でも気付けるか(`fitView` のままでよいか)

### 既存パイプラインとの衝突の可能性

- **`src/presentation/quiz/ComparisonQuizView.tsx`**: 17件のどのパイプラインも変更予定なし(`data-placement-quizzes` の02が「変更しない」と明記)。競合なし
- **`src/presentation/preview/CodebasePreviewCanvas.tsx`・`CodebasePreviewContext.ts`・`PreviewClassNode.tsx`**: 変更予定のパイプラインは見当たらない
  (`class-dependency-focus` は `dependencyEdges` のシグネチャを変えないので `CodebasePreviewCanvas.tsx` に影響なしと明記。
  `color-contrast-a11y` は `PreviewClassNode.tsx` を「変更しない」と明記。`method-call-references` はスコープ外と明記)。テキスト上の競合は無い見込み
- **`src/presentation/canvas/MethodChip.tsx`**: `color-contrast-a11y` の02が `MethodChipView` に行数オーバーの印を足す予定。
  本件は `changeCount` の既存 props を使うだけなら**変更不要**。バッジの文言・`title` を差し替える案を採る場合だけ `MethodChipView` に差分が出て、
  同じ関数の数行が近接するため軽い競合の可能性がある(その案は後からマージする側で数行の手当てで済む規模)
- **`src/index.css`**: `color-contrast-a11y` が `.method-chip__badge` の色を変える予定。本件は既存のクラスを使うだけなら変更不要。
  クラス・ファイルの枠を示す任意項目を採る場合のみCSSが増える(別の行への追記なので競合は小さい)
- **`e2e/quiz.spec.ts`**: `data-placement-quizzes` の02は「既存の `e2e/quiz.spec.ts` がそのまま通ることを確認する」だけで変更しない。
  本件はテストを1本足す(末尾への追記で競合は小さい)。ただし `data-placement-quizzes` がクイズの並び順を変えた場合、1問目のメソッド名に
  依存したE2Eは後からマージした側で確認が要る(1問目は既存の `quiz-design-a` の `Mailer`/`UserController` の問題のまま変えない前提)
- `sampleAnswer.ts`・`score.ts`・`fileScores.ts`・`mergeMethods.ts`・`naming.ts`・`RefactorUseCases.ts`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・
  `CodebaseCanvas.tsx`・`useGameStore.ts`・`layoutCodebase.ts`・`StagePanel.tsx`・`ChangeRequestPanel.tsx`・`BlankDesignResultPanel.tsx`・
  `workers/critique/`・domain 層には触らない想定
