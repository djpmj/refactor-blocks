# PRレビューログ

`.github/workflows/review-pr.yml` が定期実行でPRをレビュー・マージした際の記録。
ヘッドレス実行でユーザーのリアルタイム承認を得られないため、マージ前に何を確認したかを
ここに記録し、事後に追跡できるようにする。

## 書式

### 自動マージした場合

```
## YYYY-MM-DD HH:MM UTC PR #<番号> <タイトル>

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(必要に応じてE2Eも)
- マージ: squash & delete-branch
```

### `.github/workflows/` 配下を含み自動マージを見送った場合

`claude_code_oauth_token` が使うGitHub Appには GitHub の `workflows` 権限が無く、
`.github/workflows/` 配下を変更するPRのマージはGraphQL API側で必ず拒否される
(`refusing to allow a GitHub App to create or update workflow ... without 'workflows' permission`)。
このケースは承認コメントのみ投稿し、`gh pr merge` は実行しない(失敗するのを承知で試行しない)。

```
## YYYY-MM-DD HH:MM UTC PR #<番号> <タイトル>

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅
- マージ: 見送り(.github/workflows/配下を含むためGitHub Appの権限で自動マージ不可。人が手動でマージする)
```

- 新しい記録は「## ログ一覧」見出し直後(一覧の先頭)に追記する
- 記録が30件を超えたら、古いものから削除して直近30件までに収める
  (削除した内容はgit履歴 `git log -p docs/review-pr/LOG.md` から参照できる)
- blockerがあってマージしなかったPRはここに書かない(PR側のレビューコメントで追える)

## ログ一覧

## 2026-10-10 06:30 UTC PR #122 feat: highlight hint targets on canvas

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1566件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は163件成功と報告)。stepTargetsのdomain実装とテスト、focusRuleとの相互排他、対象消失時の解除を差分で確認
- マージ: squash & delete-branch

## 2026-10-10 05:58 UTC PR #121 feat: clarify action affordances

- 判定: 合格(blocker無し。suggestion: button--primaryの!importantは詳細度で解決したい)
- 確認した内容: npm test ✅ 1561件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は161件成功と報告)、E2E specは静的に確認
- マージ: squash & delete-branch

## 2026-10-10 05:31 UTC PR #120 feat: restructure stage problem sidebar

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1561件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は159件成功と報告)
- マージ: squash & delete-branch

## 2026-10-10 05:10 UTC PR #119 feat: implement inline middle man refactoring

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1550件)。E2Eはこの環境で実行許可が得られず未実行、PR本文の報告(inline/削除E2E 4/4、全体154/155でfield keyboard moveはmasterでも再現)を参照
- マージ: squash & delete-branch

## 2026-10-10 03:15 UTC PR #118 Remove redundant stage select

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1508件)。E2Eはブラウザ未導入のためローカル実行できず、差分を静的に確認(getByLabel('ステージ')の残りなし、selectStageヘルパーで集約)
- マージ: squash & delete-branch

## 2026-10-10 02:40 UTC PR #117 Verify sidebar toggle avoids scrollbar overlap

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1508件 / npm run lint ✅ / npm run typecheck ✅。E2Eはブラウザ未導入のためローカル実行できず、CIのe2eジョブ成功を参照
- マージ: squash & delete-branch

## 2026-10-10 02:20 UTC PR #116 Add resizable left sidebar

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1508件)。E2Eはブラウザ未導入のため再実行できず、PR本文の報告(151件pass)を参照
- マージ: squash & delete-branch

## 2026-10-10 02:00 UTC PR #115 Implement issue 95 code fragments

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1501件) / npm run lint ✅ / npm run typecheck ✅ / stage-report再生成で差分なし ✅。E2Eはブラウザ未導入のため再実行できず、PR本文の報告(148件pass)を参照
- マージ: squash & delete-branch

## 2026-10-05 14:15 UTC PR #105 Add replay maximize and read-only method panel

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1392件)。E2Eはブラウザ未導入のため再実行できず、PR本文の報告(148件pass)を参照
- マージ: squash & delete-branch

## 2026-10-05 13:57 UTC PR #104 Align displayed line counts with C# source

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅ / E2E: レビュー環境で実行不可(chromium未導入。PR本文では147件通過、e2e差分は読解で確認)
- マージ: squash & delete-branch

## 2026-10-04 15:52 UTC PR #101 変更の痛みカードの長い名前を折り返す

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅ / E2E: レビュー環境で実行不可(PR本文では147件通過)
- マージ: squash & delete-branch

## 2026-10-04 15:45 UTC PR #96 コードプレビューを幅に合わせて折り返す

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1385件) / npm run lint ✅ / npm run typecheck ✅ / E2E: レビュー環境にChromiumが無く実行不可(PR本文では147件通過)
- マージ: squash & delete-branch

## 2026-10-04 13:20 UTC PR #78 実装: why-split-change-pain

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1059件) / npm run lint ✅ / npm run typecheck ✅ / E2E: レビュー環境にChromiumが無く実行不可(PR本文では116件通過)
- マージ: squash & delete-branch

## 2026-10-04 12:30 UTC PR #77 操作ガイドを追加

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test 1032件 ✅)。E2Eは環境で実行できず未検証(PR記載では114件成功)。差分は仕様どおりでDDD層境界にも問題なし
- マージ: squash & delete-branch

## 2026-10-04 12:25 UTC PR #76 減点対象へのジャンプと強調を追加

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test 1032件 ✅)。E2Eは環境にChromiumが無く実行できず未検証(PR記載では109件成功)。差分は仕様どおりでDDD層境界にも問題なし
- マージ: squash & delete-branch

## 2026-10-04 11:58 UTC PR #75 操作エラーをキャンバスに表示 (#57)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1028件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では107件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 11:30 UTC PR #70 フィールドの説明と型を表示 (#56)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1028件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では106件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 11:00 UTC PR #65 新規ファイルをドロップ位置に配置 (#44)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1024件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では104件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 04:00 UTC PR #46 メソッドエディタのタブをタブバーにする (#34)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(995件) / npm run lint ✅ / npm run typecheck ✅(前回指摘のコンフリクト解消を確認。CSSと aria-hidden アイコンのみの変更でE2Eは未実行、PR本文では94件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 03:50 UTC PR #55 継承と実装の矢印を色と線種で分ける (#43)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1021件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では102件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 03:40 UTC PR #54 継承の矢じりと着地点を見やすくする (#42)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1020件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では102件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 03:10 UTC PR #53 ファイル名を画面に出さず自動追加する (#40)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1018件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では101件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 02:40 UTC PR #52 可視性が関係するステージだけ選択欄を出す (#39)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。差分を読んで確認)
- マージ: squash & delete-branch

## 2026-10-04 02:30 UTC PR #51 元のメソッド可視性へ戻せるようにする (#37)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。差分を読んで確認)
- マージ: squash & delete-branch

## 2026-10-04 02:15 UTC PR #50 ファイル位置に合わせて矢印の接続点を切り替える (#36)

- 判定: 合格(blocker無し。suggestion: 古いdocコメントの残り・論理位置/矩形の二重ルートの一本化)
- 確認した内容: npm test 1005件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 19:30 UTC PR #47 左サイドバー開閉ボタンを境界へ移す (#35)

- 判定: 合格(blocker無し)
- 確認した内容: master取り込み後 npm test 995件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 19:20 UTC PR #41 右サイドバーの幅を変更できるようにする (#32)

- 判定: 合格(blocker無し。suggestion: pointercancel時のドラッグ状態クリア)
- 確認した内容: master取り込み後 npm test 995件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 19:10 UTC PR #38 call Fragment を呼び出し文で表示する (#31)

- 判定: 合格(blocker無し)
- 確認した内容: npm test 992件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 11:01 UTC PR #8 chore(deps): Bump actions/checkout from 4 to 7

- 判定: 合格(blocker無し。review-pr.ymlがCIでレビュー・承認済み)
- 確認した内容: workflow内のバージョン番号のみの変更でsrc/変更なし。PRのCI(check/e2e/knip/jscpd)全てpass
- マージ: review-pr.ymlの自動マージがGitHubの権限制限(GitHub Appはreview-pr.yml自身を書き換えるマージ不可)で
  失敗したため、人が手動でsquash & delete-branch

## 2026-10-03 11:01 UTC PR #9 chore(deps): Bump actions/setup-node from 4 to 7

- 判定: 合格(blocker無し。review-pr.ymlがCIでレビュー・承認済み)
- 確認した内容: workflow内のバージョン番号のみの変更でsrc/変更なし。PRのCI(check/e2e/knip/jscpd)全てpass
- マージ: review-pr.ymlの自動マージがGitHubの権限制限(GitHub Appはreview-pr.yml自身を書き換えるマージ不可)で
  失敗したため、人が手動でsquash & delete-branch
