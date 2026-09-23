# 右クリックメニューをビューポート内に収める

## 背景・目的

`CanvasContextMenu.tsx` には `// ponytail: 画面端での位置補正はしていない。右下端ではみ出すと分かったらビューポートに収める`
という意図的な手抜きコメントが残っていた。実際に `e2e/refactor.spec.ts:497`
「切り出したメソッドを含むクラスを削除すると…」が、クラスをドラッグで動かした後の右クリックで
メニューがビューポート外(画面下端の外)に表示され、Playwrightがクリックできず30秒タイムアウトで
失敗することが分かった(この変更が入る前のコミットでも同じ手順で同じ失敗が再現することを確認済み。
今回の3機能追加が原因ではない、既存の手抜きの上限に達したケース)。手抜きの上限に達したので直す。

## 受け入れ条件

### `src/presentation/canvas/clampMenuPosition.ts`(新規)

- 純粋関数 `clampMenuPosition(point, menuSize, viewport): { x: number; y: number }` を追加する
  - `point`(クリック位置)・`menuSize`(メニューの実際の幅・高さ)・`viewport`(ビューポートの幅・高さ)を受け取る
  - メニューが右端・下端からはみ出す場合は、はみ出さない位置まで内側へ収める(`x = min(point.x, viewport.width - menuSize.width)` など)
  - メニュー自体がビューポートより大きい場合は、左端・上端(0)に寄せる(負の位置にはしない)
  - はみ出さない場合はクリック位置をそのまま返す
  - TDD(AAAパターン)でテストを先に書く

### `src/presentation/canvas/CanvasContextMenu.tsx`

- `useLayoutEffect` で、メニューを描画した直後(ペイント前)に `menuRef.current.getBoundingClientRect()` の
  幅・高さと `window.innerWidth`/`innerHeight` を使って `clampMenuPosition` を呼び、実際に描画する位置を
  補正する(最初は `target.x`/`target.y` で描画し、レイアウトエフェクトで補正後の位置に置き換える。
  `useLayoutEffect` はペイント前に走るのでちらつきは出ない)
  - フォーム(`mode`)を開いてメニューの中身の大きさが変わったときも、開き直したときと同様に補正する
    (`mode` の変化でも再計算する)
- 手抜きコメント(`// ponytail: ...`)は役目を終えたので削除する

## テスト

- `clampMenuPosition.test.ts`(TDD): はみ出さない場合はそのまま/右端・下端のはみ出しをそれぞれ収める/
  メニューがビューポートより大きいときは0に寄せる、を確認する
- 失敗していた `e2e/refactor.spec.ts:497` が通ることを確認する(既存のE2Eなので新規追加はしない)
- `npm run test:e2e` を再実行し、他のテストに回帰がないことを確認する
