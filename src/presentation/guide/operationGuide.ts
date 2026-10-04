export type GuideItem = { readonly operation: string; readonly description: string };
export type GuideSection = { readonly heading: string; readonly items: readonly GuideItem[] };

export const OPERATION_GUIDE: readonly GuideSection[] = [
  {
    heading: 'ブロックを動かす',
    items: [
      { operation: 'ドラッグ', description: 'メソッドやフィールドを別のクラスへ、クラスを別のファイルへ移動できます。' },
      { operation: 'キャンバスの余白へドロップ', description: 'メソッドやクラスから新しいクラスやファイルを作れます。無効な移動の理由は画面に表示されます。' },
    ],
  },
  {
    heading: '右クリックメニュー',
    items: [
      { operation: '右クリック', description: 'ファイルでは追加・削除、クラスでは移動・追加・名前変更・継承元や実装先の設定・削除、メソッドやフィールドでは別のクラスへの移動ができます。' },
    ],
  },
  {
    heading: '名前を変える',
    items: [
      { operation: 'ダブルクリック', description: 'クラス名やメソッド名をその場で編集できます。Enter で確定、Esc で取り消します。' },
    ],
  },
  {
    heading: '処理を抽出する',
    items: [
      { operation: 'メソッドをクリック', description: '右側のエディタで処理を選び、新しいメソッドとして抽出できます。' },
    ],
  },
  {
    heading: '取り消し・やり直し',
    items: [
      { operation: 'Ctrl+Z / Cmd+Z', description: '直前の変更を取り消します。' },
      { operation: 'Ctrl+Y / Ctrl+Shift+Z', description: '取り消した変更をやり直します。Mac では Cmd+Y / Cmd+Shift+Z も使えます。' },
    ],
  },
  {
    heading: '画面の操作',
    items: [
      { operation: 'キャンバスをドラッグ', description: 'キャンバスを移動します。ホイールでズームできます。' },
      { operation: 'サイドバーの境界をドラッグ / ← →', description: '右サイドバーの幅を変更します。矢印キーは境界にフォーカスして使います。' },
    ],
  },
  {
    heading: 'このガイド',
    items: [{ operation: '?', description: '操作ガイドを開閉します。' }],
  },
];
