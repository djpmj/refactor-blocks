# editor-open-canvas-refit: メソッドエディタを開いてキャンバスが狭くなったら、選んだクラスが見えるように合わせ直す

## 症状

実機(1440x900)の上級1・上級2で、メソッドをクリックすると右のメソッドエディタが開き(48px のレール → 幅 360px)、
キャンバスの幅が 480〜1392px(912px)から 480〜1080px(600px)に縮む。そのとき図が合わせ直されたように見えず、ノードが見切れる。

- 上級2: `PaypalGateway` が x=1006〜1202 のまま、キャンバスの右端(1080)を越えて切れる。1.5秒待っても変わらない
- 上級1: `NotifierBase` が半分隠れ、継承の矢印もパネルの下(キャンバスの外)へ出る
- 抽出の直後は新しいメソッドが選ばれてエディタが開くので、ほぼ毎回起きる

### 既存の仕様との関係

- `canvas-refit-on-resize.md`(#180): キャンバスの大きさが変わったら、プレイヤーが動かしていない間は合わせ直す。
  受け入れ基準はサイドバーの開閉とウィンドウの幅だけで、メソッドエディタの開閉は挙げていなかった。
  ただし実装(`FitViewOnResize`)は `.canvas-column__flow` を `ResizeObserver` で見ているので、エディタの開閉による幅の変化でも合わせ直しは**走る**
- `detail-zoom-floor.md`(#189): 自動の合わせでは `DETAIL_ZOOM`(0.6)未満に縮めず、収まらない分は図の左上から見せる(`autoViewport`)
- `new-class-into-view.md`: 余白へのドロップで作ったファイルの箱がはみ出したら、ズームを変えずにパンして見せる(`panToReveal`)。今回これを再利用する

## 原因

`src/presentation/canvas/CodebaseCanvas.tsx` の `FitViewOnResize` → `useAutoViewportFit` → `autoViewport` の流れを追うと、合わせ直しは走っているが、**結果がほとんど変わらない**。

- 上級2の `PaypalGateway` の箱の幅は画面上 196px = ファイル幅 328(`CLASS_WIDTH 280 + FILE_PADDING 24 × 2`)× 0.6。
  つまり**エディタを開く前(幅 912px)の時点ですでに下限の 0.6 で、左上寄せ**になっている
- 1段に3ファイル並ぶ段(幅 3×328 + 2×60 = 1104)は、0.6 でも画面上 662px + 余白が要り、幅 600px には収まらない。
  `autoViewport` は倍率 0.6・左上寄せ(余白 = `min(幅, 高さ) × 0.1`)を返す。キャンバスの高さが 600px 前後以下なら余白も同じなので、表示はまったく動かない。
  これが「x=1006〜1202 のまま」「待っても合わせ直されない」に見えた理由
- したがって、`FitViewOnResize` の「合わせ直さない」不具合ではなく、**下限で収まらないときに右側(エディタに近い側)がまるごと切れ、プレイヤーがクリックしたクラスまで見えなくなる**のが問題

直す場所は、自動の合わせを1か所でしている `useAutoViewportFit` の `fit`(`FitViewOnLayoutChange` と `FitViewOnResize` の両方が呼ぶ)だけで済む。

### 決めたこと(未決事項は残さない)

- **`DETAIL_ZOOM` の下限は崩さない。** 0.6 未満にするとメソッドが隠れ、エディタで触っているメソッドがキャンバスから読めなくなる。1440x900 の上級2で全ノードを収めることは、下限がある限りできないので求めない
- その代わり、**合わせた結果、選んでいるメソッド(またはフィールド)のクラスがキャンバスからはみ出すなら、ズームを変えずにそのクラスが見える分だけパンする**。プレイヤーがクリックした場所・抽出した新メソッドが常に見える
- 幅が足りて 0.6 以上で収まる画面(1920x1080 など)では、今どおり全体が収まる(エディタを開いても全ノードがキャンバス内)
- プレイヤーが自分でズーム・移動したあと(`userMoved: true`)は、今どおり何もしない(`shouldRefit` は変えない)

本当に新しい仕組みが要るか: 合わせ直しの検知(`ResizeObserver`・`shouldRefit`)も、はみ出し量の計算(`panToReveal`)も既にある。足すのは「合わせた表示に、選んだクラスのはみ出し分のパンを足す」純粋関数1つだけ。

## 修正

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/autoViewport.ts` | presentation | `revealInViewport` を追加(下記) |
| 変更 | `src/presentation/canvas/autoViewport.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | `useAutoViewportFit` の `fit` で、選んでいるメソッド・フィールドのクラスがあれば、`autoViewport` の結果に `revealInViewport` をかけてから `setViewport` する |
| 新規 | `e2e/editor-open-canvas-refit.spec.ts` | E2E | 下の受け入れ基準 |

`domain` / `application` / `infrastructure` は変更しない。新しい依存は足さない。データ・型の変更なし。

### 追加する純粋関数

```ts
// src/presentation/canvas/autoViewport.ts
/**
 * viewport で表示したとき、box(フローの座標)がキャンバス(size)からはみ出すなら、ズームは変えずに見える分だけパンした表示を返す。
 * はみ出し量は panToReveal(box の画面座標, { x: 0, y: 0, ...size }, margin)で求める。
 */
export function revealInViewport(
  viewport: Viewport,
  box: Rect,
  size: { readonly width: number; readonly height: number },
  margin: number,
): Viewport;
```

- 画面座標は `{ x: box.x * zoom + viewport.x, y: box.y * zoom + viewport.y, width: box.width * zoom, height: box.height * zoom }`
- 返り値は `{ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }`
- `margin` は既存の `REVEAL_MARGIN`(24)を使う

### `useAutoViewportFit` の変更

- `useGameStoreApi()` で、合わせる時点の `selectedMethodId` / `selectedFieldId` と `codebase` を読む(購読はしない。合わせのきっかけは今までどおり大きさの変化・レイアウトの変化だけ)
- `findClassOfMethod` / `findClassOfField`(`domain/codebase/Codebase.ts`)でクラスを求め、そのクラスのノードがあれば `getNodesBounds([classNode])` で矩形(絶対座標)を取る
- `autoViewport(...)` の結果に `revealInViewport(...)` をかけて `setViewport` する。選択が無い・クラスのノードが無いときは今と同じ
- 関数が60行・複雑度12を超えないよう、選択中のクラスの矩形を取る部分は小さな関数に分ける

## テスト

先に書いて、失敗(Red)を確かめてから直す。

### Vitest: `revealInViewport`(`autoViewport.test.ts`、AAA)

- 箱が収まっている → 入力の viewport をそのまま返す
- 箱が右に 50px はみ出す(zoom 0.6) → `x` が `-(50 + margin)` 動き、`y`・`zoom` は変わらない
- 箱が下にはみ出す → `y` だけ負の向きに動く
- 箱がキャンバスより横に大きい → 箱の左端が `margin` の位置に来る(`panToReveal` の左上優先と同じ)

### E2E: `e2e/editor-open-canvas-refit.spec.ts`

`canvas-refit-on-resize.spec.ts` の `expectNodesInsideCanvas`・`viewportZoom` と同じ測り方をする(必要ならこのファイルにコピーしてよい。共通化はしない)。

1. **1440x900・上級2**: 開幕の手直しを済ませ(`selectStage(..., { completeOpeningFix: true })`)、`PaypalGateway` のメソッドをクリックしてエディタを開く。
   250ms 待ったあと、`PaypalGateway` のクラスのノードがキャンバス(`.app__canvas`)の中に収まり、倍率が 0.599 以上。
   (今の実装では右端 1202 > 1080 で失敗する)
2. **1920x1080・上級2**: 同じ操作で、エディタを開いたあと全ノードがキャンバスの中に収まり、倍率が 0.599 以上
3. **プレイヤーが動かしたあと**: 1440x900・上級2でホイールズームしてからメソッドをクリックすると、倍率がズーム直後の値のまま(合わせ直さない)
4. **上級1**: 1440x900 で `NotifierBase` にあるメソッドをクリック(無ければ、継承の親クラスのメソッド)すると、そのクラスのノードがキャンバスの中に収まる

E2E は1件ずつ(既定の1並列)で走らせる。

## 受け入れ基準

1. 1440x900 の上級1・上級2で、どのクラスのメソッドをクリックしても、そのクラスの箱がエディタの下に隠れず、キャンバスの中に全部見える。倍率は 0.6 以上のまま(メソッドが読める)
2. メソッドを抽出した直後(新しいメソッドが選ばれてエディタが開いたまま)も、そのクラスがキャンバスの中に見える
3. 1920x1080 の上級2では、エディタを開いても全ノードがキャンバスの中に収まる
4. ホイール・ドラッグで自分でズーム・移動したあとは、エディタを開閉しても表示が動かない。「全体を表示」を押したあとは、また合わせ直す(既存の動き)
5. 既存の `canvas-refit-on-resize.spec.ts`・`detail-zoom-floor.spec.ts`・`new-class-into-view.spec.ts` が通る
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- `DETAIL_ZOOM` の値・自動の合わせの下限の変更(1440x900 の上級2で、選んでいないクラス(右端の `PaypalGateway` など)が切れるのは下限どおりの動きとして残す。スクロールで見る)
- メソッドエディタを図の上に重ねる(キャンバスを縮めない)レイアウトへの変更、エディタの既定幅の変更
- 図の並べ方(1段に並ぶファイル数を減らす折り返しなど)
- プレイヤーが動かしたあとでも選んだクラスを見せるパン(`userMoved: true` のときは何もしない)
- 幅 700px 以下のドロワー表示(キャンバスは縮まないので対象外)、設計くらべ・白紙設計のキャンバス
- `FitViewForRule`(ヒント・減点の場所への合わせ)の変更
