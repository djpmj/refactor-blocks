# hint-highlight-clears-on-change: 操作でコードが変わったら、ヒントの光る強調を消す

## 背景・目的

ヒント「どこが問題?」「次の一手」を押すと、キャンバスの該当するメソッド・クラス・ファイルが黄色く光る(`hintTarget`)。
実機で初級2を遊ぶと、ヒントを押したあとに抽出や元に戻す・やり直しをしても、**光りが残り続ける**。
光っているメソッド(`issueInvoice`)は、抽出で20行→18行に変わっているのに、まだ黄色いまま。次の操作でどこが問題なのかを示す光りではなく、古い案内になる。
光りが消えるのは、「最初に戻す」・ステージ切り替え・別のヒントや減点の行を選んだときだけ。

ヒントの光りは、**そのときのコードに対する案内**なので、コードが変わったら消す。もう一度見たければ、ヒントのボタンをもう一度押せばよい。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | コードが変わる更新(`commit`、元に戻す・やり直しの `travelTo`)で `hintTarget` / `hintTargetKey` を `null` にする |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 上のテスト |
| 新規 | `e2e/hint-highlight-clears-on-change.spec.ts` | E2E | 受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。

## 動きの仕様

- `commit`(抽出・移動・統合・削除・可視性・クラス追加など、コードを変える操作)が新しい `codebase` を返すとき、`hintTarget: null` と `hintTargetKey: null` も一緒に返す
  - `commit` は、コードが変わらないとき(`codebase === state.codebase`)は `{}` を返す今の動きのまま。つまり、**失敗した操作・何も変わらない操作では光りは消えない**
- 元に戻す・やり直し(`travelTo`)でコードが変わるときも、同じく消す
- ヒントのボタンの「押している」状態(`aria-pressed`、`hintTargetKey === hintKey`)は、`hintTargetKey` が `null` になれば自然に外れる(`HintList` は変更不要)
- 減点の行を選んだときの強調(`focusedRule`)は、この仕様では変えない(ponytail: 減点の行はコードが変わっても残るのが今の仕様。同じ違和感が出たら別の仕様にする)

## TDD対象

### ストア(`useGameStore.test.ts`)

- `focusHint` で `hintTarget` を入れたあと、抽出に成功すると `hintTarget` / `hintTargetKey` が `null` になる
- 同じく、メソッドの移動に成功したとき `null` になる
- 同じく、元に戻す・やり直しで `null` になる
- 失敗する抽出(同じ名前など)では、`hintTarget` は残る
- ヒントを入れていないとき、操作しても `hintTarget` は `null` のまま(余計な再描画が起きない: `hintTarget` が `null` → `null` で同じ参照)

## 受け入れ基準

1. 初級2で「どこが問題?」を押して該当が光ったあと、抽出すると、光りが消え、ヒントのボタンの押している状態も外れる
2. 光りが出ている状態で、同じ名前での抽出など失敗する操作をしても、光りは残る
3. 光りが出ている状態で「元に戻す」を押すと、光りが消える
4. ヒントのボタンをもう一度押すと、今のコードに合わせて光りが出る
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 減点の行の強調(`focusedRule`)の扱い
- ヒントの内容・段階の変更
- 光りの見た目の変更
