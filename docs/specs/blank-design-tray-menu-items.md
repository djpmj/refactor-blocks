# blank-design-tray-menu-items: 部品置き場の右クリックメニューに、選んでも何も起きない項目が出る

## 症状

白紙設計モードで、部品置き場のメソッド(例: `placeOrder`)または部品置き場のクラスを右クリック(またはフォーカスして Shift+F10)すると、
次の項目が有効な見た目で出る。

- 「部品置き場 を削除」「このファイルを削除」: 選んでも何も起きない。トースト・エラーは出ず、履歴も増えず、「元に戻す」は無効のまま
- 「継承元を設定」「実装するインターフェースを設定」「名前を変更」: 部品置き場は採点されない置き場(`withoutTray` で採点前に取り除く)なので、設定しても意味がない
- 「クラスを追加」(このファイル): 部品置き場のファイルにクラスを足しても、`withoutTray` でファイルごと採点から外れるので、そこへ置いた部品は未配置のまま

変更依頼の実装中(リファクタリング画面で `withChangePart` が部品置き場を足す)も、同じメニューが出る。

## 原因

`src/presentation/canvas/contextMenuGroups.ts` の `contextMenuGroups(target, names)` が、右クリックした対象が部品置き場かどうかを見ずに、
クラス(`target.classId !== null`)なら「クラス」の組、ファイル(`target.fileId !== null`)なら「このファイル」の組を必ず返している。

削除が「何も起きない」ように見えるのは、部品が残る部品置き場の削除は `deleteClass` / `deleteFile` が `err('has-code')` を返して
`message` を立てるが、白紙設計の画面(`src/presentation/blank/BlankDesignView.tsx`)には `ErrorToast` が置かれておらず、その `message` がどこにも表示されないため。
今回はメニューから項目を出さないことで直し、白紙設計の画面にトーストが無いことは別件にする(スコープ外を参照)。

`contextMenuGroups` の呼び出し元は `CanvasContextMenu.tsx` の `MenuItems` の1か所だけ(右クリックも Shift+F10 も同じ `ContextMenuTarget` を経由する)。
ここを直せば、白紙設計・変更依頼の両方で直る。

## 修正

`src/presentation/canvas/contextMenuGroups.ts`(presentation 層)だけを変更する。シグネチャは変えない。

- `target.classId === TRAY_CLASS_ID` のときは「クラス」の組(`kind: 'class'`)を返さない
- `target.fileId === TRAY_FILE_ID` のときは「このファイル」の組(`kind: 'file'`)を返さない
- 「メソッド/フィールド」の組(「別のクラスへ移動」= 部品を置く操作)と「キャンバス」の組(「ファイルを追加」)はそのまま返す

`TRAY_CLASS_ID` / `TRAY_FILE_ID` は `src/domain/blank/tray.ts` の既存の定数を import する(`ClassNode.tsx`・`FileNode.tsx` と同じ判定)。

結果として、部品置き場のメソッドでは「メソッド」「キャンバス」の2組、部品置き場のクラス(見出しなど)では「キャンバス」の1組だけになる。

無効にして理由を示す案ではなく隠す案にした理由: 部品置き場はコードではない置き場で、クラス・ファイル向けの操作はどれも当てはまる場面が無い。
無効表示にすると、意味の無い項目が6つ並び、本来の操作「別のクラスへ移動」が埋もれる。
既存の `moveClassToNewFile` も、意味が無いときは隠している。

## テスト

先に書く失敗するテスト。

- Vitest `src/presentation/canvas/contextMenuGroups.test.ts` に追加(AAA)
  - 部品置き場のメソッド(`member: { kind: 'method', id: 'm' }, classId: TRAY_CLASS_ID, fileId: TRAY_FILE_ID`)では、組の `kind` が `['member', 'canvas']` になる
  - 部品置き場のクラス(`member: null, classId: TRAY_CLASS_ID, fileId: TRAY_FILE_ID`)では `['canvas']` になる
  - 部品置き場ではない、ふつうのクラスのメソッドでは、これまでどおり `['member', 'class', 'file', 'canvas']` のまま(既存テストで確認済みなら追加しなくてよい)
- E2E `e2e/blank-design-tray-display.spec.ts` に追加(既存の `openBlank` / `blankView` を使う)
  - 白紙設計で部品置き場の `method-placeOrder` を右クリックすると、メニューの組は「メソッド placeOrder()」「キャンバス」の2つで、
    `部品置き場 を削除`・`このファイルを削除`・`継承元を設定`・`実装するインターフェースを設定`・`名前を変更`・`クラスを追加` の menuitem が0個。
    「別のクラスへ移動」は表示されてフォーカスが当たる
  - 同じメソッドにフォーカスして Shift+F10 で開いても、同じ2組になる
  - 部品置き場の見出し(`tray-label`)を右クリックすると、組は「キャンバス」だけになる

## 受け入れ基準

1. 白紙設計で部品置き場のメソッド・クラスを右クリック/Shift+F10 しても、「部品置き場 を削除」「このファイルを削除」「継承元を設定」「実装するインターフェースを設定」「名前を変更」「クラスを追加」が出ない
2. 部品置き場のメソッドの「別のクラスへ移動」で、これまでどおり部品を置ける
3. プレイヤーが作ったクラス・ファイル、リファクタリングのステージのメニューは変わらない(`e2e/context-menu-grouping.spec.ts` が通る)
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 白紙設計の画面(`BlankDesignView.tsx`)に `ErrorToast` を置くこと。今は白紙設計で操作が失敗しても理由が出ない(例: 部品が残るクラスの削除)。
  別の不具合として扱う(`canvas-error-toast.md` でも白紙設計はスコープ外にしている)
- プレイヤーのクラスの「別のファイルへ移動」の移動先に部品置き場のファイルが出ること(`moveClassTargets` が除外していない)。別件
- ストア・`domain` の削除処理(`deleteClass` / `deleteFile`)で部品置き場を拒否すること。メニューから出なければ届かないので、今回は足さない
- 操作ガイド(`operationGuide.ts`)の文言の変更
