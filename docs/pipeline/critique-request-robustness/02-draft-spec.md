# 仕様草案: AI講評の取得を途中で止まらず、別ステージに混ざらないようにする

- slug: `critique-request-robustness`
- 元になった探索: `docs/pipeline/critique-request-robustness/01-discovered.md`
- 同時進行で衝突しうるパイプライン: `stage-draft-persistence`(`useGameStore.ts` の `selectStageState` を書き換える予定)

## 1. 背景・目的

AI講評のクライアント側に、プレイヤーが実際に踏む弱点が2つある(`01-discovered.md` の1・2。3は未決事項4で扱う)。

1. **古い応答の取り込み**: `useGameStore.ts` の `critiqueActions.requestCritique` は、通信が終わると無条件で
   `set({ critique: ... })` する。講評の取得中にステージを切り替えると、`selectStageState` がいったん
   `EMPTY_CRITIQUE` に戻したあとで、**前のステージの講評文が新しいステージの画面に出る**。
2. **応答が無いと操作できなくなる**: `critiqueClient.ts` の `fetchCritique` の `fetch` にタイムアウトが無い。
   講評API(Workers → Claude API)が詰まると `loading: true` のまま「AIが講評中…」ボタンが `disabled` になり続け、
   再試行できない。抜け出す手段がリロードしかなく、リロードすると編集中のコードベースが消える
   (ponytailの「手を抜かないもの」: データ消失を防ぐエラー処理・信頼境界)。

**本当に新しい仕組みが要るか**:

- 1には、新しい状態も連番のカウンタも要らない。リクエストを出すときに作った「取得中」の `CritiqueState`
  オブジェクトを覚えておき、応答が返ったときにストアの `critique` がまだ**同じオブジェクト**かどうかを比べれば足りる。
  ステージの切り替え(`selectStageState` が `EMPTY_CRITIQUE` を入れる)・再リクエスト(新しい取得中オブジェクトを入れる)の
  どちらでも参照が変わるので、古い応答は捨てられる。`selectStageState` は1行も触らずに済む(衝突回避)。
- 2には、新しい依存は要らない。標準の `AbortController` + `setTimeout` と、`fetch` の `signal` オプションで足りる。
  `AbortSignal.timeout()` の方が短いが、E2EでPlaywrightの時計操作(`page.clock`)が効くのは `setTimeout` のため、
  こちらを使う(未決事項3)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/application/CritiqueUseCases.ts` | application | `RequestCritique` に `signal` 引数を足す。`requestCritiqueUseCase` にタイムアウト(`AbortController` + `setTimeout`)を入れ、打ち切りを `'timeout'` エラーとして返す。`CritiqueError` と `CRITIQUE_ERROR_MESSAGES` に `'timeout'` を足す。秒数の定数 `CRITIQUE_TIMEOUT_MS` を export |
| 変更 | `src/application/CritiqueUseCases.test.ts` | application | タイムアウトのテストを先に書く(下記4) |
| 変更 | `src/infrastructure/critique/critiqueClient.ts` | infrastructure | `fetchCritique` が受け取った `signal` を `fetch` に渡すだけ |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `critiqueActions.requestCritique` だけを変更。取得中オブジェクトとの参照比較で古い応答を捨てる。既存のponytailコメントは未決事項4の結果に合わせて残す/消す |
| 変更 | `e2e/critique.spec.ts` | (E2E) | 「取得中にステージを切り替える」「応答しない→打ち切り→再試行」の2ケースを追加 |

変更しないもの: `selectStageState`・`commit`・`travelTo` などストアの他の部分、`CritiquePanel.tsx`(未決事項4で選択肢Bの場合のみ変更)、
`StagePanel.tsx`、`src/domain/critique/critiqueRequest.ts`(送信データ)、`workers/critique/`、`.env.test`。

## 3. データ/型の変更

ドメインモデル・永続化スキーマの変更は無し。application 層の型だけ変わる。

```ts
// src/application/CritiqueUseCases.ts
/** AI講評APIへの実際の通信。infrastructure層が実装を注入する。signal が中断されたら通信を打ち切ってrejectすること。 */
export type RequestCritique = (request: CritiqueRequest, signal: AbortSignal) => Promise<string>;

export type CritiqueError = 'request-failed' | 'timeout';

/** これだけ待っても応答が無ければ打ち切る(ミリ秒)。秒数は未決事項1。 */
export const CRITIQUE_TIMEOUT_MS = 30_000;
```

- `requestCritiqueUseCase` の引数は今の4つのまま(lintの引数上限4)。秒数は引数にせず、上の定数を使う(設定化はしない。YAGNI)
- エンドポイント未設定は今どおり `'request-failed'` に含める(未決事項2で選択肢Bになった場合のみ `'not-configured'` を足す)

### `requestCritiqueUseCase` の流れ

1. `buildCritiqueRequest` で送信データを作る(今どおり)
2. `AbortController` を作り、`setTimeout(() => controller.abort(), CRITIQUE_TIMEOUT_MS)` を仕掛ける
3. `requestCritique(request, controller.signal)` を待つ。成功なら `ok(講評文)`
4. 失敗したら、`controller.signal.aborted` が true なら `err('timeout')`、そうでなければ `err('request-failed')`
   (DOMException の `name` などは見ない。打ち切ったかどうかはこちらが持っている signal で判定する)
5. 成否にかかわらず `finally` で `clearTimeout` する(成功後にタイマーが残らないように)

`// ponytail: 注入された関数が signal を無視すると打ち切れない。fetch は signal を守るので Promise.race は足さない。通信手段を差し替えるときに見直す`
のコメントを残す。

### `fetchCritique`

`fetch(endpoint, { method, headers, body, signal })` と `signal` を渡すだけ。`response.json()` の読み込み中に打ち切られても
同じ `signal` で reject されるので、追加の処理は要らない。エラーの投げ方(未設定・HTTPエラー・応答の形の不正)は今のまま。

### `critiqueActions.requestCritique`(ストア)

```ts
requestCritique: () => {
  const { codebase, stage } = get();
  const score = scoreCodebase(codebase, stage);
  const pending: CritiqueState = { text: null, loading: true, error: null };
  set({ critique: pending });
  void requestCritiqueUseCase(codebase, stage, score, fetchCritique).then((result) => {
    // ステージの切り替え・再リクエストで講評の状態が差し替わっていたら、古い応答なので捨てる
    if (get().critique !== pending) return;
    set({ critique: result.ok ? ... : ... }); // 中身は今どおり
  });
},
```

- 取得中のオブジェクトは**リクエストのたびに新しく作る**こと(定数として共有すると、2回目のリクエストで1回目の応答を捨てられない)
- `stage-draft-persistence` が講評の状態(特に `loading: true` のもの)をステージごとに保存・復元しない限り、この比較は
  A→B→Aと戻ったときも正しく捨てる(戻ったときの `critique` は `EMPTY_CRITIQUE` で、取得中オブジェクトとは別物)。
  最終仕様・実装時に `stage-draft-persistence` 側の仕様で講評を保存対象に含めていないことを確認する
- 変更依頼の開始(`startChangeRequests`)では `critique` を差し替えないので、取得中の講評はそのまま表示される。
  講評は挑戦前のコード(`changeSession.base` と同じもの)に対するものなので、それで正しい

## 4. TDD対象の純粋関数

### `requestCritiqueUseCase`(`src/application/CritiqueUseCases.ts`)

非同期だが、通信は注入するので Vitest で先にテストを書ける。タイマーは `vi.useFakeTimers()` と
`vi.advanceTimersByTimeAsync()` で進める(実時間で30秒待たない)。1ケース1つの `it`、AAAで書く。

- 正常系(既存): 注入した関数が成功したら `ok(講評文)`
- 異常系(既存): 注入した関数が(打ち切り以外で)失敗したら `err('request-failed')`
- 正常系: 注入した関数に `AbortSignal` が渡され、呼び出し時点では `aborted` が false
- 異常系: 注入した関数が応答しない(signal の `abort` イベントで reject する Promise を返す)とき、
  `CRITIQUE_TIMEOUT_MS` 経過で `err('timeout')` を返す
- 境界: `CRITIQUE_TIMEOUT_MS - 1` ミリ秒の時点ではまだ結果が出ていない(Promise が未解決)
- 正常系: タイムアウト前に成功したら、その後 `CRITIQUE_TIMEOUT_MS` を過ぎても signal は中断されない
  (`clearTimeout` されている)

既存の2ケースは、注入関数の引数が増えても書き換えずに通ること(引数の少ない関数は代入できる)。

### `describeCritiqueError`

- `'timeout'` のメッセージを返す(文言は未決事項1)
- `'request-failed'` の既存ケースはそのまま

ストア(`critiqueActions`)の参照比較は presentation 層のためユニットテスト対象外。E2Eで守る(下記5)。

## 5. 受け入れ基準

- [ ] `CritiqueUseCases.test.ts` にタイムアウトのテストを先に書き(Red)、実装して通る(Green)。既存テストも書き換えずに通る
- [ ] 講評の取得中にステージを切り替え、そのあと前のステージへの応答が返っても、新しいステージの画面に講評文が出ない
- [ ] 講評APIが `CRITIQUE_TIMEOUT_MS` 応答しなければ、`role="alert"` にタイムアウトのメッセージが出て、ボタンが「AIの講評をもらう」に戻り押せる
- [ ] 打ち切りのあと、もう一度ボタンを押して講評を受け取れる(再試行できる)
- [ ] 打ち切られた通信は `fetch` レベルで中断される(`signal` が `fetch` に渡っている)
- [ ] 成功・取得中表示・HTTP 500 の既存E2E(`e2e/critique.spec.ts`)が変更なしで通る
- [ ] E2E(`e2e/critique.spec.ts`)に次を追加し通る。**どちらも修正前のコードでは失敗すること**を実装者が一度確かめる
  - **取得中にステージを切り替える**: `page.route` の中で、テスト側から解決できる Promise を待ってから `route.fulfill({ json: { critique: '前のステージの講評' } })` する。
    ボタンを押す →「AIが講評中…」を確認 → `getByLabel('ステージ').selectOption(...)` で別ステージへ →
    Promise を解決して応答を返す → 応答の読み込み完了(`page.waitForEvent('requestfinished')` など)を待ち、1フレーム進めたうえで
    `critique-text` が0件、ボタンが「AIの講評をもらう」で押せることを確かめる
  - **応答しない→打ち切り→再試行**: `page.clock.install()` を `page.goto` より前に呼ぶ。`page.route` は1回目は応答せず(fulfillしない)、
    2回目は講評を返す。ボタンを押す →「AIが講評中…」→ `page.clock.fastForward()` / `runFor()` で `CRITIQUE_TIMEOUT_MS` 以上進める →
    タイムアウトのメッセージの `alert` と押せるボタンを確認 → もう一度押して講評文が出ることを確認
    (`page.clock` で進まない場合は、秒数をenvで注入する等の別の手段に進まず報告する)
- [ ] `selectStageState` の差分が無い(`stage-draft-persistence` との衝突回避)
- [ ] `npm run check`(lint + typecheck + test)と `npm run test:e2e` が通る

## 6. スコープ外

- ステージ切り替え時に取得中の通信そのものを中断すること(応答を捨てれば画面上の不具合は直る。中断には `selectStageState`/`selectStage` を触る必要があり衝突する)
- 自動再試行・指数バックオフ(プレイヤーがボタンを押し直せれば足りる)
- タイムアウト秒数の設定化(env・引数)。定数1つで足りる
- Workers側(`workers/critique/`)のタイムアウト・上流の打ち切り
- 送信データ(`critiqueRequest.ts`)・応答形式の変更、講評の表示の改善
- 取得中の「キャンセル」ボタン
- 講評取得後にコードを編集したときの扱い(未決事項4で選択肢B/Cになった場合を除く)

## 未決事項

### 未決事項1: タイムアウトの秒数と、打ち切ったときのメッセージ

Workersは `claude-haiku-4-5`・`max_tokens: 1024` で講評を作るため、通常は10秒前後で返る見込み。

- 選択肢A(推奨): 30秒。メッセージは「AI講評の応答がありませんでした。しばらくしてからもう一度お試しください」。通常の応答時間の数倍の余裕があり、詰まったときも待たせすぎない
- 選択肢B: 60秒。メッセージは選択肢Aと同じ。混雑時の遅い応答も拾えるが、詰まったときの待ち時間が長い
- 選択肢C: 15秒。メッセージは選択肢Aと同じ。すぐ操作に戻れるが、混雑時に正常な応答まで打ち切る恐れがある
- 選択肢D: 秒数は30秒で、メッセージは既存の `'request-failed'` と同じ文言にする(エラー種別は分けるが表示は共通)

### 未決事項2: エンドポイント未設定(`VITE_CRITIQUE_ENDPOINT` が空)を、通信失敗と区別して表示するか

- 選択肢A(推奨): 区別しない(今どおり `'request-failed'`)。未設定は開発・デプロイ時の設定ミスで、プレイヤーが対処できるものではない。E2Eでも再現しにくい(`.env.test` に設定済み)
- 選択肢B: `'not-configured'` を足し、「AI講評はこの環境では使えません」と表示する。`fetchCritique` が専用のエラーを投げ、ユースケースがそれを見分ける仕組み(エラーのクラスか、`RequestCritique` の戻り値の変更)が要り、変更が膨らむ

### 未決事項3: タイムアウトをE2Eでどう確かめるか

- 選択肢A(推奨): Playwrightの時計操作(`page.clock.install()` + `fastForward`)で時間を進める。本番コードに手を入れずに済み、テストも速い。そのためにタイマーは `AbortSignal.timeout()` ではなく `setTimeout` + `AbortController` で作る(`page.clock` は `setTimeout` を差し替えるが、`AbortSignal.timeout()` は対象外のため)
- 選択肢B: 秒数を `VITE_CRITIQUE_TIMEOUT_MS` などのenvで注入し、`.env.test` で短く(例: 1秒)する。実時間で待つので時計操作は要らないが、テストのためだけの設定が増え、既存E2E「取得中は『AIが講評中…』を表示する」(300ms遅延)との兼ね合いも要る
- 選択肢C: タイムアウトはVitestのユニットテストだけで守り、E2Eは足さない。速いが、`signal` が `fetch` に渡っていること・ボタンが押せるようになることが画面上で守られない

### 未決事項4: 講評を受け取ったあとにコードを編集したとき、古い講評をどう扱うか(`01-discovered.md` の3。既存のponytailコメント)

- 選択肢A(推奨): 今回はやらない(スコープ外)。1・2のバグ修正に絞り、既存のponytailコメントは残す。探索でも「膨らむようなら後回し」とされている
- 選択肢B: 「古い」と表示する。`CritiqueState` に講評を頼んだ時点の `codebase` を持たせ、`CritiquePanel` で今のコード(`changeSession?.base ?? codebase`)と参照が違えば「この講評は編集前のコードに対するものです」と添える。取り消し(Undo)で講評時点のコードに戻ると、履歴が同じオブジェクトを返すので自然に表示が消える。変更は `CritiqueState`・`CritiquePanel.tsx`・E2E1件程度
- 選択肢C: 編集したら講評を消す。`commit`・`travelTo`・変更依頼の各操作など、コードベースを差し替えるすべての箇所に手が入り、`stage-draft-persistence` とも衝突しやすい
