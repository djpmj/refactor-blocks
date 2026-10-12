# critique-contract-fix: AI講評が必ず失敗する不具合を直し、送る形と受ける形をテストで固定する

## 背景・目的

「AIの講評をもらう」を押すと、どのステージでも次のメッセージが出て、講評がもらえない。

> AI講評を取得できませんでした。しばらくしてからもう一度お試しください

ブラウザのコンソールには、講評サーバー(Cloudflare Workers)からの `400` の応答が出ている。

原因は、送る形と受ける形の食い違いである。

- 講評サーバー(`workers/critique/src/index.ts` の `isFileSummary`)は、ファイルの要約に `path`(ファイル名)が文字列で入っていることを必須にしている
- ゲーム側は、ファイル名を隠す変更(#53「Hide file names from gameplay」)で、`buildCritiqueRequest`(`src/domain/critique/critiqueRequest.ts`)の `CritiqueFileSummary` から `path` を外した

それ以来、すべてのリクエストが `invalid-request`(400)で弾かれている。
ゲーム本体と講評サーバーは別のパッケージで、送る形と受ける形を突き合わせるテストが無かったため、気づけなかった。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `workers/critique/src/validate.ts` | (講評サーバー) | `isCritiqueRequestBody` と、その下の `isFileSummary` などの検証を `index.ts` から移す。Workers の型や SDK に依存しない純粋な関数だけにする |
| 変更 | `workers/critique/src/index.ts` | (講評サーバー) | `validate.ts` の検証を使う。`isFileSummary` は `path` を必須にしない |
| 新規 | `src/infrastructure/critique/critiqueContract.test.ts` | infrastructure | ゲームが送る形(`buildCritiqueRequest` の結果)が、講評サーバーの検証(`workers/critique/src/validate.ts`)を通ることを確かめる |
| 変更 | `src/presentation/critique/CritiquePanel.tsx`(または講評の呼び出し) | presentation | 400 のときは「しばらくしてから」ではなく、送る形が合わない不具合であることが分かるメッセージにする |
| 変更 | `workers/critique/README.md` | — | 検証を変えたらデプロイし直すこと、契約のテストがあることを書く |

`domain` は変更しない(送る形 `CritiqueRequest` は今のまま。ファイル名を送らない方針を守る)。

## データ・型の変更

```ts
// workers/critique/src/validate.ts
/** 信頼境界: ブラウザから届いたJSONが講評に使える形か確認する。 */
export function isCritiqueRequestBody(value: unknown): value is CritiqueRequestBody;
```

- `isFileSummary` の条件から `typeof value.path === 'string'` を外す(`lines`・`deductionPoints`・`classes` は今のまま必須)
- `CritiqueRequestBody` の型からも `path` を外す。プロンプト(`buildPrompt`)は `files` を JSON のまま渡しているので、変更は要らない
- 文字数の上限(`MAX_BODY_LENGTH`)・レート制限・CORS は今のまま

## 見た目・動きの仕様

- 講評サーバーをデプロイし直したあと、「AIの講評をもらう」で講評が出る
- 講評サーバーが 400 を返したときのメッセージを、`AI講評のリクエストの形が合いませんでした(不具合です)。ゲームを最新にして、もう一度お試しください` にする。
  429(レート制限)・502(講評の生成に失敗)・通信の失敗のときは、今のメッセージのまま

## TDD対象の純粋関数

### 契約のテスト(`src/infrastructure/critique/critiqueContract.test.ts`)

- 全ステージの初期コード(`stage.codebase`)について、`buildCritiqueRequest(stage.codebase, stage, scoreCodebase(stage.codebase, stage))` を `JSON.parse(JSON.stringify(...))` したものが、`isCritiqueRequestBody` で `true` になる
- 同じく全ステージの解答例のコード(`sampleAnswerCodebase(stage)`)でも `true` になる
- `JSON.stringify` した長さが、講評サーバーの `MAX_BODY_LENGTH` 以下になる(上限を `validate.ts` から export して使う)
- 壊れた入力(`goal` が無い・`files` が配列でない・クラスに `methods` が無い)は `false` になる

このテストは、今の `isFileSummary`(`path` 必須)のままだと失敗することを、先に確かめてから検証を直す。

## 受け入れ基準

1. 契約のテストが、全ステージの初期コードと解答例のコードで通る(今の検証のままだと失敗する)
2. `workers/critique` の型チェック(`npm run typecheck`)が通る
3. 講評サーバーをデプロイし直したあと、ローカルの開発サーバーで「AIの講評をもらう」を押すと講評が出る(デプロイは人が `workers/critique` で `npm run deploy` を実行する。実装者はデプロイしない)
4. 400 が返ったときに、不具合であることが分かるメッセージが出る
5. `npm run check` が通る

## スコープ外

- 講評サーバーのデプロイの自動化(CI からのデプロイ)
- 講評に使うモデル・プロンプトの見直し
- ファイル名を講評に送ること(ファイル名を隠す方針のまま)
- 講評サーバーの認証・レート制限の変更
