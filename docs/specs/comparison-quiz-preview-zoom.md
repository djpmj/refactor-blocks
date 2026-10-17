# comparison-quiz-preview-zoom: 設計くらべの設計A・Bを同じ縮尺で並べる

## 背景・目的

2026-10-17 に設計くらべ1問目を開くと、設計A(3つのファイルを木の形に配置)は大きく読めるのに、
設計B(3つのファイルが横一列)は**小さく縮んで**、メソッド名・行数がほとんど読めなかった。

両方のプレビュー(`CodebasePreviewCanvas`)が、それぞれ自分の中身に合わせて `fitView` しているため、横に長い設計ほど縮む。
「どちらの設計が変更に楽か」を比べる画面で、片方だけ読みにくいと比べられないうえ、見た目の大きさの差が答えのヒントのようにも見えてしまう。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | 外から縮尺の上限(`maxZoom`)を受け取れるようにし、自分の `fitView` で求まった縮尺を親へ知らせる(`onFitZoom`) |
| 変更 | `src/presentation/quiz/ComparisonQuizView.tsx` | presentation | A・Bの `fitView` の縮尺のうち小さい方に、両方をそろえる |
| 新規 | `src/presentation/quiz/sharedZoom.ts` | presentation | 2つの縮尺から共通の縮尺を決める純粋関数 |
| 新規 | `src/presentation/quiz/sharedZoom.test.ts` | presentation | 上のテスト |
| 変更 | 設計くらべの E2E | E2E | 下の受け入れ基準を確かめる |

`domain` は変更しない。

## データ・型の変更

なし(コンポーネントの props の追加だけ)。

## 振る舞い

- 設計A・Bそれぞれで `fitView` したときの縮尺を求める
- 共通の縮尺 = 2つのうち小さい方。ただし 0.6 を下回るときは 0.6 にする(読めなくなるのを防ぐ。収まらない分はプレビューの中をパンして見る)
- 両方のプレビューを共通の縮尺で表示し、中身を中央に置く
- プレビューの大きさ(枠)が変わったら(ウィンドウのリサイズ)、求め直す
- 解答例の図など、設計くらべ以外のプレビューは今のまま(それぞれ `fitView`)

## TDD対象の純粋関数

### `sharedZoom(zoomA, zoomB, floor)`(`presentation/quiz/sharedZoom.ts`)

- `(1.0, 0.5, 0.6)` → `0.6`
- `(0.9, 0.8, 0.6)` → `0.8`
- `(0.7, 0.7, 0.6)` → `0.7`

## 受け入れ基準

1. 設計くらべ1問目で、設計A・Bのプレビューの `.react-flow__viewport` の `scale` が同じ値になっている
2. その値が 0.6 以上
3. 2〜4問目でも1・2が成り立つ
4. 解答例の図の縮尺は今と同じ
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 設計くらべのレイアウト(A・Bを縦に積むか横に並べるか)の見直し
- プレビューの中のホイールズーム(今どおり無効)
