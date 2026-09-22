# critique worker

AI講評のプロキシ。ブラウザから講評データ(`src/domain/critique/critiqueRequest.ts` の `CritiqueRequest`)を受け取り、
Claude APIを呼んで講評文だけを返す。`ANTHROPIC_API_KEY` はここ(Workersのシークレット)に置き、
ブラウザ側には一切渡さない。

アプリ本体(Vite)とは別デプロイなので、依存・ビルド・lintもこのディレクトリだけで完結させている
(ルートの `npm run check` の対象には含めていない)。

## デプロイ手順

```bash
cd workers/critique
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # 対話でAPIキーを入力する
npm run deploy
```

デプロイ後に表示されるURL(例: `https://refactor-blocks-critique.<account>.workers.dev`)を、
アプリ側の環境変数 `VITE_CRITIQUE_ENDPOINT` に設定する(`.env.production.local` など、
リポジトリにコミットしないファイルに置く)。

## 動作確認

```bash
npm run dev
```

別ターミナルから:

```bash
curl -X POST http://localhost:8787 \
  -H 'Content-Type: application/json' \
  -d '{"goal":"テスト","score":{"total":100,"deductions":[]},"files":[]}'
```

`{"critique":"..."}` が返ってくれば成功。

## モデル

`claude-haiku-4-5-20251001` を使う。認証なしで誰でも呼べるプロキシで、講評文も
3〜5文程度の軽い生成タスクのため、Opusほどの能力は過剰でAPI費用がかさむ。
Haikuに下げてコストを抑える。

## レート制限

認証なしで誰でも呼べるプロキシなので、Cloudflare WorkersのRate Limiting APIで
IPごとに1分間10回までに制限している(`wrangler.toml` の `[[ratelimits]]`)。
上限に達すると `429`(`{"error":"rate-limited"}`)を返す。人数や利用状況に応じて
`wrangler.toml` の `simple.limit` / `simple.period`(10または60秒のみ)を調整する。
