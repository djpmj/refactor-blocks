# masterへの直接pushの安全策

仕様書(`docs/specs/<slug>.md`)やコマンド定義(`.claude/commands/`)など、featureブランチと無関係な
ファイルは `master` へ直接コミット・pushする運用になっている(`/spec-to-issue` の仕様書コミットなど)。
このとき、作業ディレクトリがたまたま別のIssue用featureブランチをチェックアウトしていると、
`git pull --rebase origin master && git push origin HEAD:master` のような操作が、**そのfeature
ブランチに乗っている未レビューのコミットをまとめて `master` へ混入させる**事故につながる
(2026-10-03に実際発生: レビュー前のPRのコミットがこの経路で直接 `master` に入り、GitHubがそのPRを
自動マージ済み・関連Issueを自動クローズ済み扱いにした)。

`master` へ `git push origin HEAD:master` する前に、必ず次を確認する。

1. `git branch --show-current` で今いるブランチを確認する。`master` 以外のブランチに乗ったまま
   `git pull --rebase origin master` を実行しない(そのブランチ固有の未レビューコミットが
   `master` の最新と合流し、次の `push origin HEAD:master` で一緒に送られてしまう)。
2. pushする前に `git log --oneline origin/master..HEAD` で、送ろうとしている差分が
   「意図したファイルのコミットだけ」であることを1件ずつ確認する。featureブランチ固有のコミットが
   混ざっていたら、そのブランチでのpushを中止し、`master` を別途チェックアウト
   (別のworktreeや、一度 `master` ブランチへ切り替えてから)してそちらでコミット・pushし直す。
3. 複数のfeatureブランチ・worktreeを同時に扱っているときほど起きやすい事故なので、
   「いまどのブランチにいるか」を都度 `git branch --show-current` で確認する習慣を優先する。

