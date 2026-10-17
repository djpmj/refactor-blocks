# detail-zoom-floor: 自動の「全体を表示」で、メソッドが隠れる倍率まで縮めない

## 背景・目的

キャンバスは、ズームの倍率が `DETAIL_ZOOM`(0.6)未満になると、メソッドと行数を隠してファイル名とクラス名だけを表示する(`useShowDetails`)。
一方で、ステージを開いたとき・ファイルが増えたとき・「最初に戻す」「整列」のときは、図全体が収まるように自動で合わせる(`FitViewOnLayoutChange` の `fitView()`)。

この2つが組み合わさって、次のことが起きる(キャンバスの幅 873px で全ステージを測った)。

- 上級6(倍率 0.35)・中級9(倍率 0.53)は、開いた時点でメソッドが隠れ、クラス名しか見えない。クリックして中身を見る対象が無い
- 8ステージ(初級1・中級1・中級10・中級11・上級1・上級2・上級4・上級7)は倍率 0.72 で、しきい値のすぐ上にある。
  組み替えでファイルが増えると自動で合わせ直して 0.6 を下回り、操作の途中でメソッドが急に消える(中級10でランクのクラスを作るときなど)
- ウィンドウが狭いと、どのステージでも起きやすい
- 「拡大すると中身が見える」ことを知らせる表示が無いので、隠れていることにも気づけない

そこで、**自動の合わせでは 0.6 より小さくしない**。収まらない分は、図の左上から見せてスクロールで見てもらう。
プレイヤーが自分で縮めたとき・「全体を表示」ボタンを押したときは、今どおり全体を収める(見渡したいときのため)。
中身が隠れている間は、そのことと戻し方を知らせる。

### 実装の進め方(2026-10-17 追記)

前提の「#180 のマージ後に着手」は、「**#180 canvas-refit-on-resize と同じブランチ・同じPRで、#180 に続けて実装する**」に変える。
#180 だけでは、ノードの計測後の合わせで倍率が 0.6 を下回り(計測で 0.543)、既存の E2E が失敗する。この Issue のズーム下限と合わせて初めて、両方の受け入れ基準を満たせるため。PRは両方の Issue を閉じる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/canvas/autoViewport.ts` | presentation | 自動の合わせの倍率・位置を決める純粋関数 |
| 新規 | `src/presentation/canvas/autoViewport.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 自動の合わせ(`FitViewOnLayoutChange`、#180 の大きさの変化での合わせ直しも)を `autoViewport` で行う。中身が隠れているときの知らせを出す |
| 変更 | `src/index.css` | presentation | 知らせのスタイル |
| 変更 | 自動の合わせの倍率を前提にしている既存の E2E | E2E | 新しい動きに合わせる |
| 新規 | `e2e/detail-zoom-floor.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。新しい依存は足さない(React Flow の `getNodesBounds`・`setViewport` を使う)。

## データ・型の変更

```ts
// src/presentation/canvas/autoViewport.ts
export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type Viewport = { readonly x: number; readonly y: number; readonly zoom: number };

/**
 * 図(bounds)をキャンバス(size)に自動で合わせるときの表示。
 * 全体が収まる倍率が minZoom 以上なら、全体を中央に収める(今の fitView と同じ。上限 maxZoom)。
 * 未満なら倍率を minZoom にして、図の左上が padding の位置に来るようにする。
 */
export function autoViewport(bounds: Rect, size: { readonly width: number; readonly height: number }, options: Readonly<{ minZoom: number; maxZoom: number; padding: number }>): Viewport;
```

- `minZoom` には `DETAIL_ZOOM` を渡す。`maxZoom`・`padding` は今の `fitView` の既定値に合わせる

## 見た目・動きの仕様

### 自動の合わせ

- 次のときは `autoViewport` で表示を決めて `setViewport` する
  - ステージを開いたとき・ファイルが増減したとき・「最初に戻す」・「整列」
  - `canvas-refit-on-resize`(#180)のキャンバスの大きさの変化での合わせ直し
- 全体が収まらないときは、図の左上(最初のファイル)から見える。右や下の残りは、ドラッグやホイールのスクロールで見る
- ヒントや減点の場所を光らせるための合わせ(`FocusOnRule` の `fitView`)は今のまま

### 「全体を表示」ボタン

- React Flow の `Controls` の「全体を表示」は、今どおり全体を収める(0.6 未満になってもよい)

### 中身が隠れているときの知らせ

- 倍率が `DETAIL_ZOOM` 未満で中身を隠している間、キャンバスの左上に小さな知らせを出す(`data-testid="detail-zoom-notice"`、`role="status"`)
  - 文: `縮小中はメソッドを隠しています`
  - ボタン: `中身が見える大きさにする`。押すと、今の表示の中央を保ったまま倍率を `DETAIL_ZOOM` にする
- 変更依頼に挑戦している間は、今どおり常に中身を出すので、知らせも出さない

## TDD対象の純粋関数

### `autoViewport`(`presentation/canvas/autoViewport.ts`)

- 小さな図(全体を収める倍率が 1.2) → 倍率 1.2、図が中央に来る位置
- 大きな図(全体を収める倍率が 0.35)、`minZoom: 0.6` → 倍率 0.6、図の左上が `(padding, padding)` に来る位置
- 全体を収める倍率が `maxZoom` を超える → 倍率は `maxZoom`
- 全体を収める倍率がちょうど `minZoom` → 全体を中央に収める

## 受け入れ基準

1. キャンバスの幅が 900px 前後で上級6を開くと、メソッドと行数が見える倍率(0.6 以上)で、最初のファイルが左上に見えている
2. 中級10でランクのクラスを2つ作ってファイルが増えても、自動の合わせでメソッドが隠れない
3. 「全体を表示」ボタンを押すと全体が収まり、倍率が 0.6 未満なら「縮小中はメソッドを隠しています」の知らせが出る。「中身が見える大きさにする」を押すと、メソッドが見える
4. 全体が 0.6 以上で収まるステージ(チュートリアル1など)は、今と同じく全体が中央に収まる
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ファイルを何段かに折り返して並べること(図の並べ方の変更)
- `DETAIL_ZOOM` の値の変更
- 設計くらべ・白紙設計・プレビューのダイアログのキャンバス
