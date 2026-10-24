# toast-clears-when-stale: 役目を終えた通知トーストを消す

## 背景・目的

画面の下に出る通知(`ErrorToast`。失敗の理由 `message` と、お知らせ `notice`)は、プレイヤーが×を押すまで消えない。実機で次のことが起きた。

- 初級2で手直しの前にメソッドをドラッグすると、「まず「もし、この変更が来たら?」で、この変更を手で入れてみてください」と出る。
  そのとおりに「実際に直してみる」を押し、メソッドに「直した」印を付けてリリースしても、**同じ警告が8秒以上たっても、リリースしても残ったまま**だった
- 通知は図の下端(ズームボタンやクラスの箱の下側)に重なる。指示に従ったあとも、赤い警告が出続けるので「まだ間違っている」ように見える
- 「抽出すると、新しいメソッドの宣言と呼び出しの分だけ…」のようなお知らせ(`notice`)も、×を押すまで残る

失敗の理由は、**状況が変わったら役目を終える**。お知らせは**一定時間で自動で消える**ようにする。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | 状況が変わったとき `message` を消す。`notice` を表示から一定時間後に消すための仕組み |
| 変更 | `src/presentation/canvas/ErrorToast.tsx` | presentation | `notice` の自動消去(時間は下の定数) |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 状況が変わると `message` が消えること |
| 新規 | `e2e/toast-clears-when-stale.spec.ts` | E2E | 受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。

## 動きの仕様

### 失敗の理由(`message`、`role="alert"`)

次のいずれかが起きたら、`message` を `null` にする(`autosaveDrafts` と同じく、ストアの `subscribe` で、前の状態と比べて消す)。

- 採点の対象のコード(`codebase`)が変わった(操作が成功した、元に戻す・やり直した)
- 選んでいるメソッド・フィールド(`selectedMethodId` / `selectedFieldId`)が変わった
- 手直し(`manualFix`)や変更依頼(`changeSession`)が始まった・終わった(null かどうかが変わった)
- ステージを切り替えた(今も消える。変えない)

メッセージが出た**そのときの操作**(失敗した操作自身)では消えない。つまり、メッセージを出すのと同じ `set` の中で `selectedMethodId` などが変わっても、そのメッセージは残る(出した直後に消えない)。

### お知らせ(`notice`、`role="status"`)

- 表示から8秒で自動で消える(定数 `NOTICE_VISIBLE_MS = 8000`)。新しい `notice` に置き換わったら、数え直す
- ×でも、今までどおり閉じられる
- `message` が出ている間は `message` が優先して出る今の動きのまま。`message` のトーストは時間では消さない(読み切る前に消えないため)

### 読み上げ

- `role="alert"` / `role="status"` は今のまま。消えるときに追加の読み上げはしない

## TDD対象

### ストア(`useGameStore.test.ts`)

- `message` が出たあと、`codebase` が変わると `message` は `null` になる
- `message` が出たあと、`selectedMethodId` が変わると `message` は `null` になる
- `manualFix` が始まると `message` は `null` になる
- `message` を出した操作自身では、`message` は残る(出した直後に消えない)
- `notice` は、状況が変わっても(ステージ切替を除いて)この仕様では消さない(時間で消える)

`notice` の自動消去は、フェイクタイマー(`vi.useFakeTimers`)で、8秒後に `dismissMessage` 相当が呼ばれることを確かめる(`ErrorToast` はコンポーネントのため、時間の定数だけを取り出した純粋な単位があればそれをテストし、無理にコンポーネントのテストは書かない)。

## 受け入れ基準

1. 初級2で手直しの前にメソッドをドラッグして警告が出たあと、「実際に直してみる」を押す(またはメソッドをクリックする)と、警告が消える
2. 抽出に成功してお知らせが出たあと、8秒たつとお知らせが消える。×を押せば、すぐ消える
3. 警告が出た直後は、警告が見えている(出した操作自身で消えない)
4. 変更依頼・手直しの既存の E2E が通る(トーストの出方に頼っていた期待があれば合わせる)
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- トーストの見た目・位置(キャンバス下端に重なることの解消)
- `message` を時間で自動で消すこと(読み切れない人がいるため、状況の変化でだけ消す)
- AI講評のエラー表示(`critique-panel__error`)
