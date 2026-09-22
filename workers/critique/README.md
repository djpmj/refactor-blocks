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
