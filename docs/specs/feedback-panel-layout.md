# feedback-panel-layout: AI講評を出すと、キャンバスと左パネルが押し下げられる

## 症状

2026-11-03 に実機(チュートリアル2、画面1440x900相当)で確認した。

1. ヘッダーの「AIの講評をもらう」を押す
2. 講評パネルがヘッダーの直下に差し込まれる(取得に失敗したときは赤い「AI講評を取得できませんでした。しばらくしてからもう一度お試しください」と、「簡易講評(AI講評ではありません)」の長文)
3. 左パネル(課題サイドバー)・ツールバー・キャンバス・メソッドエディタ全体が下に押し下げられ、講評が画面の高さの約1/3を占める。操作中の図が縮む
4. 閉じる手段がなく、`<details>` の「▼ 簡易講評」を畳むことしかできない

講評を読みながら図を見て直す、という使い方ができない。

## 原因

- `src/presentation/stage/StagePanel.tsx` の `StagePanelContent` が、`<StageHeader />` と `<div className="app__body ...">` の間(`.app` の縦並びflexの中)に `<CritiqueResult />` を差し込んでいる(434行目)。
  `.app` は `display: flex; flex-direction: column; height: 100vh`、`.app__body` は `flex: 1; min-height: 0` なので、講評の高さの分だけ `.app__body`(キャンバスを含む)が縮む。
- `.critique-panel`(`src/index.css` 449行目)には高さの上限もスクロールもなく、長い簡易講評がそのまま高さになる。
- 講評の状態(`critique`)を空に戻す操作がストアにない(`critiqueActions` は `requestCritique` だけ)ので、閉じるボタンを付けられない。

`CritiqueResult` の呼び出し元は `StagePanel.tsx` の1か所だけ(grep済み)。直す場所はこの1か所とCSS・ストアで済む。

## 修正

方針: **講評パネルをキャンバスの上に重ねる(`position: absolute`)閉じられるパネルにする**。レイアウトの流れから外すので、出しても消してもキャンバス・左パネルの大きさは変わらない。

検討して採らなかった案(一言):
- 左の課題サイドバーの中に入れる: サイドバーを閉じていると見えず(狭い画面では最初から閉じている)、元の「サイドバーを閉じていても見えるように」という意図を壊す。
- 右側に新しい開閉パネルを足す: 右にはすでにメソッドエディタ(リサイズ・レール表示つき)があり、パネルを増やすと幅の取り合いと開閉状態の管理が増える。重ねるだけで足りる。
- React Flow の `<Panel>` に入れる: top-left / top-center / top-right はすでに使用中(縮小中の案内・操作の結果・整列ボタン)。また `<Panel>` は React Flow の中なので、長文をホイールでスクロールするとキャンバスがズームしてしまう(`nowheel` の考慮が要る)。キャンバスの兄弟要素として置けば不要。

### 1. 表示位置を移す(presentation)

- `src/presentation/stage/StagePanel.tsx`: `StagePanelContent` から `<CritiqueResult />` と、その import(`CritiqueResult` のみ。`CritiqueButton` は残す)を削除する。
- `src/presentation/App.tsx`: `RefactorView` の `<section className="app__canvas">` の中、`ErrorToast` を包む `div` の後ろに `<CritiqueResult />` を置く。
  - `inert` の `div` では包まない(変更依頼の結果確認中 `reviewing` でも、講評を読む・閉じることはできてよい)。狭い画面でメソッドエディタのドロワーや課題サイドバーを開いたときは、それぞれのバックドロップ/`.workspace` の `inert` の下に入るので追加の処理は要らない。
- `src/presentation/critique/CritiquePanel.tsx` の `CritiqueResult` の JSDoc を「キャンバスの右上に重ねて出す。レイアウトを押し下げない」に直す。

### 2. 閉じるボタンを付ける(presentation)

- `CritiqueResult` のルート `div` の先頭に、見出し行を置く: `<div className="critique-panel__header">` の中に `<h2 className="critique-panel__title">AIの講評</h2>` と閉じるボタン。
  - 閉じるボタン: `<button type="button" className="critique-panel__close" aria-label="講評を閉じる" onClick={dismissCritique}>×</button>`(`OperationResult` の閉じるボタンと同じ書き方)
- ルート `div` に `role="region"` と `aria-label="AIの講評"`、`data-testid="critique-panel"` を付ける。
- 既存の `role="status"`(エラー文)・`<details>`・`data-testid`(`critique-text` / `critique-fallback-text`)はそのまま残す(既存のE2Eが参照している)。

### 3. ストアに `dismissCritique` を足す(presentation/store)

- `src/presentation/store/useGameStore.ts`
  - `GameState` に `dismissCritique: () => void;` を追加(`requestCritique` の隣)。
  - `critiqueActions` の戻り値の型を `Pick<GameState, 'requestCritique' | 'dismissCritique'>` にし、`dismissCritique: () => set({ critique: EMPTY_CRITIQUE })` を足す。
  - 取得中(`loading: true`)はパネル自体が出ていない(`CritiqueResult` は `error`/`text`/`fallback` がすべて `null` なら `null` を返す)ので、取得中に閉じる経路はない。取得中の通信の取り消しは扱わない。

### 4. CSS(`src/index.css` 449〜453行目付近)

`.critique-panel` を次のように変える(数値は目安。`.error-toast` / `.operation-result` の見た目に揃える):

```css
.critique-panel {
  position: absolute; z-index: 5; top: 48px; right: 12px;
  display: flex; flex-direction: column;
  width: min(420px, calc(100% - 24px)); max-height: 45%;
  padding: 8px 12px; border-left: 5px solid var(--accent); border-radius: 8px;
  background: var(--surface); box-shadow: 0 3px 14px rgb(0 0 0 / 20%); color: var(--text);
  font-size: 13px; overflow-y: auto; overscroll-behavior: contain;
}
.critique-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.critique-panel__title { margin: 0; font-size: 14px; }
.critique-panel__close { flex: none; padding: 0 4px; border: 0; background: transparent; color: var(--text); font-size: 20px; line-height: 1; cursor: pointer; }
.critique-panel__close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- `top: 48px` は右上の「整列」ボタン(React Flow の `Panel position="top-right"`)の下に出すため。左下の Controls・下中央の ErrorToast とは重ならない。
- `max-height: 45%` とスクロールで、長い簡易講評でも図の半分以上は見えたままにする。
- 既存の `border-bottom` は削除する(重ねる表示では不要)。

層: すべて presentation(コンポーネント・ストア・CSS)。domain/application の変更はない。

## テスト

先に書いて失敗させる:

- Vitest(`src/presentation/store/useGameStore.test.ts`): 「`dismissCritique` で講評の表示状態が空に戻る」
  - Arrange: ストアの `critique` を `{ text: null, loading: false, error: 'エラー文', fallback: '簡易講評' }` にする(`setState`)
  - Act: `dismissCritique()`
  - Assert: `critique` が `{ text: null, loading: false, error: null, fallback: null }`
- E2E(`e2e/critique.spec.ts` に追加): 「講評を出してもキャンバスの高さは変わらず、閉じるボタンで消せる」
  - Arrange: `page.setViewportSize({ width: 1440, height: 900 })`、`CRITIQUE_ENDPOINT` を 500 で返す(長い簡易講評が出る失敗ケース)、`page.goto('/')`
  - `page.locator('.app__canvas').first()` の `boundingBox()` の `height` と `y` を記録する(リファクタリング画面の `.app__canvas`)
  - Act: 「AIの講評をもらう」を押し、`getByTestId('critique-fallback-text')` が見えるのを待つ
  - Assert: `.app__canvas` の `height` と `y` が押す前と同じ(差が1px以内)
  - Act: `getByRole('button', { name: '講評を閉じる' })` を押す
  - Assert: `getByTestId('critique-panel')` が0件、`.app__canvas` の高さも変わらない
  - 続けて「AIの講評をもらう」をもう一度押すと、再びパネルが出る

既存の `e2e/critique.spec.ts` のテスト(`.critique-panel__error`・`.critique-panel__details summary`・`critique-text`・`critique-fallback-text` の参照)は変更なしで通ること。

## 受け入れ基準

1. 1440x900 でチュートリアル2を開き「AIの講評をもらう」を押しても(成功・失敗どちらでも)、左パネル・ツールバー・キャンバス・メソッドエディタの位置と高さが変わらない。講評はキャンバスの右上に重なって出る。
2. 長い簡易講評はパネルの中でスクロールでき、パネルの上でホイールを回してもキャンバスはズームしない。
3. 「×」(`aria-label="講評を閉じる"`)をクリック、またはTabで移動してEnter/Spaceで押すと講評が消える。もう一度「AIの講評をもらう」を押せば再び出る。
4. 追加した Vitest と E2E が先に失敗し、修正後に通る。
5. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 講評パネルのドラッグ移動・リサイズ・最小化(畳む)ボタン。閉じて再取得で足りる。要望が出たら足す。
- Escキーで閉じる。ほかの重ねる表示(操作の結果・ErrorToast)もEscでは閉じていないので揃える。
- 講評の内容・簡易講評の文面・取得処理(`requestCritique`・`CritiqueUseCases`)の変更。
- コードベースを編集したら古い講評を自動で消す(`critiqueActions` の既存の ponytail コメントのとおり)。
- 設計くらべ・白紙設計モードへの講評表示の追加。
- `DraftRestoredNotice` など、ほかの「差し込んで押し下げる」通知の見直し。
