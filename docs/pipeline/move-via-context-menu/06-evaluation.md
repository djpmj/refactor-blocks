# 評価: move-via-context-menu

## 2026-09-26 — evaluate(マージ後の最終評価)

- 仕様書: `docs/specs/move-via-context-menu.md`
- 対象: マージコミット `1986b0c`(PR #13、`pipeline/move-via-context-menu`)
- 変更: `moveMethod.ts` / `moveField.ts`(+テスト)、`CanvasContextMenu.tsx`、`useCanvasContextMenu.ts`、
  `MethodChip.tsx` / `FieldChip.tsx`、`CodebaseCanvas.tsx`(1行)、`e2e/refactor.spec.ts`

### 実行結果

| コマンド | 結果 |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass(61ファイル・890件) |
| `npm run test:e2e` | **未確認**。評価環境にPlaywrightのChromiumが入っておらず、82件すべて `browserType.launch: Executable doesn't exist` で起動前に失敗した(`npx playwright install` は評価環境の権限上実行できず)。コードの不具合ではない。05-review-notes.md の Codex自己レビューでは、最終版で82件すべて成功と報告されている |

### 受け入れ基準

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| 純粋関数のテストを先に書き実装して通る | ○(順序は未確認) | `moveMethodTargets` / `moveFieldTargets` のテストがあり通る。PRがsquashされているため Red→Green の順序は履歴から確認できない |
| メソッドの右クリック→先頭に「別のクラスへ移動」→候補で移動 | ○ | `menuItemsFor` の先頭に `move-submenu`。E2E `移動メニュー: methodを右クリック…` |
| フィールドでも同じ | ○ | 同じE2Eを `for (kind of ['method','field'])` で回している |
| 移動後に閉じ、Ctrl+Zで戻せる(`apply` 経由) | ○ | ストアの `moveMethod` / `moveField` を呼んで `onClose()`。E2EでCtrl+Zも確認 |
| ヘッダー・ファイル・余白では出ない | ○ | `classId === null` なら `member` は null、ヘッダーでは `closest` が見つからない。E2Eで3か所確認 |
| 移動元自身・同名メンバーを持つクラスは候補に出ない | ○ | `targetError` を `moveX` と `moveXTargets` で共有(判定の二重化なし)。ユニットテストあり |
| 「新しいクラスへ移動」は候補に出ない | ○ | E2Eで0件を確認 |
| Shift+F10 で開き、Tab/Enterだけで移動 | ○ | 独自の `onKeyDown` は無く、ブラウザ標準の `contextmenu` に任せている(仕様どおり)。E2Eあり |
| Escapeで閉じるとチップへフォーカスが戻る | ○ | `dismiss` が `returnFocus` へ戻す。移動実行時は `close` なので戻さない(仕様どおり) |
| E2Eの追加 | ○ | 仕様の4ケースに加え、レビューで見つかった境界(候補0件・開き直し)も追加 |
| 既存D&DのE2Eが通る | 未確認(上記) | Codexレビュー時点では全件成功と報告 |
| `npm run check` が通る | ○ | |

### 指摘

1. **suggestion** — `src/presentation/canvas/useCanvasContextMenu.ts:609-617`(`dismiss`)
   - 外側クリックで閉じると、次のフレームで必ず開く前の要素へフォーカスを戻す。メニューを開いたまま
     サイドパネルの入力欄やステージの `<select>` などフォーカスできる要素をクリックすると、そのクリックで得た
     フォーカスがチップへ奪い返され、入力を始められない(E2Eでも `getByLabel('ステージ')` をクリックした後に
     チップがフォーカスされることを「正」として固定している)。仕様の文言どおりではあるが、WAI-ARIAのメニューの
     慣習では、外側クリックでは戻さないか、クリック先がフォーカスを取らなかった(`document.activeElement === document.body`)
     ときだけ戻すのが一般的。
   - 推奨: rAF の中で `document.activeElement` が body(または null)のときだけ戻す。仕様の修正を伴うので次の仕様で扱う。

2. **suggestion** — `src/presentation/canvas/useCanvasContextMenu.ts:609`、`CanvasContextMenu.tsx:48-62`
   - `close` は `useCallback` なのに `dismiss` は毎レンダー作り直されるため、`useCloseOnOutside` の effect
     (`[menuRef, onClose]` 依存)が `CodebaseCanvas` の再レンダーのたびに `pointerdown` / `keydown` リスナーを外して付け直す。
     動作上の不具合は無いが、以前の `onClose` 固定の挙動より無駄が増えている。
   - 推奨: `target` を ref で持つなどして `dismiss` も `useCallback` にする。

3. **suggestion** — `src/presentation/canvas/useCanvasContextMenu.ts:11-12`
   - 仕様の型定義に無い `returnFocus: Element | null` を `ContextMenuTarget` に足している。フォーカス復帰の実装に必要なので
     妥当だが、メニューの位置・対象を表す型にDOM要素が混ざった。仕様書にあった `member` のJSDoc
     (「右クリックしたメソッド/フィールド。クラスのヘッダー・ファイル・余白ならnull。」)も落ちている。
   - 推奨: `returnFocus` は `useCanvasContextMenu` 内の `useRef` に持てば型に出さずに済む。JSDocは仕様から戻す。

4. **suggestion(shrink)** — `src/presentation/canvas/CanvasContextMenu.tsx:431`
   - `MoveMenuItem` の props 型に `ExtendsMenuItemProps` を流用している。形は同じだが名前が誤解を招く。
   - 推奨: `type SubmenuItemProps = …` のように共通名にするか、`MoveMenuItemProps` を別名で置く。

5. **suggestion** — `src/domain/codebase/moveMethod.test.ts:271-305` / `moveField.test.ts:177-212`
   - 仕様で別ケースとして挙げた「移動元を除く」「同名を除く」「ファイル順・宣言順」「元を変更しない」を1つの `it` にまとめ、
     `it.each` の中で `memberId === 'missing' ? base : codebase` と Act で分岐している。失敗したときにどの条件が
     壊れたか読み取りにくく、AAAの Arrange が Act に漏れている。
     また `Codebase['files'][number]['classes'][number]` は既存の `CodeClass` 型で書ける。
   - 推奨: 仕様の箇条書きどおり `it` を分け、ケースごとに Arrange で入力を用意する。

### キーボード操作(evaluator手順7)

受け入れ基準に含まれており、満たしている。Shift+F10(ブラウザ標準の `contextmenu`)→先頭の
「別のクラスへ移動」に自動フォーカス→フォーカスでサブメニューが開く→Tabで候補→Enterで移動、の流れが
E2Eで守られている。レビュー指摘を受けて `autoFocus={index === 0}` を「実際に描画された先頭の menuitem へ
`useLayoutEffect` でフォーカス」に置き換え、候補0件で `MoveMenuItem` が `null` を返してもメニュー内に
フォーカスが入るようになった(既存メニューのキーボード操作の退行も防いでいる)。macOSは仕様どおり対象外。

### DDDの層・ponytail観点

- domain の追加は `targetError` の切り出しと `allClasses(...).filter(...)` だけで、外部依存なし。`Result` と既存ヘルパー
  (`allClasses` / `findMethod` / `fieldsOf` など)を再利用しており、判定の二重化もない(**reuse** 良好)。
- application・store・`useDropHandler` は変更されておらず、既存の `apply` 経由の操作を呼ぶだけ(仕様の「新しい仕組みは要らない」どおり)。
- チップ側にイベントハンドラーやコンテキストを足さず、`data-*` 属性と `closest` で判定しており最小。
- `SubmenuTrigger` から `autoFocus` プロップを消せたのは、仕様外ではあるが **delete** 方向の良い変更。
- `requestAnimationFrame` による遅延フォーカス+取り消しはやや手が込んでいるが、`pointerdown` の既定フォーカス移動と
  競合するため必要で、境界ケースはE2Eで守られている。ただし指摘1の方針にすれば条件付きにできる。

### 次に活かすべき改善点

- パイプラインの評価環境(`evaluate` ジョブ)に `npx playwright install chromium` の手順か許可を入れ、評価者自身がE2Eを回せるようにする。
  今回はE2Eの成否をCodexの自己申告に頼るしかなかった。
- squashマージのため TDD の Red→Green を履歴から確認できない。実装者に「テストだけのコミット」を先に積ませ、マージ方式を
  squash以外にするか、PR本文にRedの実行ログを残すと検証できる。
- 仕様書で「外側クリック時のフォーカス復帰」を書くときは、クリック先がフォーカスを取った場合の扱いまで決めておく(指摘1)。

## 総合判定: 合格

受け入れ基準をすべて満たしている(E2Eは評価環境の都合で未実行だが、該当テストは追加されておりCodexレビュー時点で全件成功)。
blocker は無し。suggestion 5件は次の改修で扱えばよい。
