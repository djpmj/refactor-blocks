import type { ContextMenuTarget } from './useCanvasContextMenu';

export type MenuGroupKind = 'member' | 'class' | 'file' | 'canvas';
export type MenuItem =
  | { readonly kind: 'form'; readonly mode: 'class' | 'renameClass'; readonly label: string }
  | { readonly kind: 'action'; readonly action: 'addFile' | 'deleteClass' | 'deleteFile'; readonly label: string }
  | { readonly kind: 'move-class-submenu'; readonly label: string }
  | { readonly kind: 'move-submenu'; readonly label: string }
  | { readonly kind: 'extends-submenu'; readonly label: string }
  | { readonly kind: 'implements-submenu'; readonly label: string };
export type MenuGroup = { readonly kind: MenuGroupKind; readonly heading: string; readonly items: readonly MenuItem[] };

export function contextMenuGroups(target: ContextMenuTarget, names: Readonly<{ member?: string; className?: string }>): readonly MenuGroup[] {
  const groups: MenuGroup[] = [];
  if (target.member !== null) {
    const heading = target.member.kind === 'method' ? `メソッド ${names.member ?? ''}()` : `フィールド ${names.member ?? ''}`;
    groups.push({ kind: 'member', heading, items: [{ kind: 'move-submenu', label: '別のクラスへ移動' }] });
  }
  if (target.classId !== null) {
    const className = names.className ?? '';
    groups.push({
      kind: 'class', heading: `クラス ${className}`,
      items: [
        ...(target.member === null ? [{ kind: 'move-class-submenu' as const, label: '別のファイルへ移動' }] : []),
        { kind: 'form', mode: 'renameClass', label: '名前を変更' },
        { kind: 'extends-submenu', label: '継承元を設定' },
        { kind: 'implements-submenu', label: '実装するインターフェースを設定' },
        { kind: 'action', action: 'deleteClass', label: `${className} を削除` },
      ],
    });
  }
  if (target.fileId !== null) {
    groups.push({ kind: 'file', heading: 'このファイル', items: [
      { kind: 'form', mode: 'class', label: 'クラスを追加' },
      { kind: 'action', action: 'deleteFile', label: 'このファイルを削除' },
    ] });
  }
  groups.push({ kind: 'canvas', heading: 'キャンバス', items: [{ kind: 'action', action: 'addFile', label: 'ファイルを追加' }] });
  return groups;
}
