# blank-check-unplaced-feedback: 白紙設計で「答え合わせ」が押せない理由と未配置の部品名をボタンのそばに出す

## 背景・目的

実機で、白紙設計の部品を1つも置かずに「答え合わせ」を押しても画面は何も変わらなかった(部品置き場の表示は「あと7個」のまま)。
答え合わせできない理由も、何が起きたのかの説明も見つけられなかった。

コードで確認した原因: `src/presentation/blank/BlankDesignPanel.tsx` の「答え合わせ」ボタン(`data-testid="blank-review"`)は
`disabled={unplaced.length > 0}` で**無効**になっていて、押しても何も起きない。`blank-design-mode.md` では「理由は上の未配置の表示で文字で伝わる」としていたが、
その表示(`blank-unplaced`)はボタンから離れた場所にあり、ボタンとの関係を示すものがない(`aria-describedby` もない)。そのため理由が伝わっていない。

目的: ボタンが無効なとき、**なぜ押せないのか**と**どの部品が残っているのか**を、ボタンのすぐそばに文字で出す。

本当に「押せるようにして、押したときに指摘する」形が要るのか。それはしない。無効のままにして理由を常に出しておけば、押す前に分かる。
既存の E2E(`toBeDisabled()`)もそのまま使える。抽出ボタン(`MethodEditor.tsx` の `disabledReason` + `aria-describedby`)と同じ型にそろえる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/blank/BlankDesignPanel.tsx` | presentation | 未配置が1個以上のとき、ボタンの下に理由と未配置の部品名を出し、ボタンに `aria-describedby` を付ける |
| 変更 | `e2e/blank.spec.ts` | (E2E) | 理由の表示・部品名・全部配置したら消えることを確認するテストを足す |

domain / application / infrastructure は変更しない。`findUnplacedParts`(`src/domain/blank/tray.ts`)はすでに未配置の部品名を initial の並び順で返すので、そのまま使う。
CSS は既存の `.method-editor__extract-hint`(`src/index.css`、薄い色の12px)を再利用し、新しいクラスは足さない。新しい依存は足さない。

## データ・型の変更

なし。

## 動きの仕様

- 未配置の部品が1個以上あるとき:
  - 「答え合わせ」ボタンは今と同じく `disabled`。
  - ボタンのすぐ下(`stage-panel__actions` の直後)に、次の文を出す。
    `data-testid="blank-review-disabled-reason"`、`id="blank-review-disabled-reason"`、`className="method-editor__extract-hint"`。
    - 文面: `答え合わせは、部品置き場の部品をすべてクラスへ置くと押せます。まだ置いていない部品: <名前1>、<名前2>、…`
    - 部品名は `findUnplacedParts(problem.codebase, codebase)` の戻り値を、その順のまま `、` でつなぐ(数は省かない。今の問題は最大7個)。
  - ボタンに `aria-describedby="blank-review-disabled-reason"` を付ける。
- 未配置が0個のとき: この文は出さず、`aria-describedby` も付けない。ボタンは押せる(今と同じ)。
- 部品をクラスへ置く・元に戻す・クラスを削除して部品が未配置に戻ると、文面の部品名もすぐ変わる(`findUnplacedParts` を描画のたびに呼んでいる今の作りのまま)。
- `aria-live` は付けない。数の変化は今ある `blank-unplaced`(`aria-live="polite"`)が読み上げるので、二重に読ませない。
- 既存の `blank-unplaced` の表示・文面は変えない。

## TDD対象

新しい domain / application のロジックはない(未配置の判定は既存の `findUnplacedParts` で、テスト済み)。
文面の組み立ては `BlankDesignPanel.tsx` 内の数行の文字列結合にとどめ、ユニットテストは書かない。振る舞いは E2E で守る。

## 受け入れ基準

1. 白紙設計を開き、部品を1つも置かない状態で、「答え合わせ」ボタンの下に「答え合わせは、部品置き場の部品をすべてクラスへ置くと押せます。まだ置いていない部品: 」と、部品置き場にある7つの部品名が並んで表示される。ボタンは押せない。
2. 部品を1つキャンバスへドラッグして置くと、その部品名が文面から消え、残り6つの名前になる。
3. 全部品を置くと文面が消え、「答え合わせ」が押せる。押すと今と同じく `blank-result` が出る。
4. 部品を置いたクラスを削除する(または「元に戻す」)と、その部品名が文面に戻り、ボタンがまた押せなくなる。
5. 未配置があるとき、「答え合わせ」ボタンの `aria-describedby` が `blank-review-disabled-reason` を指している。全部置くと `aria-describedby` が外れる。
6. `e2e/blank.spec.ts` に上の1〜3と5を確かめるテストを足す(1は文言と部品名の数、2は置いた部品名が消えること)。
7. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- ボタンを有効にして、押したときに未配置の部品を光らせる・部品置き場へスクロールする指摘。理由の常時表示で足りるため作らない(実機で「どこにあるか分からない」と分かったら別Issue)。
- 部品置き場の中で未配置の部品を強調表示すること。
- `blank-unplaced` の文面・位置の変更、リファクタリングモードや変更依頼の実装(`change-request-finish`)の無効理由表示。
- クラス名に関する指摘や採点(クラス名はプレイヤーに考えさせない)。
