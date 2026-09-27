# 機能探索: 白紙設計モードに2問目と問題の選択欄を足す

- slug: `blank-design-second-problem`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

`docs/specs/blank-design-mode.md` の「スコープ外」に、次のとおり先送りの記載がある:

> 2問目以降の問題と、問題の選択欄(2問目を足すときに作る)

コードにも同じ先送りのコメントが残っている(`src/presentation/blank/BlankDesignView.tsx`):

> // v1は1問だけ。2問目を足すときに問題の選択欄を作る

### 他の候補と見送った理由(参考)

- `template-method-stage`・`move-via-context-menu`・`move-class-via-context-menu`・`duplicate-code-scoring` は進行中または完了済みなので対象外。
- 上級ステージの追加: `template-method-stage` が `advancedStages.ts` を、`duplicate-code-scoring` が `score.ts` と上級1・4・7の点数を触る予定で、
  同じ時期に流すと衝突しやすい。
- Inline Method を題材にするステージ(「分けすぎたメソッドを戻す」): 操作(`inlineMethod`)はあるのに、それを解き方に使うステージも模範解答
  (`sampleAnswer.ts`)も無い。ただ「分けすぎ」を減点する採点ルール(Lazy Class など)を新しく設計する必要があり、`duplicate-code-scoring` と
  同じ `score.ts` を同じ時期に触ることになる。採点ルールが落ち着いてから改めて検討したい。
- Middle Man の減点・データクラスの減点: 過去の探索(`duplicate-code-scoring/01-discovered.md` ほか)と同じ理由で見送る
  (ゲーム内で直す操作が無い/新しい判定の設計から要り、1回のPRより大きい)。
- VSCode風のファイルツリー: 新しいペイン・dnd-kitの新しいドロップ先・E2Eが要り、1回のPRには大きい(過去の探索と同じ判断)。
- `move-via-context-menu/06-evaluation.md` の suggestion(外側クリック時のフォーカス復帰など): `move-class-via-context-menu` が
  同じ部品を触るときに含めるかどうかを決める論点になっているので、ここでは扱わない。

## 背景・目的

- 白紙設計モードは「要求文を読んで、白紙からクラス構成を決める」という、既存ステージ(悪いコードを直す形式)では鍛えられない
  力を練習するモード。けれど今は問題が1問(`blank-order-shipping`、変わる理由ごとにクラスを分ける)しかなく、
  一度解いたらもう遊ぶものが無い。1問だけでは「たまたま当たった」のか「考え方が身に付いた」のかをプレイヤー自身が確かめられない。
- 1問目が教えているのは「機能の流れではなく変わる理由(責務)で分ける」ことだけ。新卒〜4年目が白紙設計でつまずきやすい点は
  ほかにもある。たとえば「何でも呼ぶ司令塔クラスを作って依存先が増えすぎる」「部品同士が呼び合う形に分けて循環依存を作る」など。
  これらは既存の採点ルール(`coupling`・`cycle`・`responsibility`・`line-limit`)と変更依頼の判定だけで測れる。
  新しい採点の仕組みを作らず、問題データを1つ足すだけで、白紙設計で練習できる観点を増やせる見込みが高い。
- 仕組みは揃っている。問題の一覧は配列(`blankDesignProblems`)、白紙設計用のストアは `createGameStore(blankDesignProblems)` で
  全問題を持っており、ストアの `selectStage` は渡された一覧から問題を探して履歴・選択中のメソッドを空に戻す
  (`useGameStore.ts` の `selectStageState`)。`blankDesignProblems.test.ts` も `describe.each` で全問題の
  「模範解答で100点」「部品置き場から始まる」を確かめる形になっている。足りないのは「2問目のデータ」と
  「画面で問題を選ぶ欄」だけ。

## 関連する既存コード

- `docs/specs/blank-design-mode.md` — 白紙設計モードの仕様。問題の型・答え合わせ・画面・E2E・スコープ外(今回の出どころ)
- `src/infrastructure/blankDesigns/blankDesignProblems.ts` — 問題の一覧(今は1問)。2問目を足す場所
- `src/infrastructure/blankDesigns/blankDesignProblems.test.ts` — 全問題に対するテスト(`describe.each`)と、1問目だけの「機能ごとに分けた設計は模範解答より低い」テスト。
  2問目にも「その問題が教えたいこと」を固定するテストを足す前例
- `src/domain/blank/BlankDesignProblem.ts` / `tray.ts` / `reviewBlankDesign.ts` — 問題の型・部品置き場・答え合わせ(変更不要の見込み)
- `src/presentation/blank/BlankDesignView.tsx` — `const [problem] = blankDesignProblems;` で先頭の1問に固定している箇所と、先送りのコメント
- `src/presentation/blank/BlankDesignPanel.tsx` — 問題の見出し・要求文・目標を出す上部パネル。選択欄を置くならここ
- `src/presentation/blank/BlankDesignResultPanel.tsx` — 答え合わせの結果(問題を切り替えたときに閉じる必要があるかの確認先)
- `src/presentation/store/useGameStore.ts` — `createGameStore` / `selectStage` / `selectStageState`(ストアの `stage` は `Stage` 型なので、
  `modelAnswer`・`explanation` は問題IDから `blankDesignProblems` を引き直す必要がありそう)
- `src/presentation/stage/StagePanel.tsx` — リファクタリング画面のステージ選択欄(`<select>`)。選択欄の見た目・ラベルの前例
- `e2e/blank.spec.ts` — 白紙設計のE2E。問題の切り替えのE2Eを足す場所
- `src/infrastructure/stages/intermediateStages.ts` の中級1(循環依存)・中級2(何でも入った services.ts) — 2問目の題材を選ぶときの参考
  (白紙設計で同じ観点を「作る側」から練習させる)

## スコープの見立て

- 1回のPRで完結する規模と見ている。主な作業は infrastructure 層の問題データ1件(+ そのテスト)と、presentation 層の選択欄
  (`BlankDesignView` の問題の固定を外し、ストアの今の問題から引く形にする)、E2Eの追加。
  domain 層・application 層・採点ルールは変更しない見込み。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - 2問目の題材。1問目(変わる理由で分ける)と観点が被らず、既存の採点ルールと変更依頼の判定だけで
    「素朴な設計より模範解答が高い」をテストで固定できるもの(例: 依存先の上限・循環依存を意識させる題材)
  - 2問目の難しさ(`level`)と、public / private・継承を使うか(v1のスコープ外を今回も維持するか)
  - 選択欄の置き場所・見た目(リファクタリング画面のステージ選択と揃えるか)
  - 問題を切り替えたときの扱い: 答え合わせのパネルを閉じるか、途中の配置を問題ごとに残すか(今の `selectStage` は初期状態に戻す)
  - キーボードだけで問題を切り替えられること(既存の `<select>` の流儀に合わせるか)
- 大きくなりそうなら次のように割る:
  1. 今回: 2問目のデータと、問題の選択欄(切り替えると初期状態から始まる)
  2. 後回し: 問題ごとの途中経過の保持、白紙設計の結果の保存(localStorage)とクリア表示(こちらも `blank-design-mode.md` でスコープ外)
