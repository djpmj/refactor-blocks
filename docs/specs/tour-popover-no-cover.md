# tour-popover-no-cover: ツアーの吹き出しが、読ませたい場所を隠す

## 症状

2026-11-03 に実機(画面 1440x900 相当)で確認した。初回ガイド(`SpotlightTour`)とモードのミニガイド(`ModeIntroGuide`)の吹き出しが、指示文で読ませたい場所の上に重なる。

- (a) 設計くらべの手順2/3(対象 `.quiz__designs`)で、吹き出しが上に出て、依頼の文章とA/Bの回答ボタン(`.quiz__question`)に重なる。報告では手順1の文言「『依頼』と行数の上限を読もう」が引かれていたが、計算上ずれが起きるのは手順2(設計図が大きく下に入らず、上に押し出される)。手順2の文言も「依頼を入れるとき…比べよう」と依頼を読ませている
- (b) チュートリアル1の手順3/6(対象 `.app__body`)で、吹き出しが左上に出て、左パネル(`#stage-sidebar`)の課題文と結果カードの上部を覆う。この手順は「左の『リリースする』を押そう」「結果を読んだら」と左パネルを読ませている
- (c) 白紙設計の手順1/3(対象 `[data-testid="blank-view"] .stage-panel__heading`)で、吹き出しが要求文のすぐ下に出て、操作行(`.stage-panel__actions` のステージ選択・答え合わせ)を覆う

## 原因

`src/presentation/tour/SpotlightTour.tsx` の `calloutFor(spotlight)` が、吹き出しを「対象の下、入らなければ対象の上」の2択でしか置かない。

- 対象が画面の高さいっぱいに近いと、上下どちらにも入らず `Math.max(12, spotlight.top - height - 12)` で画面上端に押し付けられ、対象そのもの(b)や対象の上にある読ませたい要素(a)に重なる
- 対象の左右は候補にない。また、対象の外にある「読ませたい要素」(対象の隣の操作行や左パネル)を避ける手段がない(c)
- 吹き出しの高さは 200px 固定の見積もりで、文言が長い手順では実際の高さと合わない(コード内の `ponytail` コメントに記載済み)

`calloutFor` の呼び出し元は `measureSpotlight` の1か所だけで、`SpotlightTour` と `ModeIntroGuide` はどちらも `useSpotlightPosition` → `measureSpotlight` を通る。直すのはこの1か所で両方のツアーに効く。

## 修正

変更はすべて presentation 層(吹き出しの位置は画面の幾何の話で、ドメインの概念ではない。純粋関数は既存の `tourSteps.ts` と同じく `src/presentation/tour/` に置き、Vitest でテストする)。

### 1. 新規 `src/presentation/tour/calloutPlacement.ts`(純粋関数)

```ts
export type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
export type Size = { readonly width: number; readonly height: number };
export type CalloutPosition = { readonly left: number; readonly top: number };

/** 2つの矩形が重なる面積。接しているだけ・離れているときは0 */
export function overlapArea(a: Rect, b: Rect): number;

/** 吹き出しを置く位置。anchor(照らしている矩形)と avoid(読ませたい要素)の重なりの合計が最小の候補を返す */
export function placeCallout(input: {
  readonly anchor: Rect;
  readonly avoid: readonly Rect[];
  readonly size: Size;      // 吹き出しの実寸
  readonly viewport: Size;  // window.innerWidth / innerHeight
}): CalloutPosition;
```

決め方(この順で固定する):

1. 候補の元になる矩形を `[anchor, ...avoid]` の順に並べる
2. 各矩形 `r` について、次の4候補をこの順で作る(`GAP = 12`)
   - 下: `{ left: r.left, top: r.bottom + GAP }`
   - 上: `{ left: r.left, top: r.top - GAP - size.height }`
   - 右: `{ left: r.right + GAP, top: r.top }`
   - 左: `{ left: r.left - GAP - size.width, top: r.top }`
3. 各候補を画面内に収める(`EDGE = 16`): `left` を `[EDGE, viewport.width - size.width - EDGE]`、`top` を `[EDGE, viewport.height - size.height - EDGE]` に切り詰める。上限が `EDGE` を下回る(画面が吹き出しより狭い)ときは `EDGE` にする
4. 各候補の吹き出し矩形と `[anchor, ...avoid]` のそれぞれとの `overlapArea` を合計し、合計が最小の候補を返す。同点なら先に作った候補(= 先頭は従来どおり「対象の下・左揃え」)

- 重みは付けない(対象と読ませたい要素が重なっている場所を覆うと二重に数えられるので、自然にそこを避ける)
- 候補は最大 4×(1+avoid数) 個。`// ponytail: 候補は矩形の上下左右だけ。どこに置いても重なる画面では最小の重なりで妥協する、狭い画面で問題が出たら候補を増やす` のコメントを残す

### 2. 変更 `src/presentation/tour/tourSteps.ts`

`TourStep` に省略可能な `avoid` を足す。

```ts
export type TourStep = {
  readonly target: string;
  readonly text: string;
  readonly advance: TourAdvance;
  /** 指示文が読ませている、吹き出しで覆いたくない要素のセレクタ(target 以外) */
  readonly avoid?: readonly string[];
};
```

付ける手順は次の3つだけ。

| ツアー | 手順 | target | 追加する avoid |
| --- | --- | --- | --- |
| `TOUR_STEPS` | 3/6 | `.app__body` | `['#stage-sidebar']` |
| `MODE_INTRO_STEPS.quiz` | 2/3 | `.quiz__designs` | `['.quiz__question']` |
| `MODE_INTRO_STEPS.blank` | 1/3 | `[data-testid="blank-view"] .stage-panel__heading` | `['[data-testid="blank-view"] .stage-panel']`(操作行を含むヘッダー全体) |

### 3. 変更 `src/presentation/tour/SpotlightTour.tsx`

- `calloutFor` を削除し、`measureSpotlight` で `placeCallout` を呼ぶ。`Spotlight` 型は `Rect` に、`Callout` 型は `CalloutPosition` に置き換える(同じ形なので重複させない)
- `avoid` の各セレクタは既存の `getTargetRect` で測る。`null`(無い・隠れている・画面外)のものは除く。読ませたい要素には余白(padding 6)を足さない
- 吹き出しの寸法は実測にする。`useSpotlightPosition` が `useRef<HTMLElement>(null)` を作って返し、`SpotlightOverlay` の `<section className="spotlight-tour__callout">` に付ける。毎フレームの `measure` で `offsetWidth` / `offsetHeight` を読み、まだ描画されていない(ref が `null`)ときだけ従来の見積もり `{ width: Math.min(360, window.innerWidth - 32), height: 200 }` を使う。既存の「高さは固定の見積もり」の `ponytail` コメントは消す
- 対象が見つからないとき(`fallbackCallout`)の挙動は変えない

## テスト

### Vitest(先に書く): 新規 `src/presentation/tour/calloutPlacement.test.ts`

AAA パターンで書く。

`overlapArea`
- 一部が重なる2矩形 → 重なった部分の面積
- 一方が他方を含む → 小さい方の面積
- 辺で接しているだけ → 0
- 離れている → 0

`placeCallout`(viewport は `{ width: 1440, height: 900 }`、size は `{ width: 360, height: 200 }`)
- 小さな対象が画面上部にあり avoid なし → 対象の下・左揃え(従来どおり)
- 対象が画面下端にあり下に入らない → 対象の上
- 対象が画面の高さいっぱい(上下どちらにも入らない)で右に空きがある → 対象の右、重なり0
- 対象を下に置くと avoid に重なり、avoid の下なら空いている(症状 c の形: 対象=ヘッダーの左側、avoid=ヘッダー全体) → avoid の下、重なり0
- 対象を上に置くと avoid に重なり、avoid の右なら空いている(症状 a の形) → 重なり0の位置。返した位置が avoid とも対象とも重ならないことを `overlapArea` で確かめる
- 対象が画面全体で、左側に avoid がある(症状 b の形) → 返した位置が avoid と重ならない
- 画面右端の対象 → `left` が `viewport.width - size.width - 16` を超えない。画面が吹き出しより狭い → `left` が 16

### E2E(Playwright): 新規 `e2e/tour-popover-no-cover.spec.ts`

`page.setViewportSize({ width: 1440, height: 900 })` で実機の画面に合わせる。ガイドの見た印の消し方は既存の `e2e/first-visit-tour.spec.ts`(`clearTourSeenOnce`)と `e2e/mode-intro-guides.spec.ts`(`clearIntroSeen`)と同じにする。吹き出しの矩形と比べる相手の矩形を `boundingBox()` で取り、重なりが無いこと(1px の誤差を許す)を `expect.poll` で確かめる。

- (a) 設計くらべ: 手順1/3 で吹き出しが `.spotlight-tour__hole` と重ならない。手順2/3 で吹き出しが `.quiz__question` と重ならない
- (b) チュートリアル1: 手順3/6(「実際に直してみる」を押した後)で吹き出しが `#stage-sidebar` と重ならない
- (c) 白紙設計: 手順1/3 で吹き出しが `.spotlight-tour__hole` とも `[data-testid="blank-view"] .stage-panel__actions` とも重ならない

既存の `e2e/first-visit-tour.spec.ts` と `e2e/mode-intro-guides.spec.ts` はそのまま通ること(手順の進み方は変えない)。

## 受け入れ基準

1. 1440x900 で症状 (a)(b)(c) の手順を開き、吹き出しが上の表の読ませたい要素を覆わない。(a) 手順1と (c) では照らしている枠とも重ならない
2. 他の手順(チュートリアル1の 1/6・2/6・4〜6/6、設計くらべ 1/3・3/3、白紙設計 2/3・3/3)でも吹き出しが画面内に収まり、操作して先へ進める(既存E2Eが通る)
3. `calloutPlacement.test.ts` が先に Red になり、実装後に Green になる
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 吹き出しに矢印(しっぽ)を付ける、位置を変えるときのアニメーション
- 手順の `target` や文言の変更(表示範囲を変えると、暗幕の穴で操作できる範囲が変わるため)
- 狭い画面(サイドバーが重なって出る幅)での配置の作り込み。今回の候補で最小の重なりに妥協する
- (b) で右上に寄った吹き出しがメソッドエディタの上端に重なること。この手順で読ませているのは左パネルなので許容する。気になったら `avoid` に足すだけで済む
- 白紙設計の手順3/3で、答え合わせボタンの下の「押せない理由」の文に吹き出しが重なるかどうか(今回の報告に無い)
- Floating UI などの配置ライブラリの導入(上下左右の候補と重なり面積の比較で足りる。新しい依存は足さない)
