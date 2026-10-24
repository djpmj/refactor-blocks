# page-title-by-view: ブラウザのタブ名を、今のモードとステージに合わせる

## 背景・目的

ブラウザのタブ名(`document.title`)は、`index.html` の `Refactor Blocks` のまま、どのモード・どのステージでも変わらない。
`document.title` を書き換えるコードは `src/` に無い。複数のタブで違うステージを開いたり、履歴やタブ一覧から戻ったりするとき、
どのタブがどのステージか分からない。画面を読み上げる環境でも、ページが切り替わったことが伝わりにくい。

モード(リファクタリング・設計くらべ・白紙設計)と、リファクタリングでは今のステージ名をタイトルに入れる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/pageTitle.ts` | presentation | タブ名を組み立てる純粋関数 |
| 新規 | `src/presentation/pageTitle.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/App.tsx` | presentation | `mode` とステージ名が変わるたびに `document.title` を更新する(`useEffect`) |
| 新規 | `e2e/page-title-by-view.spec.ts` | E2E | 受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。`index.html` の `<title>` は、読み込み中の表示として今のまま残す。

## データ・型の変更

```ts
// src/presentation/pageTitle.ts
export const APP_TITLE = 'Refactor Blocks';

/**
 * タブ名。リファクタリングは「<ステージ名> - Refactor Blocks」、他のモードは「<モード名> - Refactor Blocks」。
 */
export function pageTitle(modeLabel: string, stageTitle: string | null): string;
```

- `modeLabel` は `App.tsx` の `MODE_LABEL`(リファクタリング / 設計くらべ / 白紙設計)
- `stageTitle` は、リファクタリングモードのとき `stage.title`、他のモードのとき `null`

## 動きの仕様

- リファクタリングモード: `チュートリアル1: 長いメソッドを分ける - Refactor Blocks`
- 設計くらべ: `設計くらべ - Refactor Blocks`、白紙設計: `白紙設計 - Refactor Blocks`
- モードを切り替えたとき、ステージを切り替えたときに更新する
- 設計くらべ・白紙設計の問題の切り替えでは更新しない(モード単位まで)

## TDD対象

### `pageTitle`

- `('リファクタリング', 'チュートリアル1: 長いメソッドを分ける')` → `チュートリアル1: 長いメソッドを分ける - Refactor Blocks`
- `('設計くらべ', null)` → `設計くらべ - Refactor Blocks`
- `('白紙設計', null)` → `白紙設計 - Refactor Blocks`
- `stageTitle` が空文字のとき → モード名のタイトルにする

## 受け入れ基準

1. 初回表示でタブ名が `チュートリアル1: 長いメソッドを分ける - Refactor Blocks` になる
2. ステージ一覧から別のステージを開くと、タブ名がそのステージ名に変わる
3. 「設計くらべ」「白紙設計」へ切り替えると、タブ名がそのモード名に変わり、「リファクタリング」へ戻すと今のステージ名に戻る
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 設計くらべ・白紙設計の問題ごとのタブ名
- ファビコンの変更
- URL(ルーティング・ハッシュ)でステージを指定すること
