# add-file-menu-into-view: メニューから追加したファイル・クラスが画面外に出たら、見える位置へパンする

## 症状

`new-class-into-view.md` で、**余白へのドロップ**で作ったファイルの箱がキャンバスからはみ出したら、ズームを保ってパンする仕組み
(`RevealDroppedFile` + `panToReveal`)を入れた。ただし対象はドロップでの作成だけで、右クリックメニューからの追加は対象外だった。

実機(1440x900)で次のことが起きた。

- 上級3・上級6で余白を右クリックし「ファイルを追加」を3回行うと、追加したファイルが x=1090〜1316、1255〜1451、1487〜1684 に出る
  (キャンバス右端は 1392)。2つ目は途中で切れ、3つ目は完全に画面外で右端の縦レールに隠れる
- 上級6で、追加したファイルに「クラスを追加」で作った `TaskTracker` も見えない位置に出た
- 「全体を表示」で探すと倍率が 0.31 になり、メソッドが隠れる

## 原因

- メニューの「ファイルを追加」(`src/presentation/canvas/CanvasContextMenu.tsx` の `MenuGroupItems`、`item.action === 'addFile'`)は
  `api.getState().addFile()` を呼ぶだけ。store の `addFile`(`src/presentation/store/useGameStore.ts` の `basicClassActions`)は
  `void` を返すので、呼び出し側は新しいファイルのIDを知らず、`RevealDroppedFile` に渡せない
- 新しいファイルは `placeFiles` で既存ファイルの右側へ並べられる。ファイル数が増えると `FitViewOnLayoutChange` が全体合わせを試みるが、
  倍率に詳細表示の床(`DETAIL_ZOOM`)があるため、横に並んだ新しいファイルは入りきらない
- メニューの「クラスを追加」(`useFormConfig` の `fileFormConfig`)も同じく、追加後に何もパンしない
- `RevealDroppedFile` は `node.position` で画面座標を求めているため、ファイル(親を持たないノード)にしか使えない。
  クラスノードは `parentId` を持ち `position` が親からの相対座標なので、そのままではずれる

呼び出し元は grep で確認済み: store の `addFile` を呼ぶのは `CanvasContextMenu.tsx` の1か所、`addClass` は同ファイルの `useFormConfig` と
`useGameStore.test.ts` だけ。`RevealDroppedFile` を使うのは `CanvasFlow` の1か所。

## 修正

既存の `RevealDroppedFile` と `panToReveal` を再利用し、表示させたいノードIDを渡す口をメニューにも開ける。新しい純粋関数は作らない
(パンの量の計算は `panToReveal` がそのまま使える。箱の矩形の求め方だけを、親子ノードでも正しくなるよう直す)。

1. **store**(`src/presentation/store/useGameStore.ts`、presentation)
   - `addFile: () => string | null` に変える。IDを先に `crypto.randomUUID()` で作って `addNewFileUseCase` に渡し、
     `apply` が `true` ならそのID、`false`(冒頭の修正中でブロックされたとき)なら `null` を返す
   - `addClass` の型(`boolean`)は変えない
2. **reveal の一般化**(`src/presentation/canvas/CodebaseCanvas.tsx`、presentation)
   - `RevealDroppedFile` を `RevealNewNode`(prop `nodeId`)に改名し、ファイルノードでもクラスノードでも使えるようにする。
     箱の左上は `node.position` ではなく `getInternalNode(nodeId)?.internals.positionAbsolute` から求める
     (ファイルノードでは今までと同じ値になる)。計測待ち・50ms待ち・`panToReveal`・`revealDuration` の流れはそのまま
   - `CodebaseCanvas` の `revealFileId` / `setRevealFileId` を `revealNodeId` / `setRevealNodeId` に改名する
     (`useDropHandler` の `callbacks.setRevealFileId` も同様)。ドロップでの振る舞いは変えない
   - `CanvasContextMenu` に `onReveal={setRevealNodeId}` を渡す
3. **メニュー**(`src/presentation/canvas/CanvasContextMenu.tsx`、presentation)
   - `CanvasContextMenu` の props に `onReveal: (nodeId: string) => void` を足し、`MenuItems`(`MenuItemsProps`)と `MenuForm` へ渡す
   - 「ファイルを追加」: `const fileId = api.getState().addFile(); if (fileId !== null) onReveal(fileId);`
   - 「クラスを追加」: `submit` が成功したら、追加先ファイル(`file.id`)の中から入力した名前のクラスを最新の codebase で探し、
     見つかればそのクラスIDで `onReveal` を呼ぶ。クラス単位で見せるので、背の高いファイルの下端に追加されても新しいクラスが見える

FitViewOnLayoutChange(ファイル数が変わったときの全体合わせ)とは、次の順になる: 全体合わせは計測が済んだ effect で即時に
`setViewport` する → `RevealNewNode` は計測完了後さらに50ms待ってから `getViewport()` を読むので、合わせた後の倍率・位置から
はみ出し量を計算する。ズームは変えない(全体合わせが決めた倍率のまま)。この順で足りることを E2E で確かめる。

本当に新しい仕組み(store にノードIDを持たせる、メニュー専用の reveal を作る等)が要るか: 要らない。メニューは `CodebaseCanvas` の中で
描かれているので、既存の state の setter を props で渡せば足りる。

## テスト

先に書いて失敗を確かめる。

- Vitest(`src/presentation/store/useGameStore.test.ts`)
  - `addFile()` が文字列を返し、そのIDのファイルが `codebase.files` にある(現状は `undefined` が返るので失敗する)
  - 冒頭の修正中でブロックされる状態では `addFile()` が `null` を返し、ファイルが増えない
- `panToReveal.test.ts` は変更なし(計算は変えない)
- E2E(新規 `e2e/add-file-menu-into-view.spec.ts`、1440x900)
  1. 上級3を `selectStage` で開き、余白を右クリック→「ファイルを追加」を3回行う。3回目の後、`file-src/NewFile3.ts` の箱全体が
     `.app__canvas` の矩形の内側(各辺 23px 以上の余白)に収まっている(`expect.poll` で待つ)。倍率は3回目の追加直前と変わらない
     (全体合わせが走らない回もあるため、比べるのは「3回目の追加直前」と「その後」)
  2. 上級6を開き、「ファイルを追加」→ その新しいファイルを右クリック→「クラスを追加」で `TaskTracker` を作る。
     `class-header-TaskTracker` がキャンバスの矩形の内側に見えている
  3. 既存の `e2e/new-class-into-view.spec.ts` と `e2e/refactor.spec.ts` のメニュー追加系テストがそのまま通る

## 受け入れ基準

1. 1440x900 の上級3で「ファイルを追加」を3回行うと、3つ目のファイル全体がキャンバス内に見える(右端の縦レールに隠れない)
2. 上級6でメニューから追加したファイル・`TaskTracker` クラスが、追加した直後にキャンバス内に見える
3. 追加の前後でズーム倍率をこの機能が変えない(パンだけ)。`prefers-reduced-motion: reduce` ではパンが即時
4. 余白へのドロップで作ったクラス・ファイルの振る舞い(`new-class-into-view.md`)は変わらない
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 新しいファイルの配置位置(`placeFiles` が右へ並べること)そのものの見直し。右クリックした位置に置くことも含めてやらない
- 「全体を表示」や全体合わせの倍率の床(`DETAIL_ZOOM`)の見直し
- パンしたことで既存のファイルが画面外へ出ることへの対処
- メニュー以外の追加経路(模範解答のプレビュー、変更依頼の部品置き場など)での reveal
- 「クラスを新しいファイルへ移す」メニュー(`moveClassToNewFile`)の reveal。今回の再現手順に含まれないため。必要になったら同じ `onReveal` を呼ぶだけで足せる
