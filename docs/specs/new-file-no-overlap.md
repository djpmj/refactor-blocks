# new-file-no-overlap: 余白へのドロップで作った新しいファイルが、既存のファイルと重ならない

## 背景・目的

メソッドをキャンバスの余白へドラッグすると、新しいクラスと新しいファイルが作られる。新しいファイルの位置は、ドロップした点を中心にした位置
(`fileTopLeftAtDrop`)で決まり、**既存のファイルの箱との重なりを考えない**。

実機で初級2を開き、`issueInvoice()` を元のファイル(`InvoiceService`)のすぐ右の余白へドロップすると、新しい `InvoicePricing` のファイルの箱が、
元のファイルの箱の右下と288×153px(画面上)重なった。重なった箱は、下の箱のクラスやメソッドが隠れたり、どちらの箱をつかんでいるのか分かりにくくなる。
「整列」ボタンを押せば直るが、押す前に重ならないのが自然。

新しいファイルを置く位置を、既存のファイルと重ならない最も近い位置へずらす。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/canvas/avoidFileOverlap.ts` | presentation | 新しいファイルの位置を、既存のファイルと重ならないようにずらす純粋関数 |
| 新規 | `src/presentation/canvas/avoidFileOverlap.test.ts` | presentation | 上のテスト |
| 変更 | ドロップ位置から新しいファイルの位置を決めている箇所(`src/presentation/canvas/CodebaseCanvas.tsx` の `dropPositions` を作る所、`keepFilePositions.ts` の `placeFiles`) | presentation | 決まった位置を `avoidFileOverlap` に通す |
| 新規 | `e2e/new-file-no-overlap.spec.ts` | E2E | 受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。新しい依存は足さない。

## データ・型の変更

```ts
// src/presentation/canvas/avoidFileOverlap.ts
import type { XYPosition } from '@xyflow/react';
import type { FileRect } from './layoutCodebase';

/**
 * 新しいファイル(position に size で置く)が既存のファイル(existing)と重なるとき、重ならない位置までずらして返す。
 * ずらす向きは右。重なる箱の右端 + gap まで動かし、まだ重なる箱があれば繰り返す。重ならないなら position をそのまま返す。
 */
export function avoidFileOverlap(
  position: XYPosition,
  size: { readonly width: number; readonly height: number },
  existing: readonly FileRect[],
  gap: number,
): XYPosition;
```

- `gap` には `FILE_GAP`(60)を渡す
- ponytail: 右へずらすだけなので、右に長く並んでいると遠くへ飛ぶ。ファイルが十数個になって気になったら、下へ折り返すかグリッドで探す

## 動きの仕様

- ドロップ位置が余白(ノードの外)でも、新しいファイルの箱は広い(約300×200)ので、既存のファイルと重なることがある。そのときだけ右へずらす
- 重ならないときは、今までどおりドロップした点を中心にした位置に置く
- ずらした結果の位置は、既存の仕組みで保存・再現する(再描画で戻らない)
- ドロップ先がクラスの箱の中(Move Method)のときは、この処理を通らない(今のまま)

## TDD対象

### `avoidFileOverlap`

- 既存が空 → position のまま
- 重ならない位置 → position のまま
- 既存の箱と重なる → 位置の x が 既存の右端 + gap になる(y は同じ)
- ずらした先がさらに別の既存の箱と重なる → さらにその右端 + gap まで動く(2回目の繰り返し)
- 既存の箱の左側に接していて重ならない(隙間が gap 未満でも、重なっていなければそのまま)

## 受け入れ基準

1. 初級2で、元のファイルのすぐ右の余白へ `issueInvoice()` をドロップしても、新しいファイルの箱が元のファイルの箱と重ならない(2つの外接矩形が交わらない)
2. 元のファイルから十分離れた余白へドロップしたときは、ドロップした点を中心にした位置に置かれる
3. 「整列」を押すと、今までどおり依存の向きに並ぶ
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 「整列」ボタンの並べ方の変更
- 既存のファイルをドラッグして重ねたときの扱い(プレイヤーが自分で重ねるのは自由)
