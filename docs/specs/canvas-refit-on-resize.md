# canvas-refit-on-resize: キャンバスの大きさが変わったら図を合わせ直す

## 背景・目的

キャンバス(`CodebaseCanvas`)は、ステージの切り替え・ファイルの増減・「最初に戻す」・「整列」のときだけ、図全体が収まるように合わせる(`FitViewOnLayoutChange` の `fitView()`)。
**キャンバスの大きさが変わったときは合わせ直さない**ため、遊んでいて次のことが起きた。

- ウィンドウを幅 1605px → 900px に縮めると、キャンバスは 540px になるが、図の倍率は変わらない。図の右端は 1164px の位置まで伸びたままで、はみ出して切れる
- 狭い状態でステージを開いてから広げると、図が左端に小さく(倍率 0.38)残り、ズームの段階表示(`useShowDetails`)でメソッドが隠れて読めない(初級1・中級1を開いたときに起きた)
- 左右のサイドバーを開閉したり、幅を変えたりしたときも同じ

一方で、プレイヤーが自分でズーム・移動した表示を、勝手に戻してはいけない。

そこで、**プレイヤーが最後の自動の合わせ以降に自分でズーム・移動していない間だけ**、キャンバスの大きさが変わったら図を合わせ直す。
あわせて、ステージを開いたときの合わせを、ノードの大きさが測れてから行うようにする。

### 実装の進め方(2026-10-17 追記)

この Issue だけを実装すると、ステージを開いたときの合わせがノードの計測後になり、幅の広いステージでは倍率が 0.6 を下回る(計測で 0.543。`padding` を 0 にしても 0.598)。
その結果、ズームの段階表示(`useShowDetails`)でメソッドが隠れ、既存の E2E が4件失敗する。受け入れ基準5(詳細が表示される大きさで出る)も、自動の合わせのズーム下限(#189)が無いと満たせない。

そのため、**この Issue と #189 detail-zoom-floor は、同じブランチ・同じPRで実装する**。
先にこの仕様の内容を入れ、続けて同じブランチで #189 の `autoViewport` を入れ、両方の受け入れ基準と `npm run test:e2e` の全件を通してからPRにする。PRは両方の Issue を閉じる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/canvas/autoFit.ts` | presentation | 合わせ直してよいかを判定する純粋関数 |
| 新規 | `src/presentation/canvas/autoFit.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | キャンバスの大きさの変化を見て合わせ直す。プレイヤーの操作でズーム・移動したかを覚える。ステージを開いたときの合わせをノードの計測後に行う |
| 新規 | `e2e/canvas-refit-on-resize.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。新しい依存は足さない(ブラウザ標準の `ResizeObserver` と、React Flow の `useNodesInitialized`・`onMoveStart` を使う)。

## データ・型の変更

```ts
// src/presentation/canvas/autoFit.ts
export type AutoFitState = {
  /** 最後に自動で合わせたあと、プレイヤーが自分でズーム・移動したか。 */
  readonly userMoved: boolean;
  /** 最後に合わせたときのキャンバスの大きさ。 */
  readonly lastSize: { readonly width: number; readonly height: number } | null;
};

/** キャンバスの大きさが size になったとき、合わせ直すべきか。プレイヤーが動かしていない、かつ幅か高さが 1px 以上変わったとき true。 */
export function shouldRefit(state: AutoFitState, size: { readonly width: number; readonly height: number }): boolean;
```

## 見た目・動きの仕様

- キャンバスの入れ物(`.app__canvas`)の大きさを `ResizeObserver` で見る
- 大きさが変わり、`shouldRefit` が `true` なら、`fitView()` で合わせ直す。アニメーションは付けない(サイドバーの開閉に合わせて何度も呼ばれるため)。
  連続して変わるとき(ウィンドウのドラッグでのリサイズ)は、最後の変化から 150ms 待ってから1回だけ合わせる
- 「プレイヤーが自分でズーム・移動した」は、React Flow の `onMoveStart` がユーザーの操作のイベント(`event` が `null` でない)で呼ばれたとき、とする。
  ズームのボタン(+/−)も含む。自動の `fitView` やヒントで光らせるための `fitView`(`FocusOnRule`)は含まない
- 次のときは、`userMoved` を `false` に戻す(今と同じく合わせ直す)
  - ステージの切り替え・ファイルの増減・「最初に戻す」・「整列」
  - 「全体を表示」ボタン(React Flow の `Controls` の fit view)を押したとき
- ステージを開いたとき・最初に戻したときの合わせは、ノードの大きさが測れてから(`useNodesInitialized()` が `true` になってから)行う
- 変更依頼に挑戦している間も同じ動きにする

## TDD対象の純粋関数

### `shouldRefit`(`presentation/canvas/autoFit.ts`)

- 動かしていない・前回の大きさが無い → `true`
- 動かしていない・幅が変わった → `true`
- 動かしていない・大きさが同じ → `false`
- 動かした・幅が変わった → `false`

## 受け入れ基準

1. 幅 1600px でステージを開き、ウィンドウを幅 900px に縮めると、図全体がキャンバスに収まるように合わせ直される(図の右端がキャンバスの右端を超えない)
2. 幅 600px でステージを開いてから 1600px に広げると、図が広がって合わせ直され、メソッドが読める大きさになる
3. 図をホイールでズームしたあとにウィンドウの大きさを変えても、プレイヤーのズームは保たれる(合わせ直さない)。「全体を表示」を押したあとは、また大きさの変化に合わせる
4. 左のサイドバーを閉じる・開くと、図が合わせ直される(プレイヤーが動かしていないとき)
5. ステージを切り替えた直後の図が、キャンバスに収まり、詳細(メソッド)が表示される大きさで出る
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 設計くらべ・白紙設計・プレビューのダイアログのキャンバス
- 図の自動整列(並べ方)の変更
- ズームの段階表示(`useShowDetails`)のしきい値の変更
