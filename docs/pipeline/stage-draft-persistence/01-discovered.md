# 機能探索: ステージの途中経過を残し、切り替え・リロード後に続きから再開できるようにする

- slug: `stage-draft-persistence`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

## 背景・目的

今のリファクタリング画面では、**途中まで進めた作業が次の2つの操作で黙って消える**。

1. **ステージの切り替え**: `useGameStore.ts` の `selectStageState` は、選んだステージの `stage.codebase`
   (初期状態)をそのまま入れ、履歴も空にする。上級ステージを途中まで進めたあとに「前のステージではどうしたか」を
   確認しようとして初級へ切り替え、戻ってくると最初からやり直しになる。取り消し(Ctrl+Z)でも戻せない
2. **ページのリロード・タブを閉じる**: 編集中のコードベースはメモリ上にしか無い。保存しているのは
   ステージごとの自己ベストスコア(`progressStorage.ts`)だけで、`docs/specs/stage-progress-persistence.md` は
   「編集中のコードベースそのものは保存しない(YAGNI)」と明記してスコープ外にしている

上級ステージ(Template Method・Strategy・Factory・DIP など)は抽出・移動・継承・インターフェース宣言を何十手も重ねて
組み替える題材で、1回のプレイ時間が長い。CLAUDE.md の ponytail 方針でも「データ消失を防ぐエラー処理」は
手を抜かないものに挙がっており、プレイヤー(新卒〜4年目)が学習中に「消えたからもういいや」と離脱する原因を
取り除く価値がある。

これまでのサイクルはステージ追加・採点ルール・クイズ・右クリックメニューに偏っていたため、今回は
presentation(ストア)・infrastructure(localStorageへの保存と、信頼境界での入力検証)の切り口から1件選んだ。

### 既存テーマとの重複確認

- `docs/specs/stage-progress-persistence.md`: 自己ベストスコアの保存のみ。途中経過の保存は明示的にスコープ外 → 重複しない(その続き)
- `docs/pipeline/blank-design-second-problem/`: 白紙設計の「問題ごとの途中経過の保持」を**作らない**と決めて後回しにしている。
  白紙設計側はこの機能の対象外にする(下の「スコープの見立て」参照)
- 既存の8件の進行中slug(ステージ追加・採点ルール・クイズ・右クリックメニュー移動)とはテーマが異なる

### 検討して見送った候補

- VSCode風ファイルツリー(CLAUDE.md の「予定」): 過去の探索と同じく、新しいペイン・dnd-kitの新しいドロップ先・E2Eが要り1回のPRには大きい。
  読み取り専用+クリックで該当ファイルへビューポートを寄せる案に絞る手もあるが、今のキャンバスでファイルは一望でき、
  学習上の困りごと(データ消失)ほど切実ではないため見送り
- 「問題のあるファイルへビューポートを移動する」ボタン: `fileDeductions`/`fileSeverity` と React Flow の `fitView` で作れるが、
  ファイルの箱にはすでにエラー・危険マークが出ており、引いて見れば分かるため優先度は低い
- AI講評の表示改善(`CritiquePanel.tsx`): 講評APIの応答形式(テキストのみ)を変えずにできる改善の余地が小さい

## 関連する既存コード

- `src/presentation/store/useGameStore.ts`
  - `selectStageState`(ステージ切り替え時に `stage.codebase` へ戻し、履歴・選択・変更依頼・講評を空にする)
  - `createGameStore(allStages)`(リファクタリング用と白紙設計用 `BlankDesignView.tsx` の `blankStore` の**両方**がこれで作られる)
  - `commit` / `resetStage`(「最初に戻す」は1手として記録される)/ `progress`・`recordProgress`(保存の既存パターン)
  - `changeSession`(変更依頼の実装中は `codebase` に部品置き場入りのコードが入り、挑戦前のコードは `changeSession.base` にある)
- `src/infrastructure/progress/progressStorage.ts` — localStorage の読み書き・`try/catch` での握りつぶし・
  `isProgress` による形の検証。保存の書き方はこれに倣える
- `src/domain/codebase/Codebase.ts` — 保存対象の型(`Codebase`/`CodeFile`/`CodeClass`/`Method`/`Fragment`/`Field`)。
  省略可能な項目(`uses`・`reads`・`writes`・`superclassId`・`interfaceIds`・`fields`・`duplicateGroup`・`stub`・`accessor` など)が多い
- `src/domain/codebase/history.ts` — Undo/Redo履歴(`emptyHistory` など)
- `src/presentation/stage/StagePanel.tsx` — ステージ選択(`StageSelect`)・「最初に戻す」ボタン
- `src/presentation/App.tsx` — モード切り替えはアンマウントせず隠すだけ(モード切り替えでは今も消えない)
- `src/infrastructure/critique/critiqueClient.ts` — `isRecord` などの型ガードの書き方(信頼境界での検証の既存例)
- `docs/specs/stage-progress-persistence.md` — 前例の仕様書(保存キー `refactor-blocks:progress`、壊れた値は空として扱う方針)
- `e2e/refactor.spec.ts` — ステージ選択・リロードを含むE2Eを足す先

`Codebase` を localStorage から読み戻す型ガード(`isCodebase` のようなもの)は、リポジトリにまだ無い(grepで確認済み)。

## スコープの見立て

1回のPRに収まる規模と見る。触る層は presentation(ストア)と infrastructure(保存・検証)が中心で、
domain のリファクタリング操作・採点ロジックには手を入れない見込み。

大きく2段に分けられる:

1. **メモリ上の保持**: ステージを切り替えても、ステージごとの途中のコードベースを覚えておき、戻ったら続きから始める
   (ストアだけで完結。数十行規模)
2. **localStorage への保存**: 1 の内容をリロード後も持ち越す。読み込みは信頼境界なので、`Codebase` の形の検証と、
   ステージ定義が更新されて保存済みの途中経過と合わなくなった場合(Fragment のIDが変わった等)の扱いが要る

1回のPRで1・2を両方やる想定だが、仕様設計の段階で検証やステージ定義更新時の扱いが膨らむ場合は、
**まず1だけ**をこのPRにし、2を別のパイプラインに回す(1だけでも「切り替えで消える」問題は解消する)。

仕様設計者に決めてほしい論点(ここでは決めない):

- 保存する単位(コードベースのみか。Undo/Redo履歴・選択中のメソッド・講評・変更依頼の結果まで残すか。YAGNIなら前者のみ)
- 変更依頼の実装中(`changeSession` あり)に切り替え・リロードしたとき、どのコードを残すか(部品置き場入りではなく `changeSession.base` が自然)
- ステージ定義が更新されたときに古い途中経過を捨てる判定方法と、捨てたことをプレイヤーに知らせるか
- 「最初に戻す」との関係(戻した状態がそのまま保存される、で足りるか)
- 続きから再開したことを画面で知らせるか

### 既存パイプラインとの衝突可能性

- `src/presentation/store/useGameStore.ts` を触る。現時点で進行中の8件のうち、`move-class-via-context-menu`・
  `move-via-context-menu` は「ストアは変更しない」と仕様に明記しており衝突しない。
  `blank-design-second-problem` もストアは変更しない見込みだが、白紙設計の問題切り替えは同じ
  `createGameStore` の `selectStage` を使うため、**この機能の挙動を白紙設計に波及させない**
  (白紙設計の02-draft-specは「問題ごとの途中経過は保持しない」前提)。リファクタリング用ストアだけで有効になるよう、
  `createGameStore` の引数などで切り替える形を仕様設計で決める必要がある。同時に進むと `useGameStore.ts` で
  テキスト上の競合が起きる可能性はある(小さい)
- `src/infrastructure/progress/` に新規ファイルを足す(または隣に `drafts/` を作る)想定。他パイプラインは触らない
- ステージ定義(`src/infrastructure/stages/*.ts`)は触らない。ただし `template-method-stage`・`inline-method-stage`・
  `utils-class-split-stage` などでステージが追加・変更されると、保存済みの途中経過が古くなるケースが実際に起きる。
  上記「ステージ定義更新時の扱い」はこのためにも必要
- `e2e/refactor.spec.ts` に追記する。他パイプラインも同ファイルにE2Eを足す可能性があり、追記位置の競合はあり得る(小さい)
