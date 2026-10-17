# critique-contract-version: AI講評のサーバーとゲームの版の食い違いを見分けて伝える

## 背景・目的

2026-10-17 に中級2で「AIの講評をもらう」を押すと、
`AI講評のリクエストの形が合いませんでした(不具合です)。ゲームを最新にして、もう一度お試しください` と出て講評が取れなかった。
通信を見ると、本番の Worker(`https://refactor-blocks-critique.djpmj.workers.dev`)が `400 {"error":"invalid-request"}` を返していた。

同じ日にリクエストの形を直す変更(`critique-contract-fix`、#208)が master に入ったが、Worker は手動デプロイ(`workers/critique` で `npm run deploy`)なので、
**本番の Worker が古いまま**になっていると考えられる。このとき、

- 画面は「ゲームを最新にして」と言うが、ゲームはすでに最新で、プレイヤーにできることは無い
- 開発側も、「クライアントの不具合」なのか「Worker が古い」のかを画面から見分けられない

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/critique/critiqueContract.ts`(または既存の契約の型の置き場所) | domain | 契約の版 `CRITIQUE_CONTRACT_VERSION`(数値)を1か所で定義する |
| 変更 | `src/infrastructure/critique/critiqueClient.ts` | infrastructure | リクエストのヘッダー `X-Critique-Contract` に版を付ける。409 を版の食い違いとして扱う |
| 変更 | `src/application/CritiqueUseCases.ts` | application | エラーに `'version-mismatch'` を足し、文言を分ける |
| 変更 | `src/application/CritiqueUseCases.test.ts` | application | 上のテスト |
| 変更 | `workers/critique/src/index.ts` | (worker) | ヘッダーの版が自分の版と違えば `409 {"error":"version-mismatch","expected":<版>}` を返す(本文の検証より先) |
| 変更 | `workers/critique/src/validate.ts` または新規の版の定義 | (worker) | 版の定数。クライアントと同じ値を、契約のテスト(`critiqueContract.test.ts`)で突き合わせる |
| 変更 | `src/infrastructure/critique/critiqueContract.test.ts` | infrastructure | クライアントと Worker の版が同じことを確かめる |
| 変更 | `workers/critique/README.md` | docs | 契約を変えたら版を上げ、Worker をデプロイしてからクライアントを出す、という手順を書く |

## データ・型の変更

- `CritiqueError` に `'version-mismatch'` を足す
- 版は整数。今の契約を `1` とする。リクエスト・レスポンスの形を変えるたびに1上げる
- ヘッダーが無いリクエスト(古いクライアント)は、Worker は今どおり本文を検証する(古いクライアントを締め出さない)

## 文言

- `version-mismatch`: `AI講評のサーバーが、このゲームの版にまだ対応していません。サーバーの更新をお待ちください(ゲーム側の操作は不要です)`
- `invalid-request`: 今の文から「ゲームを最新にして、」を消し、`AI講評のリクエストの形が合いませんでした(不具合です)。時間をおいてもう一度お試しください` にする
- `request-failed`: 今のまま

## TDD対象の純粋関数

### `describeCritiqueError`(`application/CritiqueUseCases.ts`)

- `'version-mismatch'` → 上の文
- `'invalid-request'` → 新しい文(「ゲームを最新に」を含まない)

### 講評のユースケース

- `requestCritique` が版の食い違いのエラーを投げる → `err('version-mismatch')`
- 400 → 今どおり `err('invalid-request')`

### 契約のテスト

- クライアントの `CRITIQUE_CONTRACT_VERSION` と Worker の版が同じ値

## 受け入れ基準

1. Worker の版をわざと違う値にした状態(テスト用のモック)で講評を頼むと、`AI講評のサーバーが、このゲームの版にまだ対応していません…` が出る
2. 400 のときの文に「ゲームを最新にして」が含まれない
3. `workers/critique/README.md` にデプロイの順番(Worker → クライアント)と版の上げ方が書かれている
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- Worker の自動デプロイ(Cloudflare の認証情報が要るため、運用側で決める)
- 講評の内容・モデルの変更

## 運用メモ(この仕様とは別に、今すぐ必要な作業)

本番の Worker が #208 より前の版のままなら、`workers/critique` で `npm run deploy` すると今の 400 は直る見込み。
