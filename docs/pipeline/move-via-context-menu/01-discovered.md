# 機能探索: 右クリックメニューから移動先のクラスを選んでメソッド・フィールドを移す

- slug: `move-via-context-menu`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

既存仕様書 `docs/specs/fields-and-feature-envy.md` の「キーボード操作」節で、未決事項として先送りされていたもの:

> 右クリックメニューの「移動先のクラスを選ぶ」のような、座標に頼らない代替操作は、メソッドとフィールドの両方にまとめて入れるべきなので今回は作らない(未決事項)。

## 背景・目的

- Move Method / Move Field は、このゲームで一番よく使う操作(チュートリアル〜上級のほぼ全ステージの模範解答に出てくる)なのに、
  いまの操作手段は dnd-kit のドラッグ&ドロップだけ。
- キーボードでは `KeyboardSensor`(Space で持ち上げ → 矢印キーで動かす → Space で落とす)に頼っているが、
  React Flow のキャンバス上では移動先クラスの位置が画面の座標しだいで、ズーム・パンの状態によっては
  目的のクラスまで矢印キーで運ぶのが現実的でない。スクリーンリーダーからは移動先の候補も分からない。
- CLAUDE.md の ponytail の方針で「手を抜かないもの」にアクセシビリティ(キーボード操作を含む)が明記されている。
  主要操作にキーボードだけで確実に届く手段が無いのは、この方針に照らして穴になっている。
- マウスで遊ぶプレイヤーにとっても、クラス数が多い中級・上級ステージや、ズームアウトしてチップが小さいとき、
  「遠くのクラスへドラッグで運ぶ」より「移動先をリストから選ぶ」ほうが速く確実。
- 右クリックメニューには既に「継承元を設定」「実装するインターフェースを設定」というホバー/フォーカスで開く
  サブメニュー(候補のクラス名を並べて選ぶ形)があり、同じ部品で「移動先のクラス」を並べられる見込みが高い。
  新しいドメイン操作は要らず、既存の `moveMethod` / `moveField`(ストアの `apply` 経由で Undo 可能)を呼ぶだけで済むはず。

## 関連する既存コード

- `docs/specs/fields-and-feature-envy.md` — 「キーボード操作」節(先送りの経緯)
- `docs/specs/inline-edit-and-hover-submenu.md` — ホバーサブメニューの仕様
- `docs/specs/context-menu-viewport-clamp.md` — メニューをビューポート内に収める仕様
- `src/presentation/canvas/CanvasContextMenu.tsx` — 右クリックメニュー本体。`SubmenuTrigger` / `ExtendsMenuItem` がサブメニューの前例
- `src/presentation/canvas/useCanvasContextMenu.ts` — `ContextMenuTarget`(いまは `fileId` / `classId` だけで、
  メソッドやフィールドを右クリックしてもクラスノード扱いになる。どのメソッド/フィールドを右クリックしたかを持っていない)
- `src/presentation/canvas/MethodChip.tsx` / `FieldChip.tsx` — ドラッグできるチップ(`<button>`、`nodrag nopan`)
- `src/presentation/canvas/CodebaseCanvas.tsx` — `useDropHandler`(ドロップ時に `moveMethod` / `moveField` / `moveMethodToNewClass` を呼ぶ)
- `src/presentation/store/useGameStore.ts` — `moveMethod` / `moveField` / `moveMethodToNewClass`
- `src/domain/codebase/moveMethod.ts` / `moveField.ts` — ドメインの移動操作(変更不要の見込み)
- `e2e/refactor.spec.ts` — ドラッグでの移動を守っている既存E2E。メニュー経由の移動もここに追加する

## スコープの見立て

- 1回のPRで完結する規模と見ている。主な作業は presentation 層(右クリックの対象にメソッド/フィールドを加える、
  「別のクラスへ移動」サブメニューを足す)と、E2Eテストの追加。domain / application 層の新規ロジックは
  ほぼ無い見込み(移動先候補の絞り込みを純粋関数にするなら、その分のユニットテストが付く程度)。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - メニューの開き方: チップの右クリックだけか、キーボードからも開けるようにするか(例: チップにフォーカスして
    Shift+F10 / ContextMenu キー)。キーボードで開けないと、アクセシビリティの目的を半分しか満たさない
  - 候補の並べ方(ファイルごとのまとまり・インターフェースを候補から除くかなど)と、「新しいクラスへ移す」
    (`moveMethodToNewClass`)も候補に入れるか
- 大きくなりそうなら次のように割る:
  1. 今回: メソッドとフィールドを右クリック(+キーボード)メニューから別クラスへ移す
  2. 後回し: クラスを別ファイルへ移す(`moveClass`)を同じ形でメニュー化する
