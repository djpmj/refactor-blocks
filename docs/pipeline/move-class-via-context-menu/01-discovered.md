# 機能探索: 右クリックメニューから移動先のファイルを選んでクラスを移す

- slug: `move-class-via-context-menu`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

直前のパイプライン `docs/pipeline/move-via-context-menu/01-discovered.md` の「スコープの見立て」で、
2段目として明示的に後回しにされていたもの:

> 2. 後回し: クラスを別ファイルへ移す(`moveClass`)を同じ形でメニュー化する

あわせて `docs/specs/blank-design-mode.md` のスコープ外にも、次のとおり先送りの記載がある:

> キャンバス操作(ドラッグ・右クリックメニュー)のキーボード対応の拡充。既存のリファクタリングと同じ水準のまま(別タスクで両モードまとめて直す)

### 他の候補と見送った理由(参考)

- 新しいステージの題材: Template Method は `template-method-stage` がパイプライン進行中(`03-confirmed-answers.md` 未作成)。
  ほかに先送りされている題材(Middle Man の減点 = `lone-superclass-scoring.md`、データクラスの減点 =
  `cohesion-value-object-anemic.md`)は、どちらも新しい採点ルールから設計する必要があり1回のPRより大きい。
  また上級ステージの追加が `template-method-stage` と同時期に `advancedStages.ts` を触ると衝突しやすい。
- CLAUDE.md の「予定: VSCodeのエクスプローラー風ファイルツリー」: 未着手だが、新しいペイン・dnd-kitの新しいドロップ先・
  E2Eを伴い1回のPRには大きい。今回の「移動先をリストから選ぶ」部品が揃うと、ツリーのキーボード操作の設計も楽になる。
- `move-via-context-menu` の評価(`06-evaluation.md`)の suggestion(外側クリック時のフォーカス復帰など):
  小さな手直しで、今回の仕様で同じ部品を触るときに合わせて扱うかを仕様設計者が判断すればよい(下記の論点)。

## 背景・目的

- `move-via-context-menu` で、メソッド・フィールドはキーボードだけ(Shift+F10 → Tab/Enter)で別クラスへ移せるようになった。
  しかし**クラスを別ファイルへ移す操作(Move Class)は、依然としてクラスのヘッダーを dnd-kit でドラッグするしかない**。
  キーボードでは `KeyboardSensor` で運ぶことになり、ズーム・パンの状態次第で目的のファイルまで届かない、
  スクリーンリーダーから移動先の候補が分からない、という前回と同じ穴が残っている。
- CLAUDE.md の ponytail の「手を抜かないもの」にアクセシビリティ(キーボード操作を含む)が明記されており、
  主要なリファクタリング操作のうちクラスの移動だけが取り残されている状態。
- Move Class は模範解答でも使われている操作(`src/domain/stage/sampleAnswer.ts` の中級2「何でも入った services.ts」で
  `ShippingService` / `PointService` を新しいファイルへ移す)。「ファイル分け」はこのゲームの3本柱
  (メソッド分け・クラス分け・ファイル分け)の1つなので、どの入力手段でも確実にできる必要がある。
- 右クリックメニューには既に「別のクラスへ移動」(`MoveMenuItem`)、「継承元を設定」「実装するインターフェースを設定」という
  候補を並べるサブメニューがあり、同じ部品で「移動先のファイル」を並べられる見込みが高い。ドメインの `moveClass`
  (`Result` で `same-file` などを返す)とストアの `moveClass`(`apply` 経由で Undo 可能)も既にあり、
  新しいドメイン操作は要らない見込み。

## 関連する既存コード

- `docs/pipeline/move-via-context-menu/`(01〜06)と `docs/specs/move-via-context-menu.md` — 直前の同種機能の仕様・評価。
  今回はこの形をクラス→ファイルに広げる
- `src/presentation/canvas/CanvasContextMenu.tsx` — `menuItemsFor`(クラスのヘッダーを右クリックしたときの項目)、
  `MoveMenuItem` / `SubmenuTrigger`(候補サブメニューの前例)
- `src/presentation/canvas/useCanvasContextMenu.ts` — `ContextMenuTarget`(`fileId` / `classId` / `member` / `returnFocus`)
- `src/presentation/canvas/ClassNode.tsx` — ヘッダーが dnd-kit のドラッグ元(`aria-label="<クラス名> を別ファイルへ移動"`、`nodrag nopan`)
- `src/presentation/canvas/CodebaseCanvas.tsx` — ドロップ時に `moveClass` / `moveClassToNewFile` を呼ぶ処理
- `src/presentation/store/useGameStore.ts` — `moveClass(classId, targetFileId)` / `moveClassToNewFile(classId)`
- `src/domain/codebase/moveClass.ts` — `MoveClassError = 'class-not-found' | 'file-not-found' | 'same-file'`(変更不要の見込み)
- `src/domain/codebase/moveMethod.ts` / `moveField.ts` — `targetError` を移動本体と候補一覧(`moveMethodTargets` / `moveFieldTargets`)で
  共有している前例。クラスでも同じ形にするかは仕様設計者が決める
- `src/domain/stage/sampleAnswer.ts` — 模範解答の `moveClass` ステップ(中級2)
- `e2e/refactor.spec.ts` — 既存の「移動メニュー」E2E、クラスのヘッダーの右クリックE2E、`dragToEmptyCanvas` を使ったクラス移動E2E

## スコープの見立て

- 1回のPRで完結する規模と見ている。主な作業は presentation 層(クラスのヘッダーを右クリックしたときに
  「別のファイルへ移動」サブメニューを足す)と、E2Eテストの追加。domain 層は、候補一覧を純粋関数にするなら
  その分のユニットテストが付く程度。application 層・ストアは既存の呼び出しで足りる見込み。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - 候補の並べ方(ファイルのパス順か、宣言順か)と、「新しいファイルへ移動」(`moveClassToNewFile`)も候補に入れるか
    (前回のメソッド移動では「新しいクラスへ移動」を候補に入れなかった)
  - メソッド/フィールドのチップを右クリックしたときにも「別のファイルへ移動」(そのチップを持つクラスを移す)を出すか、
    クラスのヘッダーを右クリックしたときだけにするか
  - クラスのヘッダーにキーボードでフォーカスして Shift+F10 で開けるか(ヘッダーは dnd-kit の `attributes` でフォーカス可能になっているはずだが、
    メニューが「クラスの項目」として開くことを確認する必要がある)
  - 白紙設計モード(`BlankDesignView`)でも同じメニューが出るか・出すべきか
  - `move-via-context-menu` の評価で出た suggestion(外側クリック時のフォーカス復帰を条件付きにする、`MoveMenuItem` の props 型名など)を、
    同じ部品を触る今回に含めるか
- 大きくなりそうなら次のように割る:
  1. 今回: クラスのヘッダーの右クリック(+Shift+F10)メニューから、既存のファイルへクラスを移す
  2. 後回し: 「新しいファイルへ移動」の候補化、`06-evaluation.md` の suggestion の手直し
