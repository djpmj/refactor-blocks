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

## 2026-10-24 15:05 UTC PR #297 100点のあとに、外から使われていない公開メンバーを知らせる (#243)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1963件) / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境で実行できず未実行(PR本文では全306件成功)。Issue #243・docs/specs/unused-public-member-notes.mdの、100点時のみ表示・入口/インターフェース役/部品置き場の除外・visibilityEnforced時の案内を差分で確認。点数は変えない
- マージ: squash & delete-branch

## 2026-10-24 14:30 UTC PR #296 初回ツアーが正しい抽出に導き、手直しの直し忘れを防ぐ (#216)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1955件) / npm run lint ✅ / npm run typecheck ✅(E2Eはレビュー環境で実行できず未実行。PR本文では全305件成功)。Issue #216の手順・文言修正(manual-fix-started追加、click-inside削除、extract-area、スクロール)を差分で確認
- マージ: squash & delete-branch

## 2026-10-24 14:30 UTC PR #295 白紙設計の部品置き場を採点対象のクラスのように見せない (#222)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 1955件)✅。E2Eはレビュー環境で実行できず未実行(PR本文では全308件成功)。Issue #222・docs/specs/blank-design-tray-display.mdの、部品置き場のバッジ/行数/警告の除去・見出し・矢印の除外(ユニットテスト付き)・問題文の文字サイズ・見えているキャンバスを測る自動フィット修正を差分で確認。domain変更はTRAY_CLASS_IDのexportのみ
- マージ: squash & delete-branch

## 2026-10-24 14:00 UTC PR #293 ブラウザのタブ名を今のモードとステージに合わせる (#291)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1958件) / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境で実行できず未実行(PR本文では全件成功)。Issue #291・docs/specs/page-title-by-view.mdの受け入れ基準1〜3を差分とE2E spec で確認。domain/application変更なし
- マージ: squash & delete-branch

## 2026-10-24 UTC PR #264 インターフェースと抽象クラスの役割を表示する (#228)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1954件) / npm run lint ✅ / npm run typecheck ✅(E2Eはこの環境では未実行、PR本文の結果に依拠)
- マージ: squash & delete-branch

## 2026-10-24 13:10 UTC PR #292 実機プレイから仕様化・実装までの作業を効率化する道具を追加

- 判定: 合格(blocker無し。前回指摘したvite.configのexplore/**除外が68c3d43で解消)
- 確認した内容: npm test(1951件)✅ / npm run lint ✅ / npm run typecheck ✅。.github/workflows配下の変更なし。spec-publish.shはPR本文どおり未実行。E2Eはこの環境で未実行(PR記載の301件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 07:55 UTC PR #280 解答例の図を、自分の設計と並べて違いが分かるように見せる (#246)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1926件)✅ / npm run lint ✅ / npm run typecheck ✅。designDiff・describeDesignDiff・ComparisonPanesを仕様(2列表示・責務ごとの違い一覧・同じ置き方の文言・減点は事実のみ)と照合。E2EはChromiumを入れられず未実行(PR記載の298件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 07:50 UTC PR #279 ヒント「次の一手」を方針のまとまりごとに見せる (#248)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1924件)✅ / npm run lint ✅ / npm run typecheck ✅。方針の表・見出しは方針の最初の手順でのみ表示・8手未満は出さない点を仕様と照合。E2Eはこの環境で実行の承認が得られず未実行(PR記載の297件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 07:40 UTC PR #278 親のメソッドを上書きして公開範囲を狭めたら約束違反に数える (#249)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1929件)✅ / npm run lint ✅ / npm run typecheck ✅。findNarrowedOverrides・可視性欄のあるステージのみ採点・violationTargets・ruleWhy文言をIssue #249と照合。E2Eはこの環境で実行の承認が得られず未実行(PR記載の296件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 07:15 UTC PR #277 実装するインターフェースの候補をインターフェース役のクラスに絞る (#244)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1899件)✅ / npm run lint ✅ / npm run typecheck ✅。候補の絞り込み・実装済みの相手を残す・説明項目を仕様と照合。E2Eはこの環境にChromiumが無く未実行(PR記載の293件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 07:10 UTC PR #276 減点の内訳に原因のクラス・メソッド・依存を名前で出す (#242)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1902件)✅ / npm run lint ✅ / npm run typecheck ✅。対象の名前表示・依存の矢印・5件超の「ほか N 件」・押して選択を仕様と照合。E2Eは実行の承認が得られず未実行(PR記載の291件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 07:00 UTC PR #275 変更依頼を1件ごとに答え合わせし、その場で置き直せるようにする (#241)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1895件)✅ / npm run lint ✅ / npm run typecheck ✅。reviewing段階・置き直す・次の依頼へを仕様と照合。E2Eはこの環境にChromiumが無く未実行(PR記載の291件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 02:10 UTC PR #274 ヘッダーの点数説明を短くして内訳の重複をなくす (#238)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1891件)✅ / npm run lint ✅ / npm run typecheck ✅。describeScoreShortと表示・nowrapを仕様と照合、E2E移行を差分で確認。E2Eはこの環境にChromiumが無く未実行(PR記載の290件成功を参照)
- マージ: squash & delete-branch

## 2026-10-24 01:40 UTC PR #273 変更依頼の解答例を理想の土台から生成する (#240)

- 判定: 合格(blocker無し。suggestion: placedLikeSampleの既存クラス名一致は同名の別クラスを同一視する余地あり)
- 確認した内容: npm test(1870件)✅ / npm run lint ✅ / npm run typecheck ✅。sampleCarried・解答例を理想の土台で求める変更・採点はcarriedのまま・注記を差分で確認。E2Eはこの環境にChromiumが無く未実行
- マージ: squash & delete-branch

## 2026-10-24 01:35 UTC PR #272 設計くらべのプレビューを共通の縮尺にそろえる (#236)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1878件)✅ / npm run lint ✅ / npm run typecheck ✅。sharedZoom(小さい方・下限0.6)・onFitZoom/maxZoom・resize追従・他プレビューはfitView維持を差分で確認。E2E(quiz.spec.ts)はこの環境で実行できず未実行
- マージ: squash & delete-branch

## 2026-10-24 UTC PR #271 設計くらべの結果まとめと回答保持を追加する (#235)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1863件)✅ / npm run lint ✅ / npm run typecheck ✅。回答の親保持・結果まとめ・未回答案内・✓/✗印・もう一度解く/モード遷移を差分で確認。E2E(quiz.spec.ts)はこの環境にChromiumが無く未実行
- マージ: squash & delete-branch

## 2026-10-24 UTC PR #270 設計くらべの答えが事前に分からない表示にする (#237)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1872件)✅ / npm run lint ✅ / npm run typecheck ✅。設計名の中立化・空クラス/空ファイル除去・回答前の警告色非表示を差分で確認。E2E(quiz.spec.ts)はこの環境にChromiumが無く未実行
- マージ: squash & delete-branch

## 2026-10-24 UTC PR #269 操作ガイドにキーボード操作を追加する (#230)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1832件)✅ / npm run lint ✅ / npm run typecheck ✅。キーボード節・Shift+F10追記・Esc再表示競合修正(onCancel)を差分で確認。Enterでエディタが開かない行はIssueの例外条項どおり除外されE2Eで現挙動を記録。E2Eはこの環境にブラウザが無く未実行(同一コミットのCI push側E2Eは成功)
- マージ: squash & delete-branch

## 2026-10-24 00:45 UTC PR #268 狭い画面のパネルをドロワー表示にする (#232)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1832件)✅ / npm run lint ✅ / npm run typecheck ✅。Issue #232 の受け入れ基準(375pxでキャンバス340px以上、左右ドロワーの開閉・フォーカス復帰・inert、未選択レール非表示)を差分とE2Eコードで確認。E2Eはこの環境にブラウザが無く未実行(PR本文では271件成功)
- マージ: squash & delete-branch

## 2026-10-23 15:00 UTC PR #267 理解度チェックの正誤と解説を区別して表示する (#234)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1857件)✅ / npm run lint ✅ / npm run typecheck ✅。ConceptCheckPanelの見出し、ステージ解説から「正解です」除去、全ステージ検査テストを差分で確認。E2Eはこの環境にブラウザが無く未実行(PR本文では268件成功)
- マージ: squash & delete-branch

## 2026-10-23 14:50 UTC PR #266 AI講評の契約版の不一致を見分けて伝える (#231)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1835件)✅ / npm run lint ✅ / npm run typecheck ✅。X-Critique-Contractヘッダー、Workerの409(本文検証より先・ヘッダーなしは従来どおり)、400/409の文言分離、README手順をIssue #231の受け入れ基準と照合。E2Eはこの環境で実行できず未実行(PR本文では269件成功)
- マージ: squash & delete-branch

## 2026-10-23 14:40 UTC PR #265 ダークモードのキャンバス操作ボタンを見やすくする (#233)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1832件)✅ / npm run lint ✅ / npm run typecheck ✅。colorMode="system" と .react-flow.dark の変数上書き(参照するCSS変数は全て定義済み)をIssue #233の受け入れ基準と照合。E2Eはこの環境にブラウザが無く未実行(PR本文では271件成功)
- マージ: squash & delete-branch

## 2026-10-23 09:25 UTC PR #254 冒頭の手直しの答え表示と結果説明を改善する (#215)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1832件)✅ / npm run lint ✅ / npm run typecheck ✅。答え非表示、describeManualFixのクラス単位文言、OpeningFixBanner、siteClassIdsを差分で確認。E2Eはこの環境にブラウザが無く未実行(PR本文では268件成功)
- マージ: squash & delete-branch

## 2026-10-23 08:50 UTC PR #259 白紙設計のクラスを責務に応じて命名する (#220)

- 判定: 合格(blocker無し。suggestion: useGameStore.ts 先頭にBOMが混入)
- 確認した内容: npm test(1826件)✅ / npm run lint ✅ / npm run typecheck ✅。白紙設計のclassNames設定、moveActionsでのautoNameClasses適用、回帰テストを差分で確認。E2Eはこの環境にブラウザが無く未実行(PR本文では263件成功)
- マージ: squash & delete-branch

## 2026-10-23 08:40 UTC PR #263 クラスを新しいファイルへ移すメニューを追加する (#225)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1825件)✅ / npm run lint ✅ / npm run typecheck ✅。メニュー項目(唯一のクラスでは非表示)、Tab/矢印のフォーカス移動、操作ガイド更新を差分で確認。E2Eはこの環境にブラウザが無く未実行(PR本文では264件成功)
- マージ: squash & delete-branch

## 2026-10-20 10:40 UTC PR #262 基底へ移したメソッドをprotectedにし統合候補を保つ (#229)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1816件)✅ / npm run lint ✅ / npm run typecheck ✅。子孫からだけ呼ばれるメソッドはprotected・それ以外はpublic、private/protected間の統合(結果は広い可視性)、changed型と呼び出し元・通知文の更新を差分で確認。E2Eはこの環境で実行許可が無く未実行(PR本文では256/257件成功、残り1件は単独再実行で成功)
- マージ: squash & delete-branch

## 2026-10-20 10:30 UTC PR #261 メソッドの読み上げ名と選択状態を明確にする (#227)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1813件)✅ / npm run lint ✅ / npm run typecheck ✅。読み上げ名の規則・aria-pressed・記号のaria-hiddenが仕様どおりであることを差分で確認。E2Eはこの環境にブラウザが無く未実行(PR本文では全257件成功)
- マージ: squash & delete-branch

## 2026-10-20 03:50 UTC PR #260 新しく作ったクラスを表示領域へ収める (#223)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 1809件)✅。panToRevealが仕様(収まっていれば0・余白24px・大きい箱は左上優先)どおり、既存クラスへのドロップでは動かさないことを差分で確認。E2Eはこの環境で実行許可が無く未実行(PR本文では全260件成功)
- マージ: squash & delete-branch

## 2026-10-19 21:10 UTC PR #258 chore(deps): bump the development-dependencies group with 6 updates

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1811件)✅ / npm run lint ✅ / npm run typecheck ✅。package.json/lockのみの開発依存更新。E2Eはレビュー環境でmasterも全件失敗するため判断対象外
- マージ: squash & delete-branch

## 2026-10-19 21:10 UTC PR #257 chore(deps): bump the production-dependencies group with 3 updates

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1811件)✅ / npm run lint ✅ / npm run typecheck ✅。package.json/lockのみ(react 19.3.1等)。E2Eはレビュー環境でmasterも全件失敗するため判断対象外
- マージ: squash & delete-branch


