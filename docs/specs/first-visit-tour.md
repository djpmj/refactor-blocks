# 初回のスポットライト・ガイド(チュートリアル1)

## 背景・目的

初めてゲームを開いたプレイヤーは、サイドバー(課題)・キャンバス(ブロック)・メソッドエディタ(編集)のどこから手を付ければいいか迷う。操作ガイド(`?` キー、`OperationGuideDialog`)はあるが、操作の一覧を読ませる形で、「次にどこを触るか」は教えない。チュートリアル1の課題文も文章で説明しているだけ。

そこで、**チュートリアル1(`tutorial-extract-method`)を初めて開いたときだけ**、画面を暗くして操作すべき場所を1つずつ照らし(スポットライト)、吹き出しで具体的な行動を示すガイドを出す。プレイヤーが**実際にその操作をすると次の段へ進む**ので、読むだけでなく手を動かして覚えられる。

### 設計判断(対話で確定済み)

- **対象**: チュートリアル1の初回だけ。具体的な操作(どのメソッドを押すか)まで案内してよいのはチュートリアルだけ、という考え方。他のステージでは出さない。
- **進め方**: プレイヤーが実際に操作すると次へ進む。説明だけの段(課題の確認・最後のまとめ)は「次へ」ボタンで進む。
- **再表示**: 操作ガイドのダイアログに「初回ガイドをもう一度」ボタンを置く。

## ponytailチェック

1. YAGNI: ガイドの段の定義はチュートリアル1の分だけをコードの定数で持つ。ステージ定義に「ガイドの台本」の欄は作らない(2つ目のガイドが要るときに考える)。
2. 既存の再利用: 見たかどうかの保存は `storyPreference.ts` と同じ形(`localStorage`、読めなくても例外を投げない)。開閉は Zustand のストアに乗せる。強調表示の対象は既存の `data-testid`・`id` をセレクタで指す。
3. 標準機能: 暗幕と穴は `getBoundingClientRect` と CSS(`position: fixed`)で作る。新しい依存(ツアー用ライブラリ)は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/tour/tourSteps.ts` | presentation | 新規 | ガイドの段の定義(`TOUR_STEPS`)と、次の段を決める純粋関数 `nextTourStep` |
| `src/presentation/tour/tourSteps.test.ts` | presentation(test) | 新規 | `nextTourStep` のテスト |
| `src/presentation/tour/SpotlightTour.tsx` | presentation | 新規 | 暗幕・穴・吹き出しの表示と、段の進行 |
| `src/infrastructure/tour/tourPreference.ts` | infrastructure | 新規 | 初回ガイドを見たかどうかの読み書き(`loadTourSeen`/`saveTourSeen`) |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `tourStep: number \| null`・`startTour()`・`advanceTour()`・`endTour()` を足す。チュートリアル1を開いたとき、未表示ならガイドを始める |
| `src/presentation/guide/OperationGuideDialog.tsx` | presentation | 変更 | 「初回ガイドをもう一度」ボタンを足す |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | 処理の一覧と抽出ボタンに、ガイドが指すための `data-tour` 属性を付ける |
| `src/App.tsx`(またはステージ画面のルート) | presentation | 変更 | `SpotlightTour` を置く |
| `src/index.css` | presentation | 変更 | 暗幕・穴の縁取り・吹き出しの見た目 |
| `e2e/first-visit-tour.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

`domain`/`application` 層は変更しない(画面の案内だけで、ゲームのルールに関わらない)。

## データ/型の変更

```ts
// src/presentation/tour/tourSteps.ts
export type TourAdvance =
  | { readonly kind: 'next' } // 「次へ」ボタンで進む
  | { readonly kind: 'select-method'; readonly methodName: string } // そのメソッドが選ばれたら進む
  | { readonly kind: 'click-inside' } // 照らしている要素の中をクリックしたら進む
  | { readonly kind: 'extract' }; // この段を始めたときよりメソッドが増えたら進む

export type TourStep = {
  readonly target: string; // document.querySelector に渡すセレクタ
  readonly text: string;
  readonly advance: TourAdvance;
};

export const TOUR_STAGE_ID = 'tutorial-extract-method';
export const TOUR_STEPS: readonly TourStep[];

/** 今の段と起きたこと(イベント)から、次の段の番号を返す。最後の段を終えたら null(ガイド終了)。進まないイベントなら今の段のまま。 */
export type TourEvent =
  | { readonly kind: 'next' }
  | { readonly kind: 'method-selected'; readonly methodName: string }
  | { readonly kind: 'clicked-inside' }
  | { readonly kind: 'method-count'; readonly count: number; readonly countAtStepStart: number };
export function nextTourStep(steps: readonly TourStep[], current: number, event: TourEvent): number | null;
```

```ts
// src/infrastructure/tour/tourPreference.ts
/** 初回ガイドを見た(最後まで進めた、または閉じた)か。読めないときは false。 */
export function loadTourSeen(): boolean;
/** 書き込めなくても例外を投げない。 */
export function saveTourSeen(): void;
```

## 仕様

### ガイドの段(`TOUR_STEPS`)

| # | 照らす場所(`target`) | 吹き出し | 進み方 |
| --- | --- | --- | --- |
| 1 | サイドバー(`#stage-sidebar`) | ここに課題が出ます。まずは「困っていること」と「クリア条件」を確認しよう | 次へ |
| 2 | メソッド `printMonthlyReport()`(`[data-testid="method-printMonthlyReport"]`) | 長すぎるメソッド printMonthlyReport() をクリックしてみよう | `printMonthlyReport` が選ばれたら |
| 3 | メソッドエディタの処理の一覧(`[data-tour="fragment-list"]`) | 中身が処理のまとまりごとに並んでいます。一緒に切り出したいまとまりを選ぼう(例: 今月の売上を集計する) | 一覧の中をクリックしたら |
| 4 | 抽出ボタン(`[data-tour="extract-button"]`) | 「選んだ処理をメソッドとして抽出」を押そう | メソッドが増えたら(抽出に成功したら) |
| 5 | 点数(`.score-badge`) | 新しいメソッドができ、点数とクリア条件が変わりました。メソッドが50行以内になるまで続けてみよう | 次へ(押すとガイド終了) |

- 文言は実装者が画面に合わせて調整してよい。ただし #103(`sidebar-problem-structure`)が未マージなら、段1の文言は「課題」を確認する言い方にする(「困っていること」「クリア条件」はその仕様で入る欄の名前)。
- 段4の「メソッドが増えた」は、段4を始めたときのチュートリアル1のコードベース全体のメソッド数と比べる(段を始めたときの数を覚えておく)。
- 照らす要素がその時点で見つからない(サイドバーが閉じている・狭い画面で隠れているなど)とき、説明だけの段(段1・段5)は吹き出しだけを画面中央に出す。操作の段(段2〜4)で要素が見つからないときも吹き出しを中央に出し、「次へ」で飛ばせるようにする(プレイヤーが先へ進めなくなるのを防ぐ)。

### 始まる・終わる

- ステージがチュートリアル1になったとき(初回起動でチュートリアル1が選ばれている場合を含む)、`loadTourSeen()` が `false` で、変更依頼の実装中でなければ、段1から始める。
- 吹き出しには常に「ガイドを終了」ボタンを置き、`Esc` キーでも終了できる。
- 最後まで進めたとき・途中で終了したときのどちらでも `saveTourSeen()` を呼び、次からは自動で出さない。
- ガイドの途中でステージを切り替えたら、ガイドを終了する(見たことにする)。
- 「元に戻す」「最初に戻す」はガイド中も使える(ガイドは段を戻さない)。

### 再表示

- 操作ガイドのダイアログに「初回ガイドをもう一度」ボタンを置く。押すとダイアログを閉じ、今のステージがチュートリアル1でなければチュートリアル1を開いてから(`selectStage`)段1から始める。保存済みの「見た」印は消さない。
- 変更依頼の実装中はボタンを押せない。

### 見た目・操作(`SpotlightTour`)

- 照らす要素の `getBoundingClientRect()` に少し余白を足した四角を穴にし、その外側を半透明の暗幕で覆う。暗幕は穴の外側のクリックを止める(説明と関係ない場所を誤って押さないように)。穴の中は普段どおりクリック・ドラッグできる。
- キャンバスのパン・ズームや画面サイズの変更で要素が動くので、ガイド表示中は `requestAnimationFrame` で位置を追い直す(`// ponytail: 表示中は毎フレーム位置を測る。重ければ ResizeObserver とReact Flowのビューポート変更イベントに絞る`)。
- 吹き出しは穴の近く(下、入らなければ上)に出し、`role="dialog"`・`aria-live="polite"` で文言を読み上げる。段が変わったら吹き出しにフォーカスを移さず(操作の邪魔をしないため)、文言の読み上げだけで知らせる。「次へ」「ガイドを終了」はキーボードで押せる。
- 吹き出しに「{n}/5」の段の番号を出す。

### `data-tour` 属性

- `MethodEditor.tsx` の `FragmentList` の `<ul>` に `data-tour="fragment-list"`、抽出ボタンに `data-tour="extract-button"` を付ける。既存の `className`・`aria-label` は変えない。

## TDD対象の純粋関数

### `nextTourStep`(`src/presentation/tour/tourSteps.ts`)

表示に関わる純粋関数だが、段の進み方を守るためテストを書く(`ruleWhy.test.ts` などと同じ扱い)。

- `next` の段で `next` イベント → 次の段へ
- 最後の段で `next` → `null`(終了)
- `select-method` の段で、指定のメソッド名の `method-selected` → 次の段へ。別のメソッド名なら今の段のまま
- `click-inside` の段で `clicked-inside` → 次の段へ
- `extract` の段で、`count > countAtStepStart` の `method-count` → 次の段へ。同じ数なら今の段のまま
- 段の種類と合わないイベント(例: `next` の段で `clicked-inside`)→ 今の段のまま
- 照らす要素が見つからない操作の段で `next` → 次の段へ(飛ばせる)

### `tourPreference.ts`

- `infrastructure` 層の副作用コードなのでユニットテストは任意(`storyPreference.ts` と同じ扱い)。E2Eで「2回目は出ない」を確認する。

## 受け入れ基準

1. `npm run check` が通る。`nextTourStep` にAAAパターンのテストがある。
2. 保存データのないブラウザでチュートリアル1を開くと、画面が暗くなりサイドバーが照らされた段1が出る。
3. 段2〜4は、実際に `printMonthlyReport()` をクリック → 処理を選ぶ → 抽出ボタンを押す、の操作で順に進み、段5の「次へ」でガイドが閉じる。
4. 照らしている場所の外側はクリックできず、照らしている場所の中は普段どおり操作できる。
5. 「ガイドを終了」または `Esc` で、どの段からでも閉じられる。
6. 一度閉じたあと、ページを再読み込みしてチュートリアル1を開いても、ガイドは自動で出ない。
7. 操作ガイドの「初回ガイドをもう一度」で、別のステージからでもチュートリアル1に移ってガイドが段1から始まる。
8. チュートリアル1以外のステージでは、ガイドは自動で出ない。
9. E2E(`e2e/first-visit-tour.spec.ts`): 2〜8を確認する。既存のE2Eは、ガイドが邪魔をしないよう、テストの前に「見た」印を `localStorage` に入れておく形で通るようにする(各テストの共通の前準備に足す)。
10. `npm run test:e2e` が通る。

## スコープ外

- チュートリアル2以降・他ステージのガイド、ステージ定義にガイドの台本を持たせる仕組み。
- Move Method(ドラッグ)を案内する段。
- 「見た」印を消す設定画面(再表示ボタンで足りる)。
- 吹き出しのアニメーション・矢印の装飾。
- タッチ端末での操作の最適化。

## 未決事項

なし。対象・進め方・再表示は対話で確定済み。吹き出しの文言は実装者の裁量。
