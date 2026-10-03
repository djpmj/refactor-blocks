# 機能案のブレスト置き場

`.github/workflows/feature-ideas.yml` が毎日実行され、`refactor-blocks` に足しうる機能案を
10個考えて `docs/feature-ideas/IDEAS.md` に追記する。

## 位置づけ

ここはあくまで**ブレストの置き場**であり、`docs/specs/README.md` の開発ハーネス
(仕様設計→実装→評価)とは別物。ここに出た案を実際に進めたい場合は、人が選んで
`docs/specs/<slug>.md` を書くか `docs/auto-dev/TASKS.md` に転記する(自動では転記しない)。

## ファイル形式

`docs/feature-ideas/IDEAS.md` の1ファイルに集約する(日付ごとのファイルは作らない)。
実行ごとに、その日の見出しを一覧の先頭に追記し、配下に機能案を10個、以下の形式で列挙する。

```
## 2026-10-04

### 1. 案のタイトル

- 概要: 1〜2行
- 対象プレイヤーへの効果: どんな学び・気づきにつながるか

### 2. ...
```

同じ日に複数回実行された場合は、その日の見出しを追記せず置き換える。

## 運用

- 定期実行は `.github/workflows/feature-ideas.yml` の `schedule`(毎日06:00 JST)で有効化済み。
  `workflow_dispatch` による手動実行も可能。
- 出力はコード変更を伴わないため、ワークフローがそのまま `master` に直接pushする。
- ファイルが肥大化しないよう、日付見出しは直近30件までとし、31件目以降(古いもの)は削除する
  (削除した内容はgit履歴 `git log -p docs/feature-ideas/IDEAS.md` から参照できる)。
