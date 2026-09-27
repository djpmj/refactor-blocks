# 01 機能探索: AI講評Workersの入力を「知っている形」に詰め直し、指示と採点データを分けて渡す

- slug: `critique-worker-hardening`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

## 背景・目的

AI講評はブラウザ → Cloudflare Workers(`workers/critique/src/index.ts`)→ Claude API の順に流れる。Workersは
**認証なしで誰でも呼べるプロキシ**で(README・コメントに明記)、APIキーの費用はリポジトリの持ち主が払う。
ブラウザ側の弱点は `critique-request-robustness` が扱っているが、Workers側は `docs/auto-dev/TASKS.md` の
最初のタスクで作られたあと、レート制限を足した以外は手が入っていない。コードを追うと、信頼境界に次の穴がある。

1. **検証を通った「生の」JSONが、そのままプロンプトに入る**
   `isCritiqueRequestBody` は既知の項目の型を見るだけで、`buildPrompt` は受け取ったオブジェクトを
   `JSON.stringify({ score: request.score, files: request.files })` で丸ごと埋め込む。未知のキー・長い文字列は
   20,000文字(`MAX_BODY_LENGTH`)まで素通りする。`score.deductions` は `Array.isArray` しか見ていない
   (`score-deduction-locations/02-draft-spec.md` 45〜47行目でも同じ指摘がある)。
2. **指示とデータが1つのユーザーメッセージに混ざっている**
   `goal` は `ステージの目標: ${request.goal}` として指示文の直後に文字列連結で入る。ファイルのパス・クラス名・
   メソッド名はプレイヤーが名前の変更(`renameClass`/`renameFile`/`renameMethod`)で自由に付けられ、長さの上限も無い
   (`naming.ts` は空と重複しか弾かず、`maxLength` もリポジトリに無い)。curl で直接叩けば `goal` に任意の依頼文を書けるので、
   **講評用のプロキシを、上限1024トークンの汎用チャットとして使われる**余地がある(IPごと1分10回のレート制限はあるが、
   用途外利用そのものは防げない)。`system` プロンプトは使っていない。
3. **型の複製がアプリ本体とずれている**
   Workersの `CritiqueRequestBody` は `name`/`visibility`/`lines` しか知らないが、アプリ本体の `CritiqueRequest`
   (`src/domain/critique/critiqueRequest.ts`)は後から `superclassName`・`interfaceNames`・`fields`・`stub`・`enviedClassName`
   が足されている。今は「検証されないまま素通しでプロンプトに入る」ことで偶然動いているだけで、1を直して項目を
   絞るなら、これらを正しく検証対象に含める必要がある。
4. **検証ロジックにテストが無い**
   `workers/` は `eslint.config.js` の対象外・ルートの `npm run check` の対象外で、`workers/critique/package.json` には
   `typecheck` しか無い。`isCritiqueRequestBody` 系の純粋関数を守るテストは1件も無い。
5. (任意)**CORS が `Access-Control-Allow-Origin: *`**
   任意のWebサイトのJavaScriptから講評APIを呼ばせられる。curl は防げないが、他サイトに埋め込まれて訪問者のIPで
   レート制限の枠を消費される形の乱用は、許可するオリジンを絞れば防げる。

CLAUDE.md の ponytail 方針で「手を抜かないもの」に挙がっている**信頼境界での入力検証(…AI講評APIの応答など)**と**セキュリティ**に
正面から当たる。これまでの15件はステージ・採点・クイズ・キャンバス・ストア・ブラウザ側の通信に集中しており、
**Workers側を主題にしたものは無い**。また、呼び出し元が「複数件が触る予定」と挙げたファイル群を一切触らずに済む切り口である。

### 既存テーマとの重複確認

- `critique-request-robustness`(02完了): ブラウザ側(`critiqueClient.ts`・`CritiqueUseCases.ts`・`useGameStore.ts`・`CritiquePanel.tsx`)の
  競合状態・タイムアウト。01で「Workersは変えない見込み」、02の「スコープ外」に「Workers側のタイムアウト・上流の打ち切り」と明記 → 重複しない
- `score-deduction-locations`(02完了): 02で `workers/critique/` と `critiqueRequest.ts` を**変更しない**と明記 → 重複しない
- `duplicate-code-scoring`(02完了): Workersは `rule` を素通しするので変更不要と明記 → 重複しない
- `docs/specs/` 24件: `fields-and-feature-envy.md`・`cohesion-value-object-anemic.md` は「`workers/critique/` は変更しない」と明記。
  Workersの検証・プロンプト・CORSを主題にした仕様書は無い(`Allow-Origin`・`プロンプト`・`injection` でgrepして該当なし)
- 呼び出し元が列挙した15件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **デメテルの法則(Hide Delegate)や Observer などの新ステージ**: ステージ追加は必ず `sampleAnswer.ts` の `sampleAnswerSteps` に
  模範解答を足す必要があり(`stageCatalog.test.ts`・`HintPanel.tsx`・`StagePanel.tsx` が参照)、呼び出し元の「これ以上大きく手を入れない」に当たる
- **フィールドの名前の変更(Rename Field)**: メソッド・クラス・ファイルの名前変更はあるがフィールドだけ無い。ただしフィールド名は採点に関わらず
  学習上の困りごとが見当たらない(YAGNI)。UIは `useGameStore.ts` にアクションを足す必要もある
- **ステージ選択での自己ベスト点・次のステージへ**: 過去の探索と同じく `StagePanel.tsx` が複数パイプラインから触られる予定で、学習の中身も増えない
- **変更依頼の種類の追加・タブレット対応・多言語対応**: 過去の探索と同じ理由(1回のPRには大きい)
- **Workersのテストをルートの CI(`ci.yml`)に組み込む**: 本件の「任意」の範囲。CIの形を変えるので、膨らむなら後回し

## 関連する既存コード

- `workers/critique/src/index.ts` — 主な変更先。
  - `CritiqueRequestBody`(13〜29行目。アプリ本体の型の手書き複製)
  - `MAX_BODY_LENGTH`・`MODEL`・`MAX_OUTPUT_TOKENS`(32〜34行目)
  - `isMethodSummary`/`isClassSummary`/`isFileSummary`/`isCritiqueRequestBody`(42〜69行目。検証。`score.deductions` の中身は見ていない)
  - `buildPrompt`(72〜81行目。指示と `goal`・採点JSONを1つの文字列に連結)
  - `handleCritique`(`messages` に user を1件だけ渡す。`system` 未使用)
  - `jsonResponse` と `fetch` の OPTIONS 応答(`Access-Control-Allow-Origin: *`)
- `workers/critique/wrangler.toml` — `[[ratelimits]]` のみ。許可オリジンを `[vars]` に置くならここ
- `workers/critique/package.json`・`tsconfig.json` — `typecheck` だけ。テストの仕組みは無い
- `workers/critique/README.md` — デプロイ手順・レート制限の説明。変更したら追記する先
- `src/domain/critique/critiqueRequest.ts` — 送信側の正しい形(`CritiqueRequest`・`CritiqueFileSummary`・`CritiqueClassSummary`・
  `CritiqueMethodSummary`・`CritiqueFieldSummary`)。Workers側の検証はこれに合わせる。**本件では変更しない想定**
- `src/domain/scoring/score.ts` — `ScoreDeduction`(`rule`/`count`/`points`)。`score.deductions` の要素の形。読むだけ
- `src/infrastructure/critique/critiqueClient.ts` — ブラウザ側。応答が `{ critique: string }` でなければ例外。
  Workersの応答形式を変えない限り触らない
- `e2e/critique.spec.ts` — Workersを `page.route` でモックしているので、Workers側の変更はE2Eに影響しない
- `eslint.config.js` 18〜19行目・`vite.config.ts` 15行目 — `workers/**` はlint対象外。ルートのVitestは `e2e/**` 以外を拾うため、
  `workers/critique/src/` に `*.test.ts` を置くとルートの `npm test` に拾われる可能性がある(`@anthropic-ai/sdk` や Workers の
  グローバル型 `RateLimit` はルートに無いので、テスト対象の純粋関数をSDKに依存しないファイルへ分ける必要が出る)

## スコープの見立て

小〜中。1回のPRに収まる。変更は `workers/critique/` の中に閉じ、アプリ本体(`src/`)・E2Eは触らない見込み。新しい依存は極力足さない。

優先順位の見立て:

1. **必須**: 受け取ったJSONを、アプリ本体の `CritiqueRequest` と同じ「知っている項目だけ」の新しいオブジェクトに詰め直してから
   プロンプトに使う(未知のキーは捨てる。`score.deductions` の要素も検証する。`superclassName`/`interfaceNames`/`fields`/`stub`/`enviedClassName`
   を落とさない)。文字列の長さ・配列の件数・数値の範囲に上限を設ける
2. **必須**: 講評の指示を `system` に移し、`goal` と採点データは「データ」としてユーザーメッセージに区切って渡す。
   データ中の文言を指示として扱わず、講評以外の依頼には応じないよう指示する
3. **必須**: 1の検証・詰め直しを純粋関数に切り出し、テストで守る(置き場所とテストの走らせ方は仕様設計で決める)
4. **任意**: CORS の許可オリジンを `wrangler.toml` の設定で絞る(未設定なら今と同じ `*` にするか等)。README に手順を追記
5. **後回し**: ルートCIでWorkersのテスト・型チェックを回す、Workers側のClaude API呼び出しのタイムアウト

仕様設計者に委ねる論点(ここでは決めない):

- 上限の具体値(`goal`・パス・クラス名・メソッド名・フィールド名の文字数、ファイル・クラス・メソッド・減点の件数)。
  現行の全ステージの最大規模を超えない範囲で、今のステージ・白紙設計で400を返さないこと(`stages` から作った `CritiqueRequest` で確かめる方法を含めて)
- 上限を超えたときに 400 で弾くか、切り詰めて通すか(プレイヤーが長い名前を付けただけで講評が取れなくなるのは避けたい)
- `visibility` を `'public' | 'private' | 'protected'` に絞るか、`rule` を既知の値に絞るか(`duplicate-code-scoring` などで規則が増えると
  Workersの再デプロイが要るので、`rule` は形だけ見る方が安全かもしれない)
- テストの置き場所と実行方法: ルートの Vitest に拾わせる(`workers/critique/src/*.test.ts`)か、`workers/critique/package.json` に
  `test` スクリプトを足すか。後者は `vitest` を Workers 側の devDependencies に足すことになる(ルートには既にある)
- 型の複製をやめて `src/domain/critique/critiqueRequest.ts` の型を import できるか(別デプロイ・別 `tsconfig` なので、
  今の「複製」方針を続けるのが妥当か)
- CORS をやる場合の許可オリジンの設定方法(`[vars]` か シークレットか)と、ローカル開発(`npm run dev` の `localhost`)での扱い
- 応答文の長さ(`MAX_OUTPUT_TOKENS` 1024)を講評に見合う値へ下げるか

### 既存パイプラインとの衝突の可能性

- **`workers/critique/` は15件のどのパイプラインも変更しない**(`critique-request-robustness`・`score-deduction-locations`・
  `duplicate-code-scoring` が明示的にスコープ外としている)。テキスト上の競合はほぼ無い
- 意味上の依存: 今後どこかのパイプラインが `CritiqueRequest` に項目を足すと、本件の「知っている項目だけに詰め直す」処理に
  その項目を足さない限り、AIに渡らなくなる。現時点の15件は `critiqueRequest.ts` を変えないと明記している
  (`score-deduction-locations` 02・`duplicate-code-scoring` 02)。`duplicate-code-scoring`・`inline-method-stage` などで
  `ScoreDeduction.rule` の値が増えるため、`rule` を既知の値に絞る案を採ると衝突する(上の論点)
- ルートの Vitest にテストを拾わせる案を採る場合、`vite.config.ts` の `test.exclude` を変える可能性がある(他パイプラインは触る予定なし)
- `score.ts`・`fileScores.ts`・`sampleAnswer.ts`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`CodebaseCanvas.tsx`・`useGameStore.ts`・
  `layoutCodebase.ts`・`index.css`・`StagePanel.tsx`・`critiqueClient.ts`・`CritiqueUseCases.ts` には触らない
