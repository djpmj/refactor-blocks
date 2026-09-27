# 白紙設計モードの2問目と問題の選択欄(草案)

- slug: `blank-design-second-problem`
- 入力: `docs/pipeline/blank-design-second-problem/01-discovered.md`
- 元の仕様: `docs/specs/blank-design-mode.md`(スコープ外「2問目以降の問題と、問題の選択欄(2問目を足すときに作る)」を今回やる)

## 背景・目的

- 白紙設計モードには問題が1問(`blank-order-shipping`。変わる理由ごとにクラスを分ける)しかない。一度解くと遊ぶものがなく、
  「たまたま当たった」のか「考え方が身に付いた」のかをプレイヤーが確かめられない。
- 1問目が教えているのは「責務(変わる理由)で分ける」ことだけ。新卒〜4年目が白紙設計でつまずきやすい
  **依存の形**(何でも呼ぶ司令塔クラスを作って依存先が増えすぎる/モノごとに分けて互いに呼び合い循環依存を作る)を、
  2問目で練習できるようにする。
- 仕組みはもう揃っている。問題の一覧は配列、白紙設計のストアは `createGameStore(blankDesignProblems)` で全問題を持ち、
  `selectStage(id)` はその一覧から問題を探して初期状態(コードベース・履歴・選択中のメソッド・メッセージ)に戻す。
  足りないのは「2問目のデータ」と「画面で問題を選ぶ欄」だけ。

**ponytail**:

- domain 層・application 層・採点ルール・ストアは**変更しない**。2問目の観点(依存先の上限・循環依存)は既存の
  `coupling` / `cycle` / `responsibility` の採点だけで測れる。新しい採点ルールは要らない。
- 選択欄は `StagePanel` の `StageSelect` と同じ素の `<select>`(キーボード操作はブラウザ標準で足りる)。
  難易度の `optgroup` や進捗の ✅ は付けない(2問では選び分ける必要がない・白紙設計は進捗を保存しない)。
- 「今の問題」はストアの `stage.id` から `blankDesignProblems` を引き直すだけにする。ストアに `BlankDesignProblem` を
  持たせる・ストアを型パラメータ化する、は要らない(`stage` は `modelAnswer` / `explanation` を持たないが、IDで引けば足りる)。
- 問題ごとの途中経過の保持は作らない(今の `selectStage` どおり初期状態から始める。リファクタリングのステージ選択と同じ挙動)。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/infrastructure/blankDesigns/blankDesignProblems.ts` | infrastructure | 変更 | 2問目 `blank-library-lending` を**末尾に**足す(1問目を先頭のまま残す。既定の問題と既存E2Eを変えないため) |
| `src/infrastructure/blankDesigns/blankDesignProblems.test.ts` | infrastructure | 変更 | 2問目専用のテスト(下記)を足す。全問題向けの `describe.each` はそのまま2問目にも効く |
| `src/presentation/blank/BlankDesignView.tsx` | presentation | 変更 | `const [problem] = blankDesignProblems;` の固定と先送りコメントをやめ、ストアの `stage.id` から今の問題を引く。問題を切り替えたら答え合わせを閉じる |
| `src/presentation/blank/BlankDesignPanel.tsx` | presentation | 変更 | 見出しの前に問題の選択欄(`<select>`)を置く |
| `e2e/blank.spec.ts` | — | 変更 | 問題の切り替えのE2Eを足す。`placeAllParts` を部品名の配列を受け取る形にする |
| `docs/specs/blank-design-mode.md` | — | 変更 | 「問題の一覧」の「v1 は1問だけ」と、スコープ外の「2問目以降の問題と、問題の選択欄」の行を、今回の対応に合わせて直す(1〜2行) |

変更しないもの(確認済み): `src/domain/blank/*`(`BlankDesignProblem` / `tray` / `reviewBlankDesign`)、`src/domain/scoring/*`、
`src/presentation/store/useGameStore.ts`(`selectStage` は既に引数の問題一覧から探して初期状態に戻す)、
`BlankDesignResultPanel.tsx`(`problem` を props で受け取っているので、渡す値が今の問題になるだけ)、
`CodebaseCanvas.tsx`(`stage.id` が変わるとドラッグ位置の上書きを捨てて `fitView` し直す仕組みが既にある)。

## データ/型の変更

型の変更はない。`BlankDesignProblem`(= `Stage & { modelAnswer; explanation }`)のデータを1件足す。

### 白紙2: 図書館の貸出と返却(`blank-library-lending`)

- `level: 'intermediate'`(未決事項2)、`title: '白紙2: 図書館の貸出と返却'`
- `description`(要求文):
  「図書館の貸出と返却の機能を、白紙から設計する。利用者が本を借りるときは、その会員が上限の冊数まで借りていないかを確かめ、
  本を貸出中にして、貸出記録をDBに保存する。本が返されたら、本を貸出可能に戻し、返却が遅れていれば延滞料を計算して、
  貸出記録に返却日を書き込む。なお、延滞料のルールと、会員ごとの貸出上限は近いうちに見直す予定。」
- `goal`: 「部品置き場の8つの部品を、すべて自分で作ったクラスに配置しよう。メソッドは40行・クラスは80行以内、
  1クラスの責務は1種類、依存先は3クラスまで。クラス同士が呼び合う循環依存も減点される」
- `limits: { method: 40, class: 80, file: 200 }`、`dependencyLimit: 3`、`responsibilityLimit: 1`(`visibilityEnforced` は省略)
- 部品(すべて `public`、処理は1つずつ。ID は1問目と同じく `method-blank-*` / `frag-blank-*` の形)

| 部品(メソッド名) | 処理のラベル | 行数 | responsibility | uses |
| --- | --- | --- | --- | --- |
| `lendBook` | 貸出を受け付け、貸出上限の確認・本の状態の変更・貸出記録の保存を順に呼ぶ | 10 | `loan-flow` | `canBorrow`, `markAsLent`, `saveLoan` |
| `returnBook` | 返却を受け付け、本の状態の変更・延滞料の計算・返却日の記録を順に呼ぶ | 10 | `loan-flow` | `markAsReturned`, `calculateLateFee`, `closeLoan` |
| `canBorrow` | 会員が上限の冊数まで借りていないか確かめる | 14 | `borrow-limit` | — |
| `calculateLateFee` | 返却が遅れた日数から延滞料を計算する | 16 | `late-fee` | — |
| `markAsLent` | 本の状態を貸出中にする | 12 | `book-status` | — |
| `markAsReturned` | 本の状態を貸出可能に戻す | 12 | `book-status` | — |
| `saveLoan` | 貸出記録をDBに保存する | 18 | `persistence` | — |
| `closeLoan` | 貸出記録に返却日を書き込む | 16 | `persistence` | — |

(`uses` はメソッドIDで書く。表ではメソッド名で示した)

- `changeRequests`
  - `req-blank-late-fee-cap`: 「延滞料に上限を付けて」/ 延滞料は、その本の定価を上限にしたい。/ `late-fee` / `linesPerSite: 8`
  - `req-blank-borrow-limit`: 「会員ランクで貸出上限を変えて」/ 一般会員は5冊、プレミアム会員は10冊まで借りられるようにしたい。/ `borrow-limit` / `linesPerSite: 10`
  - 本の状態(`book-status`)・保存(`persistence`)の依頼は**入れない**。両方の司令塔から呼ばれるクラスへの変更は、
    司令塔を2つに分けた模範解答のほうが波及(ripple)が1つ多くなり、「司令塔1つ」より点が下がってしまうため
- `modelAnswer`(部品置き場から): `addFile` で次の6ファイルを作り、それぞれに同名のクラスを `addClass` し、`move` する
  - `src/library/LendingService.ts` / `LendingService`: `lendBook`(10行。依存先は BorrowingLimit・BookInventory・LoanRepository の3つ)
  - `src/library/ReturnService.ts` / `ReturnService`: `returnBook`(10行。依存先は BookInventory・LateFeeCalculator・LoanRepository の3つ)
  - `src/library/BorrowingLimit.ts` / `BorrowingLimit`: `canBorrow`(14行)
  - `src/library/LateFeeCalculator.ts` / `LateFeeCalculator`: `calculateLateFee`(16行)
  - `src/library/BookInventory.ts` / `BookInventory`: `markAsLent`, `markAsReturned`(24行)
  - `src/library/LoanRepository.ts` / `LoanRepository`: `saveLoan`, `closeLoan`(34行)
- `explanation`:
  「貸出も返却も1つの司令塔クラスにまとめると、依存先が4クラスになって上限を超える。"貸出"と"返却"という流れごとに
  司令塔を分けると、それぞれの依存先が3つに収まる。また、"会員"と"本"というモノごとに分けて互いの処理を呼び合うと、
  循環依存になって片方だけを直したりテストしたりしにくくなる。部品(貸出上限・延滞料・本の状態・貸出記録)は何も呼ばない
  一番下に置き、流れのクラスから一方向に呼ぶ形にする。模範解答と同じ形でなくても、点数が同じなら同じくらい良い設計。」

### 期待される数値(仕様設計時の手計算。実装時に `reviewBlankDesign` で実測し、ずれたら数値と理由を報告する)

| 設計 | 設計スコア | 延滞料の依頼 | 貸出上限の依頼 | 変更のしやすさ |
| --- | --- | --- | --- | --- |
| 模範解答 | 100 | 95(波及: ReturnService) | 95(波及: LendingService) | 95 |
| 司令塔1つの設計(テスト用A) | 90(依存過多×1: LibraryService の依存先4) | 95(波及: LibraryService) | 95(波及: LibraryService) | 95 |
| モノごとに分けた設計(テスト用B) | 60(循環依存×2・責務の混在×2) | 95(波及: Book) | 95(波及: Book) | 95 |

- 変更のしやすさは3つとも同点になる。この問題は**依存の形を設計スコアで測る**問題として割り切る
  (上記のとおり、依存の形の差が変更依頼の点に出る依頼を作ると、模範解答の方が波及で不利になるため)。
- テスト用の設計A(テストファイル内だけに書く): `src/library/LibraryService.ts` に `LibraryService`(`lendBook`, `returnBook`)、
  ほかの4クラス(BorrowingLimit・LateFeeCalculator・BookInventory・LoanRepository)は模範解答と同じ。
- テスト用の設計B(テストファイル内だけに書く): `src/member/Member.ts` に `Member`(`lendBook`, `canBorrow`, `calculateLateFee`)、
  `src/book/Book.ts` に `Book`(`returnBook`, `markAsLent`, `markAsReturned`)、`src/loan/LoanRepository.ts` に `LoanRepository`(`saveLoan`, `closeLoan`)。
  Member → Book(`markAsLent`)と Book → Member(`calculateLateFee`)が循環する。Member は3責務、Book は2責務。

## 画面

### `BlankDesignView.tsx`

- モジュール定数の `const [problem] = blankDesignProblems;` と「v1は1問だけ…」のコメントを消す。
  先頭の問題は「見つからなかったときの予備」としてだけ残す(例: `const [firstProblem] = blankDesignProblems;`)
- `BlankDesignBody` で `useGameStore((state) => state.stage.id)` を読み、
  `blankDesignProblems.find((candidate) => candidate.id === stageId) ?? firstProblem` を今の問題にする
  (白紙設計のストアは `blankDesignProblems` から作っているので必ず見つかる。`!` や `as` は使わない)
- 問題を切り替えたら答え合わせを閉じる。選択欄の変更ハンドラで `selectStage(id)` と `setReviewing(false)` を両方呼ぶ
  (`useEffect` で `stage.id` を監視して閉じる形にはしない。1回余分に描画され、古い問題で `reviewBlankDesign` が走るため)
- 今の問題を `BlankDesignPanel` / `BlankDesignResultPanel` / `reviewBlankDesign` に渡す(今の `problem` をこれに置き換えるだけ)

### `BlankDesignPanel.tsx`

- props に `onSelectProblem: (problemId: string) => void` を足す(問題の一覧は `useGameStore((state) => state.stages)`、
  今の問題IDは `problem.id` を使う)
- 見出し(`stage-panel__heading`)の前に、`StageSelect` と同じ見た目の選択欄を置く
  - `<select aria-label="問題" className="stage-panel__select" data-testid="blank-problem-select" value={problem.id}>`
  - 選択肢は `title` を一覧の順に並べる(`optgroup` なし)
  - `aria-label` は **「ステージ」にしない**。既存E2E(`refactor.spec.ts` など)は `page.getByLabel('ステージ')` で
    リファクタリングの選択欄を探しており、白紙設計を一度開いた後だと隠れた要素も一致して strict mode 違反になるため
- それ以外(要求文・未配置の数・ボタン)は変えない。未配置の数・答え合わせボタンは `problem.codebase` を今の問題に
  差し替えるだけで2問目にも効く

### 問題を切り替えたときの扱い(未決事項4の既定案)

- 確認なしで、選んだ問題の初期状態(部品置き場だけ)から始まる。前の問題の配置・取り消し履歴は捨てる
  (`selectStage` の今の挙動。リファクタリングのステージ選択と同じ)
- 答え合わせのパネルは閉じ、サイドパネルは `MethodEditor` に戻る(選択中のメソッドは `selectStage` が空にする)
- フォーカスは選択欄に残る(ブラウザ標準の挙動のまま。移さない)

## TDD対象の純粋関数

domain / application 層に新しいロジックはない(2問目はデータ、選択欄は表示)。テストを先に書くのは次の infrastructure の
データテストで、**2問目のデータを書く前に**足して Red(問題が見つからない)を確かめてから、データを足して Green にする。

### `blankDesignProblems.test.ts`

既存の `describe.each(blankDesignProblems)` が2問目にもそのまま効く(追加の記述は不要):

- 問題IDは重複しない
- `codebase` は部品置き場だけ
- 模範解答が全部品を配置している
- 模範解答は100点

2問目専用の `describe('blank-library-lending', ...)` を足す(1問目の `describe('blank-order-shipping', ...)` と同じ書き方。AAA):

- 正常系: 一覧に2問あり、先頭が `blank-order-shipping`(既定の問題と既存E2Eを守る)
- 正常系: 部品は8つ(`findUnplacedParts(problem.codebase, problem.codebase)` が8件)
- 司令塔1つの設計(A)は、設計スコアが模範解答より低い。`coupling` の減点が1件で、`cycle` の減点は0件
  (期待値: A 90点・模範解答100点)
- モノごとに分けた設計(B)は、設計スコアが模範解答より低い。`cycle` の減点が1件以上
  (期待値: B 60点、`cycle` 2件・`responsibility` 2件)
- 模範解答には `coupling` と `cycle` の減点がない(`model.score.deductions` で確かめる。100点のテストと重なるが、
  この問題が教えたいことを名前付きで固定する)
- 変更のしやすさ(`changeScore`)は、A・B とも模範解答**以下**であることだけを確かめる(同点を許す。上の表のとおり実測は同点の見込み)

異常系(`err`)は `reviewBlankDesign.test.ts` で既に固定済みなので、ここでは足さない。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。`vite.config.ts` のカバレッジ閾値を下回らない
- `blankDesignProblems.test.ts` が上記のケースを持ち、通る。実測値が「期待される数値」の表とずれた場合は、テストの期待値を実測に
  合わせたうえで、ずれと理由を報告する(1問目の仕様と同じ扱い)
- `e2e/blank.spec.ts` に次を足し、通る(要素は `page.getByTestId('blank-view')` の中で探す):
  - 白紙設計を開くと、選択欄(`getByRole('combobox', { name: '問題' })`)の値は白紙1。選択肢に「白紙1: 注文と発送」「白紙2: 図書館の貸出と返却」がある
  - 白紙2を選ぶと、要求文に「図書館」が含まれ、部品置き場に8つの部品(`method-lendBook` など)が出て、未配置が「あと8個」、
    `method-placeOrder` は出ない。「答え合わせ」は押せない
  - 白紙1で部品を1つ配置してから白紙2に切り替え、白紙1に戻すと、未配置が「あと7個」(初期状態)で「元に戻す」が押せない(未決事項4がAのとき)
  - 白紙1で全部品を配置して答え合わせを開いた状態で白紙2に切り替えると、`blank-result` が閉じる
  - 白紙2で全部品を配置して答え合わせを開くと、`blank-change-req-blank-late-fee-cap` と `blank-change-req-blank-borrow-limit` が出る
    (今の問題が結果パネルに渡っていることを守る)
- 既存の E2E(`blank.spec.ts` の既存ケース・`refactor.spec.ts`・`quiz.spec.ts`・`preview.spec.ts`・`critique.spec.ts`)が通る
- ステージ選択(リファクタリング)の一覧に白紙設計の問題が出ない。進捗(localStorage)に白紙設計の問題IDが書かれない(今の分離を壊さない)
- `BlankDesignView.tsx` に「v1は1問だけ」のコメントが残っていない

## スコープ外

- 問題ごとの途中経過の保持(切り替えても配置を残す)。ストアに問題ごとの状態を持たせる別作業になる(`01-discovered.md` の後回し案)
- 白紙設計の結果の保存(localStorage)とクリア表示(✅)。選択欄の ✅ もこれと一緒に足す
- 3問目以降の問題。2問で遊んでもらってから、足りない観点を見て決める
- 選択欄の難易度ごとの `optgroup`(2問では要らない。問題が増えたら `StageSelect` と同じ形にする)
- 答え合わせの結果から次の問題へ進むボタン(未決事項3でBを選んだ場合のみ今回やる)
- public / private・継承を問題に使うこと。2問目も1問目と同じく全部品 public、`visibilityEnforced` なし
  (依存の形という1つの観点に絞るため。アクセス制御の観点は別の問題として足す)
- 変更依頼で依存の形の差を点に出すこと(変更依頼の採点ルールの変更が要る。上の「期待される数値」の注記を参照)
- domain / application 層・採点ルール・ストアの変更

## 未決事項

### 未決事項1: 2問目の題材と観点を、この草案の「図書館の貸出と返却(依存先の上限と循環依存)」にしてよいか

- 選択肢A(推奨): この草案どおり。司令塔1つだと依存過多、モノごとに分けると循環依存になる、の2つの落とし穴を1問で練習させる
- 選択肢B: 題材は図書館のまま、観点を循環依存だけに絞る(`dependencyLimit` を4にして司令塔1つでも100点にする。テスト用設計Aのテストは消す)
- 選択肢C: 別の題材にする(自由記述で確認が必要。題材と、狙う落とし穴を教えてほしい)

### 未決事項2: 2問目の難易度(`level`)をどうするか

- 選択肢A(推奨): `'intermediate'`。依存の向きは責務の分け方より一段難しい観点で、既存ステージでも循環依存は中級1。なお今は画面に難易度を出さないので、データ上の意味づけだけになる
- 選択肢B: `'beginner'`。1問目と同じ難易度として扱う

### 未決事項3: 問題の選択欄をどこに置くか

- 選択肢A(推奨): 上部パネル(`BlankDesignPanel`)の見出しの前に `<select>` を1つ置く。リファクタリング画面の `StageSelect` と同じ位置・見た目
- 選択肢B: Aに加えて、答え合わせの結果パネルの下に「次の問題へ」ボタンも置く(最後の問題では出さない)。E2Eが1件増える

### 未決事項4: 途中まで配置した状態で問題を切り替えたとき、配置をどう扱うか

- 選択肢A(推奨): 確認なしで、選んだ問題の初期状態から始める(今の `selectStage` の挙動。リファクタリングのステージ選択と同じ。前の配置は取り消しでも戻せない)
- 選択肢B: 部品を1つでも配置していたら `window.confirm` で「今の配置は消えます」と確認し、キャンセルなら切り替えない(選択欄の値も戻す)
- 選択肢C: 問題ごとに途中の配置と取り消し履歴を残す(ストアに問題ごとの状態を持たせる変更が要り、1回のPRより大きくなる見込み)
