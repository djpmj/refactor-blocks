# infrastructure

永続化・外部連携層。`application`層が定義するインターフェースの実装を置く。

- 例: ステージ定義(JSON)の読み込み、プレイ結果のlocalStorage保存、AI講評APIのクライアント
- ファイルI/O・ネットワークI/Oを含むため、ユニットテスト対象外にしてよい(ただしステージJSONの検証ロジックなど純粋な部分はテストを書く)

## ステージ(`stages/`)

- 難易度ごとに `tutorialStages.ts` / `beginnerStages.ts` / `intermediateStages.ts` に定義し、`stageCatalog.ts` が難易度順に並べて公開する
- ステージを足したら `stageCatalog.test.ts` の `solutions` に100点にできる手順を書く。狙いを飛ばして満点になる手順があれば `shortcuts` に足して塞ぐ
