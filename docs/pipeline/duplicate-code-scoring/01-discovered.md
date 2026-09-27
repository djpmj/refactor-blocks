# 機能探索: 重複コード(コピペ)が残っていることを採点で減点する

- slug: `duplicate-code-scoring`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

`docs/specs/merge-duplicate-methods.md` の「スコープ外」で、明示的に先送りされていたもの:

> 「重複コードが残っている」ことを検出して減点する新しい採点ルール(`duplicateGroup`は統合できるかどうかのタグであり、採点には使わない)。

### 他の候補と見送った理由(参考)

- `template-method-stage`(上級8)・`move-via-context-menu`・`move-class-via-context-menu` は進行中または完了済みのため対象外。
- Middle Man(横流しするだけのメソッド)の減点: `docs/specs/lone-superclass-scoring.md` で「呼び出し元を直接つなぎ替える操作がなく、
  ゲーム内で直せない」ため見送り済み。前提が変わっていないので今回も採らない。
- データクラスの減点(`cohesion-value-object-anemic.md` で先送り): 新しい判定の設計から要り、1回のPRより大きい。
- CLAUDE.md の「予定: VSCodeのエクスプローラー風ファイルツリー」: 新しいペインとdnd-kitのドロップ先、E2Eが要り、1回のPRには大きい
  (`move-class-via-context-menu/01-discovered.md` でも同じ理由で見送り)。セマンティックズームは実装済み。
- 新しいステージの追加: 上級は `template-method-stage` が `advancedStages.ts` を触る予定で衝突しやすい。
  また、今回の採点ルールがあると、今後の「重複をまとめる」ステージ(Template Method を含む)の採点が素直になる。

## 背景・目的

- 新卒〜4年目がいちばん多く書いてしまう設計上の問題は、コピペによる重複コード(DRY違反)。このゲームにも
  `Fragment.duplicateGroup`(隠しタグ)と Merge Methods(`mergeMethods`)があり、上級1(`advanced-notifier-hierarchy`)・
  上級4(`advanced-report-factory`)・上級7(`advanced-value-object`)は「コピペを1つにまとめる」ことが解き方の中心になっている。
- ところが**採点には重複が出てこない**。`scoreCodebase`(`src/domain/scoring/score.ts`)の `ScoreRule` は13種類あるが、
  重複を数えるルールは無い。重複を統合させる仕組みは、ステージごとの間接的な工夫に頼っている:
  - 上級7: 統合せずに `Money` へ並べると行数の上限を超える、という行数の設定頼み(`cohesion-value-object-anemic.md`)
  - 上級1: `merge-duplicate-methods.md` の動機そのものが「重複を統合せず基底クラスへ移すだけで満点になっていた」こと。
    今も、ログ記録の2メソッドを統合せずに `NotifierBase` へ移すだけで満点になるか、仕様設計で確かめる必要がある
- その結果、プレイヤーが「コピペが残っている」ことに気づくきっかけが、変更依頼(触ったブロック数)の結果か、行数オーバーしかない。
  採点の内訳(`describeScore.ts` の `RULE_LABEL`)に「重複コード」が出れば、どこが悪いかが直接分かる。
  これはゲームの基本ルール「採点はルールベース(行数・責務の混在・結合度・循環依存など)」をそのまま延長したもの。
- 模範解答は、`duplicateGroup` を持つ処理をすべて Merge Methods で統合済み(`src/domain/stage/sampleAnswer.ts` の上級1・4・7の `merge` ステップ)。
  統合すると `duplicateGroup` が外れる(`mergeMethods.ts` の `mergeFragment`)ので、既存のデータのまま「まとめれば減点が消える」形にできる見込みが高い。

## 関連する既存コード

- `src/domain/scoring/score.ts` — `ScoreRule` / `scoreCodebase`。ルールを1つ足す場所。1件10点の減点の形
- `src/domain/scoring/loneSuperclass.ts` / `leftovers.ts` — 小さな判定関数を1つ足して `scoreCodebase` に数えさせた前例
- `src/domain/codebase/Codebase.ts` — `Fragment.duplicateGroup`(隠しタグ。プレイヤーには表示しない)
- `src/domain/codebase/mergeMethods.ts` — 統合で `duplicateGroup` が外れる処理、`findMergeCandidates`
- `src/infrastructure/stages/advancedStages.ts` — `duplicateGroup` を使っているステージ(上級1・上級4・上級7)
- `src/infrastructure/stages/advancedStages.test.ts` / `valueObjectStage.test.ts` / `stageCatalog.test.ts` — 模範解答で満点になる・初期状態より点が上がることを確かめる既存テスト
- `src/domain/stage/sampleAnswer.ts` — 上級1・4・7の `merge` ステップ
- `src/presentation/stage/describeScore.ts` — `RULE_LABEL`(減点の表示名)
- `docs/specs/merge-duplicate-methods.md` — `duplicateGroup` の導入と、この採点ルールを先送りした判断
- `docs/specs/lone-superclass-scoring.md` / `docs/specs/visibility-scoring.md` — 採点ルールを1つ足した仕様の前例
- `docs/pipeline/template-method-stage/02-draft-spec.md` — 進行中の上級8も `duplicateGroup` と `mergeMethods` を使う予定。
  採点ルールを足すと上級8の模範解答・点数の試算にも効くので、どちらが先にマージされるかを仕様設計で意識する必要がある

## スコープの見立て

- domain 層の判定関数1つ + `scoreCodebase` への組み込み + `RULE_LABEL` への表示名の追加が中心で、1回のPRで完結する規模と見ている。
  既存の `lone-superclass` の追加(ルール1つ)と同程度。新しい操作・UI・ドラッグ操作は要らない見込み(E2Eの追加は不要か、表示の確認程度)。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - 何を1件と数えるか(`duplicateGroup` の値ごとに1件か、重複している処理/メソッドの数か)。同じメソッドの中に同じグループが並ぶ場合の扱い
  - Extract Method する前(public メソッドの中に処理として埋まっている段階)から数えるか
  - 初期状態の点数が下がる既存ステージ(上級1・4・7)の、ステージテスト・設計くらべクイズ・行き詰まりヒントへの影響と、
    「模範解答で満点」「初期状態より点が上がる」がすべて保たれるか
  - 上級1で「統合せず基底クラスへ移すだけ」の手順が満点でなくなることを、テストで守るか
  - 進行中の `template-method-stage` との順序(どちらが先でも模範解答が満点になるか)
- 大きくなりそうなら次のように割る:
  1. 今回: 採点ルールの追加と、既存ステージの模範解答が満点のままであることの確認
  2. 後回し: ルールに合わせたステージの goal 文言の見直し、AI講評や行き詰まりヒントでの重複コードの言い回しの調整
