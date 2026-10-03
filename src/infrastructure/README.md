# infrastructure

永続化・外部連携層。`application`層が定義するインターフェースの実装を置く。

- 例: ステージ定義(JSON)の読み込み、プレイ結果のlocalStorage保存、AI講評APIのクライアント
- ファイルI/O・ネットワークI/Oを含むため、ユニットテスト対象外にしてよい(ただしステージJSONの検証ロジックなど純粋な部分はテストを書く)

## ステージ(`stages/`)

- 難易度ごとに `tutorialStages.ts` / `beginnerStages.ts` / `intermediateStages.ts` に定義し、`stageCatalog.ts` が難易度順に並べて公開する
- ステージを足したら `stageCatalog.test.ts` の `solutions` に100点にできる手順を書く。狙いを飛ばして満点になる手順があれば `shortcuts` に足して塞ぐ

## AI講評(`critique/`)

- `critiqueClient.ts` が `application/CritiqueUseCases.ts` の `RequestCritique` を実装する。呼び出し先は
  Cloudflare Workersのプロキシ(`workers/critique/`。リポジトリ直下、アプリ本体とは別デプロイ)で、
  `ANTHROPIC_API_KEY` はそちらのシークレットに置く。ブラウザ(このクライアント)は鍵を一切持たない
- 呼び出し先のURLは環境変数 `VITE_CRITIQUE_ENDPOINT` で指定する(未設定ならエラーになる)。
  デプロイ手順は `workers/critique/README.md` を参照
