# e2e-port-isolation: E2Eのポートを環境変数で変えられるようにし、別のworktreeのサーバーを黙って使わない

## 背景・目的

`playwright.config.ts` は、ポートを `5174` に固定し、`reuseExistingServer: !process.env.CI` にしている。
そのため、手元でポート 5174 に**別のworktreeの**開発サーバーが立っていると、Playwright はそれを再利用し、
**そのworktreeのコードに対して E2E が走る**。テストの結果は、今の作業ツリーのコードとは無関係になる。

2026-10-17 に、#180・#181・#187 を別々のworktreeで並行して実装・評価したとき、実際にこれが起きた。
ポート 5174 には #180 のworktreeの vite が立っており、ほかのworktreeのフルE2Eの結果と、「ベースでは通る」という比較が信用できなくなった。

ポートだけを変えればよいわけではなく、5174 は次の3か所に固定で書かれている。

- `playwright.config.ts` の `PORT`
- `e2e/storage-state.json` の `origin`(ツアー表示済み・ストーリーOFF の localStorage)。ポートを変えると効かなくなり、ツアーが出て多くのテストが壊れる
- `.env.test` の `VITE_CRITIQUE_ENDPOINT=http://localhost:5174/__critique-test__`(AI講評のモック先)

そこで、ポートを環境変数 `E2E_PORT` で変えられるようにし、3か所の固定をなくす。
あわせて、**既定では既存のサーバーを再利用しない**ようにする。ポートが使用中なら、黙って別のworktreeのサーバーを使わず、エラーで止める。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `playwright.config.ts` | — (テスト設定) | `E2E_PORT` からポートを決める。`reuseExistingServer` を `E2E_REUSE_SERVER=1` のときだけにする。`storageState` を config の中のオブジェクトにし、`origin` を `baseURL` に合わせる |
| 削除 | `e2e/storage-state.json` | — | 中身を `playwright.config.ts` へ移す |
| 変更 | `.env.test` | — | `VITE_CRITIQUE_ENDPOINT` を同一オリジンの相対パス `/__critique-test__` にする |
| 変更 | `CLAUDE.md` | — | 「コマンド」に `E2E_PORT`・`E2E_REUSE_SERVER` の使い方を足す |
| 変更 | `.claude/agents/evaluator.md`・`.claude/agents/codex-implement.md` | — | E2E を走らせるときは、worktreeごとに別の `E2E_PORT` を指定することを書く |
| 変更 | `.claude/agents/implementation-orchestrator.md` | — | 実装者・評価者を起動するときに、worktreeごとに別の `E2E_PORT` を割り当てて渡すことを書く |
| 変更 | `.codex/agents/evaluator.toml`・`codex-implement.toml`・`implementation-orchestrator.toml` | — | 上と同じ内容を Codex 用の定義にも書く |

`src/` のコードは変更しない(`critiqueClient` は相対パスの URL でもそのまま `fetch` できる)。

## データ・型の変更

なし。

### 環境変数

| 名前 | 既定 | 意味 |
| --- | --- | --- |
| `E2E_PORT` | `5174` | E2E 用の開発サーバーのポート。`baseURL`・`storageState` の `origin`・`webServer` の `--port` と `url` に使う |
| `E2E_REUSE_SERVER` | 未設定 | `1` のときだけ、ポートで立っている既存のサーバーを再利用する(手元で `npm run dev -- --port <E2E_PORT> --mode test` を立てたまま E2E を繰り返すとき用)。CI では常に再利用しない |

- `E2E_PORT` が 1024〜65535 の整数でなければ、config の読み込みで例外を投げて止める(メッセージに受け取った値を出す)
- ポートが使用中で、再利用しない設定のときは、Playwright がエラーで止まる(`webServer` の `--strictPort` は今のまま)

## TDD対象の純粋関数

なし(テスト設定とドキュメントの変更)。`src/` の `domain`/`application` 層は触らない。

## 受け入れ基準

1. `E2E_PORT` を指定せずに `npm run test:e2e` を実行すると、今と同じく 5174 でサーバーが立ち、全件が通る
2. `E2E_PORT=5191 npm run test:e2e` を実行すると、5191 でサーバーが立ち、全件が通る(ツアーが出ない。`e2e/critique.spec.ts` のモックも効く)
3. 別のworktreeの開発サーバーがポート 5174 に立っている状態で、`E2E_PORT` を指定せずに `npm run test:e2e` を実行すると、そのサーバーを使わずにエラーで止まる
4. `E2E_REUSE_SERVER=1` を付けたときだけ、既存のサーバーを再利用する
5. `E2E_PORT=abc` では、config の読み込みで受け取った値つきのエラーになる
6. リポジトリの中に `5174` の固定が `playwright.config.ts` の既定値の1か所だけになる(`docs/review-pr/LOG.md` などの過去の記録は除く)
7. `CLAUDE.md` と、Claude Code・Codex 両方のエージェント定義に、並行実行のときは worktreeごとに別の `E2E_PORT` を使うことが書かれている
8. `npm run check` が通る。CI の E2E ジョブ(`.github/workflows/ci.yml`)が通る

## スコープ外

- worktreeのパスからポートを自動で決めること(指定し忘れても、受け入れ基準3のとおりエラーで気づける)
- 開発サーバー(`npm run dev`、既定 5173)のポートの変更
- E2E のテストの中身の変更
- `docs/review-pr/LOG.md`・過去の仕様書(`docs/specs/story-default-on.md` など)の中の `storage-state.json` や 5174 の記述の書き換え
