# 機能案のブレスト置き場

`.github/workflows/feature-ideas.yml` が毎日実行され、`refactor-blocks` に足しうる機能案を
10個考えて `docs/feature-ideas/YYYY-MM-DD.md` に出力する。

## 位置づけ

ここはあくまで**ブレストの置き場**であり、`docs/specs/README.md` の開発ハーネス
(仕様設計→実装→評価)とは別物。ここに出た案を実際に進めたい場合は、人が選んで
`docs/specs/<slug>.md` を書くか `docs/auto-dev/TASKS.md` に転記する(自動では転記しない)。

## ファイル形式

1日1ファイル、`YYYY-MM-DD.md`。各ファイルには機能案を10個、以下の形式で列挙する。

```
## 1. 案のタイトル

- 概要: 1〜2行
- 対象プレイヤーへの効果: どんな学び・気づきにつながるか
```

## 運用

- 定期実行は `.github/workflows/feature-ideas.yml` の `schedule`(現在コメントアウト)。
  `CLAUDE_CODE_OAUTH_TOKEN` をリポジトリのSecretsに登録してから有効化する(`auto-dev.yml` と同じ運用)。
  それまでは `workflow_dispatch` による手動実行のみ。
- 出力はコード変更を伴わないため、ワークフローがそのまま `master` に直接pushする。
