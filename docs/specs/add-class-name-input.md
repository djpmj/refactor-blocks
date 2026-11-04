# add-class-name-input: 「クラスを追加」の名前入力欄が、入れた名前を黙って捨てる

## 症状

中級4・5など、右クリックメニューに「クラスを追加」が出るすべてのステージで起きる。

1. メソッド(またはクラス・ファイル)を右クリックし、「このファイル」の「クラスを追加」を選ぶ
2. 「追加するクラス名」(プレースホルダー「クラス名」)の入力欄が出る
3. `TaxCalculator` 以外の名前(例: `OrderValidator`)を入れて「追加」を押す
4. 追加されたクラスの名前は `NewClass`。中身が入ると責務から自動で名前が付け直される(`auto-class-naming`)。入れた名前はどこにも残らない
5. すでにあるクラス名(例: 注文ステージの `TaxCalculator`)を入れたときだけ「同じ名前のクラスがすでにあります」と出て追加できない。どうせ捨てる名前に対してエラーを出している

入力欄が嘘になっている。このプロジェクトはプレイヤーにクラス名を考えさせない(`auto-class-naming.md` の「ユーザー決定」)ので、入力欄を残して反映する案は採らない。

## 原因

- `src/application/RefactorUseCases.ts` の `addClassUseCase` は、受け取った `className` を初めの名前にして `autoNamed: true` のクラスを作る
- `src/presentation/store/useGameStore.ts` は、コードベースを変える操作のたびに `autoNameClasses(codebase, stage.classNames)` を通す。`autoNamed` のクラスは中身の責務から名前が付け直され、空のクラスは `NewClass`(重なれば `NewClass2` …)になる。そのため、入れた名前はすぐ上書きされる
- 一方、`addClassUseCase` が呼ぶ domain の `addClass` は `validateClassName` で、入れた名前の空欄・重複を弾く。名前は捨てるのに検証だけ残っている
- 入力欄は `src/presentation/canvas/CanvasContextMenu.tsx` の `useFormConfig`(`mode === 'class'`)で、メニュー項目は `src/presentation/canvas/contextMenuGroups.ts` の `{ kind: 'form', mode: 'class', label: 'クラスを追加' }`

`addClassUseCase` を呼んでいるのは `useGameStore.ts` の `addClass` だけ。store の `addClass` を呼んでいるのは `CanvasContextMenu.tsx` だけ(grep で確認済み)。domain の `addClass` は模範解答の手順(`sampleAnswer.ts` の `addClass` ステップ、名前を指定して作る)と `moveToNewHome.ts` でも使っているので、**domain の `addClass` は変えない**。

## 修正

「クラスを追加」を、名前を聞かずにすぐクラスを作る操作にする。余白へのドロップ(`moveMethodToNewClass`)と同じく、初めの名前は `NewClass`(重なれば連番)にし、あとは `autoNameClasses` に任せる。

### application: `addClassUseCase` から名前の引数を外す

```ts
/** プレイヤーの「クラスを追加」操作。名前は聞かず NewClass(重なれば連番)で作り、中身が入ったら autoNameClasses が付け直す。 */
export function addClassUseCase(codebase: Codebase, fileId: string, generateId: IdGenerator): Result<Codebase, AddClassError>
```

- 初めの名前は `uniqueName('NewClass', (name) => allClasses(codebase).some((codeClass) => codeClass.name === name))`(`moveToNewHome.ts` と同じ書き方。既存の `uniqueName` を再利用する)
- そのうえで domain の `addClass(codebase, fileId, name, { id: generateId(), autoNamed: true })` を呼ぶ
- 名前は重ならないので、実際に起きる失敗は `file-not-found` だけになる。戻り値の型は domain の `AddClassError` のまま変えない(`describeAddClassError` もそのまま。domain の `addClass` を名前つきで使う経路が残るため)

### presentation: store と右クリックメニュー

- `useGameStore.ts`: `addClass: (fileId: string) => boolean` にし、`addClassUseCase(get().codebase, fileId, () => crypto.randomUUID())` を呼ぶ
- `contextMenuGroups.ts`: 「クラスを追加」を `{ kind: 'action', action: 'addClass', label: 'クラスを追加' }` にする。`MenuItem` の `form` の `mode` は `'renameClass'` だけ、`action` に `'addClass'` を足す
- `CanvasContextMenu.tsx`:
  - `MenuGroupItems` の action の分岐に `if (item.action === 'addClass' && target.fileId !== null) api.getState().addClass(target.fileId);` を足す(ほかの action と同じく、そのあと `onClose()`)
  - `Mode` を `'menu' | 'renameClass'` にし、`useFormConfig` の `fileFormConfig`(「追加するクラス名」の入力欄)を消す
  - `CanvasContextMenu` の doc コメント(「クラス・ファイルの追加と名前の変更を、その場で名前を入れて行う」)を今の動きに合わせる
- `NameForm` は「名前を変更」で使い続けるので残す

## テスト

### Vitest(先に書いて Red にする)

`src/application/RefactorUseCases.test.ts` の `addClassUseCase`:

- 既存の「注入されたIDで新しいクラスを作る」を書き換える: `addClassUseCase(codebase, 'file-tax', () => 'generated-class')` で、`{ id: 'generated-class', name: 'NewClass', methods: [], autoNamed: true }` が `file-tax` の末尾に入る
- `NewClass` がすでにあるコードベースでは `NewClass2` になり、エラーにならない(重複エラーが出ないことの確認)
- 存在しないファイルIDでは `file-not-found` のエラーになる
- 元の Codebase を変更しない

`src/presentation/store/useGameStore.test.ts`: `addClass(fileId, 'TemporaryEmpty')` などの呼び出し(3か所)を `addClass(fileId)` に直す。期待は変えない。

`src/domain/codebase/addClass.test.ts` は変えない(domain の `addClass` は変えないため)。

### E2E

- `e2e/refactor.spec.ts`
  - 「同じ名前のクラスは追加できず、理由が表示される」は前提がなくなるので、次のテストに置き換える:
    「クラスを追加は名前を聞かずにすぐ追加し、2回目は NewClass2 になる」— 注文ステージで `placeOrder` を右クリック →「クラスを追加」を2回。入力欄(`getByLabel('追加するクラス名')`)が出ないこと、`class-NewClass` と `class-NewClass2` が見えること、メニューが閉じること、エラー(`role="alert"`)が出ないこと
  - 「メソッドを右クリックしてメニューから、そのクラスのファイルにクラスを追加できる」は、入力欄の操作を消し、「クラスを追加」をクリックするだけにする(期待はそのまま)
  - ヘルパー `addClassFromMenu(page, methodName, className)` は `className` 引数を消し、「クラスを追加」をクリックするだけにする。呼び出し元(上級3の3クラス作成など)の期待名 `NewClass`・`NewClass2`・`NewClass3` は今のまま
  - 中級8(Address)のテストの入力欄の操作を消す
- 入力欄に名前を入れている残りの E2E(`change-pain.spec.ts`・`pain-request-alignment.spec.ts`・`score-floor-progress.spec.ts`・`success-feedback.spec.ts`・`visibility-violation-edge.spec.ts`)から、`getByLabel('追加するクラス名')` の `fill`/`press` と「追加」ボタンのクリックを消す。どれも追加後は `NewClass` やクラスの中身でクラスを指しているので、ほかの期待は変えずに済むはず

## 受け入れ基準

1. 中級4・5などで、メソッドを右クリック →「クラスを追加」を選ぶと、名前の入力欄は出ず、すぐにそのファイルへ `NewClass`(すでにあれば `NewClass2` …)が追加され、メニューが閉じる
2. 追加したクラスへメソッドを移すと、`auto-class-naming` の規則どおり責務から名前が付く(今の動きのまま)
3. 「クラスを追加」で「同じ名前のクラスがすでにあります」のエラーが出ることはない
4. 「名前を変更」の入力欄と、その重複エラーは今どおり動く
5. 元に戻す(Ctrl+Z)で追加したクラスが消える(今の履歴の仕組みのまま)
6. キーボードだけで「クラスを追加」を選べる(メニュー項目は今どおり `role="menuitem"` のボタン)
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- domain の `addClass`・`validateClassName` の変更(模範解答の `addClass` 手順と「名前を変更」が使うため残す)
- `describeAddClassError` の文言や `AddClassError` 型の整理(実際には出なくなる `empty-class-name`・`duplicate-class-name` も型には残る。本当に要るか: 模範解答の経路で domain が返すので型は要る。プレイヤー向けのメッセージ表は使われなくなるが、消すと型を分ける必要が出るので今回は触らない)
- 追加したクラスの見出しへフォーカスを移すこと(今の入力欄経由の追加もフォーカスを移していない。要望が出たら `moveClassToNewFile` と同じやり方で足す)
- 「ファイルを追加」の動き(もともと名前を聞かずに `NewFile.ts` を作っている)
- 名前を選ばせる・候補を出すUI(プレイヤーに命名させない方針のため作らない)
