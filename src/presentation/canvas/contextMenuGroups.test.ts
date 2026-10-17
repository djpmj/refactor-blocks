import { describe, expect, it } from 'vitest';
import { contextMenuGroups } from './contextMenuGroups';
import type { ContextMenuTarget } from './useCanvasContextMenu';

const target = (member: ContextMenuTarget['member'], classId: string | null, fileId: string | null): ContextMenuTarget => ({
  x: 0, y: 0, member, classId, fileId, returnFocus: null,
});

describe('contextMenuGroups', () => {
  it('メソッドは対象名を見出しにして4組を順に返す', () => {
    const groups = contextMenuGroups(target({ kind: 'method', id: 'm' }, 'c', 'f'), { member: 'calculatePrice', className: 'PriceCalculator' });
    expect(groups.map(({ kind }) => kind)).toEqual(['member', 'class', 'file', 'canvas']);
    expect(groups[0]?.heading).toBe('メソッド calculatePrice()');
  });
  it('フィールドはメンバー見出しを表示する', () => {
    expect(contextMenuGroups(target({ kind: 'field', id: 'f' }, 'c', 'file'), { member: 'status', className: 'Cart' })[0]?.heading).toBe('フィールド status');
  });
  it('クラス、ファイル、余白は対象に応じた組だけを返す', () => {
    const classGroups = contextMenuGroups(target(null, 'c', 'f'), { className: 'PriceCalculator' });
    expect(classGroups.map(({ kind }) => kind)).toEqual(['class', 'file', 'canvas']);
    expect(classGroups[0]?.items[0]?.label).toBe('別のファイルへ移動');
    expect(classGroups[0]?.items.at(-1)?.label).toBe('PriceCalculator を削除');
    expect(contextMenuGroups(target(null, null, 'f'), {}).map(({ kind }) => kind)).toEqual(['file', 'canvas']);
    expect(contextMenuGroups(target(null, null, null), {}).map(({ kind }) => kind)).toEqual(['canvas']);
  });
});
