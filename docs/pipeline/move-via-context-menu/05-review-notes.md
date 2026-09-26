
## 2026-09-26 15:49 UTC — Codex自己レビュー

修正が必要な指摘は2件です。いずれも実ブラウザで再現しました。

1. **[P2] 移動候補が0件だとメニューにフォーカスが入らない**  
   [CanvasContextMenu.tsx:240](/home/runner/work/refactor-blocks/refactor-blocks/src/presentation/canvas/CanvasContextMenu.tsx:240)  
   `MoveMenuItem` が `null` を返しても、後続項目の `autoFocus` は配列の `index === 0` で判定されます。チュートリアル1の `printMonthlyReport` で Shift+F10 を押すと、フォーカスがチップに残り、Tabでもメニュー外へ進みます。仕様の先頭項目へのフォーカスと、既存メニューのキーボード操作を損ないます。実際に表示される先頭項目へフォーカスを設定してください。

2. **[P2] メニューを開き直すと、古いフォーカス復帰処理が新しいメニューに干渉する**  
   [CanvasContextMenu.tsx:414](/home/runner/work/refactor-blocks/refactor-blocks/src/presentation/canvas/CanvasContextMenu.tsx:414)  
   メソッドからメニューを開き、別のフィールドを右クリックすると、外側の `pointerdown` で予約された処理が新しいメニューの表示後に実行されます。その結果、フォーカスが元のメソッドへ戻り、新しい移動サブメニューも閉じます。別メニューを開いた場合には、古いフォーカス復帰予約を無効化してください。

DDD構成・判定の共通化・`apply` 経由の移動に問題は見当たりません。`npm run check`（890テスト）と全80件のE2Eは成功しました。上記の境界ケースは追加テストで保護する必要があります。TDDの実施順序は差分だけでは確認できません。

NEEDS_FIX