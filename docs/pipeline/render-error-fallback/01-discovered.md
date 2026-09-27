# 01 機能探索: 描画中の例外で画面全体が真っ白にならないようにし、作業を残したまま立て直せるようにする(React のエラー境界)

- slug: `render-error-fallback`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

CLAUDE.md の「手を抜かないもの: … **データ消失を防ぐエラー処理**」に当たる穴として見つけた。

### 既存テーマとの重複確認

- `docs/` 全体を `ErrorBoundary|エラー境界|真っ白|白い画面|クラッシュ|描画に失敗|onUncaughtError|画面が消え` でgrepし、該当なし。
  `src/` にも `ErrorBoundary`・`componentDidCatch`・`getDerivedStateFromError`・`onerror`・`unhandledrejection` は1つも無い
- `stage-draft-persistence`: 途中経過を localStorage に**保存・復元**する。読み込み時の**形**の検証(`isCodebase`)はするが、
  02の206〜207行目で「中身の整合性は検証しない。存在しないIDは既存のドメイン関数が `find` で飛ばすので画面は壊れない」と**前提を置いている**。
  描画が例外で落ちたときの受け皿は扱わない → 重ならない(本件はその前提が外れたときの安全網。下の「意味上の依存」)
- `critique-request-robustness`・`critique-worker-hardening`: AI講評の**通信**の失敗処理。描画の例外は扱わない
- `stage-reference-integrity`: 題材データの参照切れを**テストで**見つける。実行時に描画が落ちたときの画面は扱わない
- `identifier-name-validation`: 入力の検証。描画の例外は扱わない
- 呼び出し元が列挙した28件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **行き詰まりヒントの各手に「この手を打ったあとの図」を出す(模範解答を1手ずつ図で再生)**: 学びとしては新しいが、`HintPanel.tsx` の
  ヒントの組み立て行(10行目)は `law-of-demeter-stage` の02(3.2)が「その手の直前までのコードベースを渡す」形に書き換える予定で、同じ行に重なる。
  「解答例の図」ボタン側(`StagePanel.tsx` の `PreviewButtons`)に置く案も、`codebase-code-view` の02が同じ `PreviewButtons` にダイアログを足す。
  `law-of-demeter-stage` のマージ後に、その途中のコードベースの計算をそのまま使って足すのが素直
- **「問題を見つける」練習のモード(ステージの初期コードの図を見せ、減点の種類を当てさせる)**: 修正・比較・設計に対して「指摘する」練習は無いが、
  読み取り専用の図(`PreviewClassNode.tsx`)には処理の中身(責務の手がかり)も、どのメソッドがどのフィールドを読むかも出ないため、
  責務の混在・Feature Envy・凝集度などは図から判断できず、公平な問題にならない。新しいモードは `App.tsx`・CSS・E2E まで広がり、1回のPRにも重い
- **上級6(ISP)などに `extend` の変更依頼を足す(「Microsoft Planner にも対応して」)**: データだけで済みそうだが、`advancedStages.ts` は
  `template-method-stage`・`duplicate-code-scoring` が触り、`extend` を増やすと `measurePlacement.ts` の ponytail(呼ばれていない既存クラスに置く抜け道)が効いてくる。
  `method-rename-keyboard` の01が上級3について同じ理由で見送っている
- **ステージ選択欄で矢印キーを押すとすぐステージが切り替わり、履歴ごと作業が消える**: `StageSelect` の `onChange` が即 `selectStage`(履歴を空にする)。
  ただし `stage-draft-persistence` が切り替え時の途中経過の保持で直す見込みで、`StagePanel.tsx` も複数件が触る
- **axe などでアクセシビリティを自動検査するE2E**: 新しい依存が要り、進行中の a11y 系4件(`color-contrast-a11y`・`flow-aria-labels-ja`・`drag-announcements-ja`・
  `method-select-keyboard`)がマージされる前に入れると既存の違反で落ちる。機能ではなくテストの追加でもある
- 新ステージ(Push Down / 継承より委譲・Facade・Middle Man・Observer など)・採点ルールの追加・VSCode風ファイルツリー・自己ベスト表示:
  過去の探索と同じ理由(`sampleAnswer.ts`・`score.ts`・`StagePanel.tsx` の競合、新しい採点ルールの設計が要る、1回のPRには大きい、学びの中身が増えない)

## 背景・目的

- `src/main.tsx` は `<App />` をそのまま描画しており、アプリのどこにも**エラー境界**(React が描画中の例外を受け止める仕組み)が無い。
  React はエラー境界の無い描画の例外で**ルートごとアンマウントする**ため、メソッドエディタや採点欄の1か所で例外が起きただけで、
  画面全体が真っ白になり、キャンバス・ステージ選択・「元に戻す」ボタンもすべて消える。プレイヤーにできるのはリロードだけで、
  今はリロードすると**そのステージの作業がすべて消える**(履歴・コードベースはメモリにしか無い)
- ストアはReactの木の外にある(`useGameStore.ts` 423行目の `GameStoreContext` の既定値、`BlankDesignView.tsx` 15行目の `blankStore` は
  どちらもモジュールの初期化時に作られる)。そのため、**描画の一部だけを落として代わりの表示に差し替えれば、コードベースも Undo の履歴も残る**。
  代わりの表示から「1手戻す」(`undo`)を押せば、例外の引き金になった操作だけを取り消して続きから遊べる
- 描画の途中で例外を投げうる箇所は実際にある:
  - `src/domain/stage/sampleAnswer.ts` 80〜108・383行目(模範解答が当たらないと `throw`)を、`StagePanel.tsx` の `PreviewButtons`(`useMemo`)が描画中に呼ぶ。
    `law-of-demeter-stage` の02(3.2)は `HintPanel.tsx` でも描画中に模範解答を当てる予定で、「`stageCatalog.test.ts` が守るので例外処理は足さない」としている
  - `src/presentation/preview/CodebasePreviewContext.ts` 13行目(Provider の外で使うと `throw`)
  - 28件のパイプラインが、メソッドエディタ・クラスノード・採点欄・キャンバスの描画を並行して書き換え、Codexの実装がレビュー後に**自動マージ**される(`docs/pipeline/README.md`「自動マージについて」)。
    どこかの描画に、特定のステージ・特定の操作の後でだけ起きる例外が紛れ込んでも、E2E が全ステージ・全操作を網羅していない限り気づけない
- `stage-draft-persistence` がマージされると、途中経過がリロード後も**復元**される。もし復元した途中経過の描画で例外が出ると、
  リロードするたびに同じ例外で真っ白になり、**localStorage を手で消す以外に抜け出せない**(描画が落ちるので「最初に戻す」ボタンにも届かない)。
  同件の02は「形だけ検証すれば画面は壊れない」を前提にしているので、その前提が外れたときの逃げ道が要る

ponytail の階段では「React の標準機能でできるか?」で止まる見込み: React のクラスコンポーネントのエラー境界(`getDerivedStateFromError`)を1つ書き、
画面の大きな区切り(リファクタリング・設計くらべ・白紙設計のそれぞれ、または左右のパネル単位)を包むだけ。`react-error-boundary` などの新しい依存は足さない。
代わりの表示から呼ぶ操作(`undo`・`resetStage`)はストアに既にある。React 19 の `createRoot` の `onCaughtError`/`onUncaughtError` オプションで
コンソールへの記録をそろえることもできる(使うかは仕様設計で決める)。domain / application・ストア・ステージデータ・採点は変更しない見込み。

## 関連する既存コード

- `src/main.tsx` — `createRoot(container).render(<StrictMode><App /></StrictMode>)`。エラー境界なし。React 19 の `createRoot` のオプションを足す場合の変更先
- `src/presentation/App.tsx` — `RefactorView`(15〜29行目)と、3つのモードの `app__view`(56〜68行目)。**包む位置の第一候補**
- `src/presentation/blank/BlankDesignView.tsx` 55〜61行目 — 白紙設計は `GameStoreContext.Provider value={blankStore}` の**内側**で描く。
  エラー境界を Provider の**外**(`App.tsx`)に置くと、代わりの表示の `useGameStore` はリファクタリングのストアを指してしまう(下の論点)
- `src/presentation/store/useGameStore.ts` — `undo`・`resetStage`(402〜406行目。変更依頼の実装中は何もしない)・`endChangeRequests`・`GameStoreContext`(423行目)。**読むだけ**
- `src/domain/stage/sampleAnswer.ts` 79〜108・383行目、`src/presentation/stage/StagePanel.tsx` 53〜72行目(`PreviewButtons`)、`src/presentation/stage/HintPanel.tsx`、
  `src/presentation/preview/CodebasePreviewContext.ts` 13行目 — 描画中に例外を投げうる実例(**読むだけ**)
- `src/infrastructure/quizzes/comparisonQuizzes.ts` 10・16行目 — モジュールの読み込み時の `throw`。エラー境界では受け止められない(スコープ外の例として読むだけ)
- `vite.config.ts` 11行目 — Vitest の `environment: 'jsdom'`。`react-dom/client` と React 19 の `act` だけで、例外を投げる子を包んだときに代わりの表示が出ることを
  新しい依存なしで確かめられる見込み(`src/` に `.test.tsx` はまだ無い。`eslint.config.js` 56行目のテスト用の緩和は `**/*.test.tsx` も対象)
- `docs/pipeline/stage-draft-persistence/02-draft-spec.md` 206〜207行目 — 「中身の整合性は検証しない。画面は壊れない」という前提
- `docs/pipeline/law-of-demeter-stage/02-draft-spec.md` 61〜70行目 — `HintPanel` で描画中に模範解答を当て、例外処理は足さないという方針

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の新しいファイル1つ(エラー境界と代わりの表示)、`App.tsx` の数行、CSS の数行、テスト1本。
domain / application / infrastructure・ストア・ステージデータ・採点・キャンバスは変更しない見込み。

1. **今回やる**:
   - 画面の描画中に例外が起きても、落ちるのはその区切りの中だけにし、残りの画面(モード切り替え・ステージ選択など)は使えるままにする
   - 代わりの表示に「何が起きたか」の短い日本語の説明と、立て直す手段(例: 「1手戻す」「もう一度表示する」「このステージを最初に戻す」)を出す。
     コードベースと Undo の履歴は消さない
   - リファクタリング・設計くらべ・白紙設計の3つのモードすべてに効かせる(白紙設計は自分のストアの操作を呼べるようにする)
   - 例外を投げる子を包んだときに代わりの表示が出ること、立て直しの操作で元の表示に戻ることを、テストで確かめる
2. **後回し**:
   - イベントハンドラ・非同期処理(ドラッグの終了・AI講評の取得など)の例外。エラー境界は**描画中の例外しか受け止めない**。
     ストアの操作が投げた例外を画面に出す仕組みは、実害が出てから
   - 例外の内容をどこかへ送る(ログ収集)。今は外部のサービスを持たない(YAGNI)
   - モジュール読み込み時の例外(`comparisonQuizzes.ts` の `throw` など)。エラー境界の外側なので、題材データのテストで守る今の形のまま
   - 途中経過(`stage-draft-persistence`)の保存値を代わりの表示から消す専用のボタン。「最初に戻す」で足りるかを、あちらのマージ後に見て決める

仕様設計者に決めてほしい論点(ここでは決めない):

- **包む単位**: モードごと(`App.tsx` の3つの `app__view` の中身)か、もっと細かく(キャンバス・メソッドエディタ・ステージの欄それぞれ)か。
  細かいほど落ちる範囲は狭いが、包む先のファイル(`StagePanel.tsx`・`CodebaseCanvas.tsx` など、進行中の件が触るもの)に差分が広がる。
  モードごとなら `App.tsx` だけで済む
- **白紙設計のストア**: エラー境界(と代わりの表示)を `BlankDesignView.tsx` の Provider の**内側**に置くか、`App.tsx` から包んで代わりの表示に使うストアを渡すか。
  `BlankDesignView.tsx` は `blank-design-second-problem` が大きく触る予定なので、`App.tsx` 側で済む形が衝突は少ない(`blankStore` は今 export されていない)
- **代わりの表示に出す操作**: 「1手戻す」「もう一度表示する」「このステージを最初に戻す」のどれを出すか。変更依頼の実装中(`changeSession` がある)は
  `resetStage` が何もしないので、実装を終える(`endChangeRequests`)も要るか。設計くらべ(ストアを使わない)では「もう一度表示する」だけでよいか
- **もう一度表示する条件**: 立て直しの操作のあと自動で包み直すか(ストアのコードベースが変わったら戻す、など)、ボタンで戻すか
- **例外の内容を見せるか**: プレイヤー向けの説明だけにするか、`error.message` も小さく出すか(不具合報告に役立つが、英語の内部メッセージが出る)。
  コンソールへの記録を `createRoot` のオプションでそろえるか
- **アクセシビリティ**: 代わりの表示を `role="alert"` で読み上げるか、見出しへフォーカスを移すか(設計くらべの `Verdict` のフォーカス移動の前例がある)
- **テストの形**: `src/presentation/` に初めての `.test.tsx` を置き、`react-dom/client` + `act` で確かめるか。E2Eで確かめる場合、本番のコードに
  テスト専用の「わざと落とす」入口を作らずに済む方法があるか(無ければユニットテストだけでよいか)

### 既存パイプラインとの衝突可能性

「モードごとに `App.tsx` で包む」前提の見立て(細かく包む場合は、上の論点のとおり衝突が大きくなる)。

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| 新規 `src/presentation/<名前>.tsx`(+テスト) | エラー境界と代わりの表示 | なし | なし |
| `src/presentation/App.tsx` | 3つのモードの中身(`RefactorView` の中、または56〜68行目)を包む。import 1行 | `operation-guide`(02: `<nav className="mode-switch">` の末尾に `<OperationGuide />` を1行、import 1行) | 差分の位置は離れている(向こうは38〜54行目の `nav`、本件は15〜29行目・56〜68行目)。**import 行が隣り合うテキスト上の競合はありうる(小さい。手で直せる)** |
| `src/main.tsx` ※ `createRoot` のオプションを使う場合のみ | 数行 | なし | なし |
| `src/index.css` | 代わりの表示の見た目を数行 | 多数(`color-contrast-a11y`・`class-dependency-focus`・`implements-arrow-style`・`stage-rules-summary`・`operation-guide`・`method-call-references` など) | 追記位置の競合はありうる(小さい)。色は `color-contrast-a11y` が直す `:root` の変数を使えば、あちらの変更にそのまま乗る |
| `src/presentation/blank/BlankDesignView.tsx` ※ 白紙設計の境界を Provider の内側に置く場合のみ | 包む1〜2行、または `blankStore` の export | `blank-design-second-problem`(問題の選択欄・1問目固定の `problem` の置き換えで大きく触る) | **この場合は競合が大きい**。`App.tsx` 側で済む形を推奨の候補にしてほしい |

- **読むだけで変更しないファイル**: `useGameStore.ts`・`StagePanel.tsx`・`HintPanel.tsx`・`sampleAnswer.ts`・`CodebasePreviewContext.ts`・`comparisonQuizzes.ts`・`vite.config.ts`・`eslint.config.js`
- **触らないファイル**: `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`stageCatalog.test.ts` を含む)・`score.ts`・`describeScore.ts`・
  `CodebaseCanvas.tsx`・`ClassNode.tsx`・`MethodChip.tsx`・`FieldChip.tsx`・`FileNode.tsx`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`ComparisonQuizView.tsx`・
  `ChangeRequestPanel.tsx`・`CritiquePanel.tsx`・`layoutCodebase.ts`・`workers/critique/`・`e2e/refactor.spec.ts`(E2Eを足す場合も新しい spec ファイルにする)
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `stage-draft-persistence`: 途中経過をリロード後に復元するので、描画の例外が「リロードしても直らない」形になりうる。本件の代わりの表示の「このステージを最初に戻す」は
    `resetStage` で初期のコードベースを積むだけなので、あちらが保存を `subscribe` で記録する形なら、戻した状態がそのまま保存されて抜け出せる見込み(どちらが先でも動く)
  - `law-of-demeter-stage`: `HintPanel.tsx` で描画中に模範解答を当てる(例外処理は足さない)。本件が入れば、万一の例外でもヒントの区切り(または画面のその部分)だけが落ちる
  - `operation-guide`: 同じ `App.tsx`。ガイドのダイアログは `nav` の中にあるので、包む単位をモードごとにすればガイドはエラー境界の外に残り、落ちても開ける
  - `color-contrast-a11y`: 代わりの表示の文字色は、あちらが直す色の変数を使う
  - 描画を変える進行中の件(`method-call-references`・`score-deduction-locations`・`class-dependency-focus`・`codebase-code-view` など)は、本件のマージ後は
    万一の描画の例外が画面全体に広がらなくなる(各件の実装は変えない)
