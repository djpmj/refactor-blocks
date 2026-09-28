# 機能探索: 右クリックメニューから移動先のファイルを選んでクラスを移す

- slug: `move-class-via-context-menu`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

実装済みの機能 `move-via-context-menu` の探索結果(`docs/pipeline/move-via-context-menu/01-discovered.md`)で、
分割案の2つ目として先送りされていたもの:

> 2. 後回し: クラスを別ファイルへ移す(`moveClass`)を同じ形でメニュー化する

`docs/specs/move-via-context-menu.md` の「6. スコープ外」にも同じ記述がある:

> - クラスを別ファイルへ移す(`moveClass`)のメニュー化(01-discovered.md の分割案どおり後回し)

## 背景・目的

- `move-via-context-menu` で、メソッド・フィールドは右クリック(+キーボード)メニューの「別のクラスへ移動」から
  移せるようになった。一方、クラスを別ファイルへ移す操作(ファイル分け)は、今もクラスノードのヘッダーを
  dnd-kitでドラッグするしか手段が無い。
- このゲームの3本柱は「メソッド分け・クラス分け・ファイル分け」で、ファイル分けは中級2(何でも入った `services.ts`)など
  の模範解答に出てくる主要操作。そこだけマウスのドラッグ頼みで、キーボード・スクリーンリーダーから
  移動先ファイルの候補が分からない状態が残っている。CLAUDE.md の ponytail 方針で「手を抜かないもの」に
  アクセシビリティ(キーボード操作を含む)が明記されており、前回の機能と同じ理由で穴になっている。
- クラスのヘッダーはズームアウト時にも見えるが、ファイルの箱(親ノード)同士が離れていると、ドラッグで運ぶより
  リストから選ぶほうが速く確実。
- 前回作った `SubmenuTrigger` / `MoveMenuItem` の形をそのまま使える見込みが高く、ドメイン操作 `moveClass`
  (ストアの `apply` 経由で Undo 可能)も既にあるので、新規ロジックは小さい。

## 関連する既存コード

- `docs/specs/move-via-context-menu.md` — メソッド・フィールドのメニュー移動の確定仕様(形をそろえる前例)
- `docs/pipeline/move-via-context-menu/06-evaluation.md` — 前回の評価(残課題の確認用)
- `src/presentation/canvas/CanvasContextMenu.tsx` — `menuItemsFor`(項目の組み立て)、`MoveMenuItem`・`ExtendsMenuItem`(サブメニューの前例)
- `src/presentation/canvas/useCanvasContextMenu.ts` — `ContextMenuTarget`(`classId` / `fileId` / `member`)
- `src/presentation/canvas/ClassNode.tsx` — クラスヘッダー(`aria-label="… を別ファイルへ移動"` のドラッグハンドル)
- `src/presentation/canvas/CodebaseCanvas.tsx` — `useDropHandler`(ドロップで `moveClass` / `moveClassToNewFile` を呼ぶ)
- `src/presentation/store/useGameStore.ts` — `moveClass` / `moveClassToNewFile`
- `src/domain/codebase/moveClass.ts` — `moveClass`(エラー `same-file` など)。メソッド側の `moveMethodTargets` /
  フィールド側の `moveFieldTargets` にあたる「移動先候補」の関数はまだ無い
- `src/domain/codebase/moveToNewHome.ts` — `moveClassToNewFile`(新しいファイルへ移す)
- `e2e/refactor.spec.ts` — 「別のクラスへ移動」のE2E(1460行付近〜)。同じ形でクラスの移動を追加する

## スコープの見立て

- 1回のPRで完結する規模と見ている。主な作業は presentation 層(クラスを右クリックしたときの項目の追加)と
  E2Eテストの追加。移動先候補の絞り込みを `moveMethodTargets` と同じく domain の純粋関数にするなら、
  その分のユニットテスト(TDD)が付く程度。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - 項目名と出す条件(クラスのヘッダーを右クリックしたときだけか、メソッド・フィールド上でも出すか。
    メソッド上では「別のクラスへ移動」と並んで紛らわしくならないか)
  - 「新しいファイルへ移す」(`moveClassToNewFile`)も候補に入れるか
  - 候補の表示(ファイルのパスをそのまま並べるか)と、移動先候補が無いとき(ファイルが1つだけ)の扱い
- 大きくなりそうなら次のように割る:
  1. 今回: 既存ファイルへのクラス移動をメニュー化する
  2. 後回し: 「新しいファイルへ移す」をメニューに加える
