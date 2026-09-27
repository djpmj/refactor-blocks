# 機能探索: AI講評の取得を途中で止まらず、別ステージに混ざらないようにする

- slug: `critique-request-robustness`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

## 背景・目的

CLAUDE.md の「採点はルールベースとAI講評の2段構え」のうち、AI講評のクライアント側(ブラウザ→Cloudflare Workers)は
`docs/auto-dev/TASKS.md` の2タスクで最小限だけ作られ、その後は手が入っていない。コードを追うと、プレイヤーが
実際に踏みうる弱点が3つある。

1. **ステージを切り替えると、前のステージの講評が後から出てくる(競合状態)**
   `useGameStore.ts` の `critiqueActions.requestCritique` は、通信の完了時に無条件で `set({ critique: ... })` する。
   一方 `selectStageState` はステージ切り替え時に `critique: EMPTY_CRITIQUE` へ戻す。講評の取得中(「AIが講評中…」)に
   ステージを切り替えると、いったん空になったあとで**前のステージの講評文が新しいステージの画面に表示される**。
   `CritiqueState` のコメント「別ステージの講評が残らないようにする」という意図が、取得中の切り替えでは守られていない。
2. **講評APIが応答しないと、ボタンが「AIが講評中…」のまま押せなくなる**
   `critiqueClient.ts` の `fetchCritique` は `fetch` にタイムアウトを付けていない。Workers側はClaude APIの応答を
   待って返すため、上流が詰まるとブラウザ側はいつまでも待ち、`loading: true` のままボタンが `disabled` になり続ける。
   再試行もできず、リロードするしかない(リロードすると編集中のコードベースも消える)。
   CLAUDE.md の ponytail 方針で「手を抜かないもの」に挙がっている「データ消失を防ぐエラー処理」「信頼境界」に当たる。
3. **講評をもらった後に編集しても、古い講評がそのまま残る**
   `critiqueActions` に `// ponytail: 講評取得後にコードベースを編集しても、講評は自動では消えない。…` という
   既知の手抜きコメントがある。今の画面では講評が「どの時点のコードに対するものか」がプレイヤーに分からない。

これまでのサイクルはステージ追加・採点ルール・クイズ・右クリックメニュー・ストア永続化に偏っていたため、
今回は呼び出し元が示した「AI講評APIクライアント側の改善」「E2Eで守られていない既存の弱点」の切り口から選んだ。
既存の `e2e/critique.spec.ts` は成功・取得中表示・HTTP 500の3ケースだけで、上記1・2はどちらもE2Eで守られていない。

### 既存テーマとの重複確認

- `docs/specs/` に講評クライアントの仕様書は無い(講評は `docs/auto-dev/TASKS.md` の完了済みタスク2件で作られた)
- `docs/pipeline/*/01-discovered.md` で講評を主題にしたものは無い。`stage-draft-persistence` は
  「AI講評の表示改善」を見送り候補に挙げているが、それは応答形式(テキストのみ)を変えない表示改善の話で、
  本件(通信の競合・タイムアウト・古さの扱い)とは別
- 呼び出し元が列挙した9件(ステージ追加3件・採点ルール1件・クイズ1件・白紙設計1件・右クリックメニュー2件・途中経過の保持1件)と
  テーマが重ならない

### 検討して見送った候補

- ヒント機能の拡充: `docs/specs/stuck-player-hints.md` と `HintPanel.tsx` で既に実装済み
- 依存関係の矢印の可視化: `DependencyHandles.tsx`・`TopRouteEdge.tsx`・`docs/specs/cyclic-dependency-class-highlight.md` で既に実装済み
- VSCode風ファイルツリー: 過去の探索と同じ理由(新しいペイン・dnd-kitのドロップ先・E2Eが要り、1回のPRには大きい)で見送り

## 関連する既存コード

- `src/infrastructure/critique/critiqueClient.ts` — `fetchCritique`(タイムアウト無し。エンドポイント未設定・HTTPエラー・応答の形の不正をすべて `throw`)
- `src/application/CritiqueUseCases.ts` — `RequestCritique` 型・`requestCritiqueUseCase`(例外を `Result` の `'request-failed'` に変換)・
  `CritiqueError`(今は `'request-failed'` の1種類のみ)・`describeCritiqueError`
- `src/application/CritiqueUseCases.test.ts` — 既存のユースケースのテスト(AAA)。エラー種別を増やすならここにTDDで足す
- `src/presentation/store/useGameStore.ts`
  - `CritiqueState` / `EMPTY_CRITIQUE`
  - `critiqueActions`(完了時に無条件で `set`。ponytailコメントあり)
  - `selectStageState`(講評を空に戻す)
  - `commit` / `travelTo` / `startChangeRequests` などコードベースを差し替える箇所(3の「古い講評」を判定するなら関係する)
- `src/presentation/critique/CritiquePanel.tsx` — ボタン・エラー(`role="alert"`)・講評文(`data-testid="critique-text"`)の表示
- `src/presentation/stage/StagePanel.tsx` — `CritiquePanel` の呼び出し(変更依頼の調査中は `disabled`)とステージ選択
- `src/domain/critique/critiqueRequest.ts` — 送信データ(本件では変えない見込み)
- `workers/critique/src/index.ts` — Workers側。本件はブラウザ側の改善が主で、Workersは変えない見込み
- `e2e/critique.spec.ts` — `page.route` で講評エンドポイント(`**/__critique-test__`)をモックする既存パターン。
  応答を遅らせるケースも既にあり、「取得中にステージを切り替える」「応答しない」ケースを同じ書き方で足せる
- `.env.test` — E2E用の `VITE_CRITIQUE_ENDPOINT`

白紙設計モード(`src/presentation/blank/`)は `createGameStore` を使うが講評パネルを出していない(grepで確認済み)ため、影響しない。

## スコープの見立て

1回のPRに収まる小さな規模と見る。触る層は infrastructure(クライアント)・application(エラー種別)・
presentation(ストアと表示)で、domain には手を入れない見込み。新しい依存も要らない
(タイムアウトは標準の `AbortSignal.timeout` などで足りる見込み。採否は仕様設計で決める)。

優先順位の見立て:

1. **必須**: 取得中にステージを切り替えたら、前のステージの講評を捨てる(競合状態のバグ修正)
2. **必須**: 講評APIが一定時間応答しなければ打ち切り、ボタンを再び押せるようにする(エラーとして知らせる)
3. **任意**: 講評取得後にコードベースを編集したとき、講評が古いことを示す(または消す)。
   既存のponytailコメントの解消に当たる。仕様が膨らむようなら1・2だけをこのPRにし、3は後回しにする

仕様設計者に決めてほしい論点(ここでは決めない):

- 古い応答を捨てる判定の単位(ステージIDで比べるか、リクエストごとの連番で比べるか。後者なら2連打や変更依頼の開始にも効く)
- タイムアウトの秒数と、タイムアウト時のメッセージを既存の `'request-failed'` と分けるか(`CritiqueError` に種別を足すか)
- エンドポイント未設定(`VITE_CRITIQUE_ENDPOINT` が空)を、通信失敗と区別して表示するか
- 3をやる場合、「古い」と示すのか講評を消すのか、Undoで講評時点のコードに戻ったらどう扱うか
- E2Eでタイムアウトを確かめる方法(実時間で待つとテストが遅くなるため、秒数の注入やPlaywrightの時計操作をどうするか)

### 既存パイプラインとの衝突可能性

- `src/presentation/store/useGameStore.ts` を触る。**`stage-draft-persistence` が同じファイルの `selectStageState` を
  書き換える予定**のため、テキスト上の競合が起きる可能性が最も高い。本件の変更は `critiqueActions` と `CritiqueState`
  周りに寄せ、`selectStageState` 自体の書き換えは最小にする(講評を空に戻す既存の1行を残す)ことで衝突を小さくできる。
  また、途中経過の保持が入ると「同じステージへ戻ってくる」ケースが生まれるため、古い応答の判定をステージIDだけで行うと
  「A→B→Aと切り替えたときにAの古い応答が採用される」余地が残る点に注意(判定単位の論点に関係する)
- `src/application/CritiqueUseCases.ts`・`src/infrastructure/critique/critiqueClient.ts`・`src/presentation/critique/CritiquePanel.tsx`・
  `e2e/critique.spec.ts` は、列挙された9件のどのパイプラインも触る予定が無い
- `inline-method-stage`・`duplicate-code-scoring` は講評の送信データ(`critiqueRequest.ts`)を「変更不要」としており、本件も
  送信データは変えない見込みのため衝突しない
