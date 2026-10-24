import { describe, expect, it } from 'vitest';
import type { Codebase } from '../../domain/codebase/Codebase';
import { describeDependencies, describeTargets } from './describeTargets';

const method = (id: string, name: string) => ({ id, name, visibility: 'public' as const, fragments: [] });
const codebase: Codebase = { files: [
  { id: 'cart-file', path: 'cart.ts', classes: [
    { id: 'cart', name: 'CartService', methods: [method('add', 'add')] },
    { id: 'point', name: 'PointService', methods: [] },
  ] },
  { id: 'account-file', path: 'account.ts', classes: [{ id: 'account', name: 'Account', methods: [method('set-balance', 'setBalance')] }] },
] };
const none = { fileIds: [], classIds: [], methodIds: [] };

describe('describeTargets', () => {
  it('メソッドのIDを Class.method() にする', () => {
    // Arrange
    const target = { ...none, methodIds: ['set-balance'] };

    // Act
    const { names, rest } = describeTargets(codebase, target);

    // Assert
    expect(names.map(({ label }) => label)).toEqual(['Account.setBalance()']);
    expect(names[0].target).toEqual(target);
    expect(rest).toBe(0);
  });

  it('クラスのIDをクラス名にする', () => {
    // Arrange
    const target = { ...none, classIds: ['account'] };

    // Act
    const { names } = describeTargets(codebase, target);

    // Assert
    expect(names.map(({ label }) => label)).toEqual(['Account']);
  });

  it('ファイルのIDを、中のクラス名を並べた「〜 のファイル」にする', () => {
    // Arrange
    const target = { ...none, fileIds: ['cart-file'] };

    // Act
    const { names } = describeTargets(codebase, target);

    // Assert
    expect(names.map(({ label }) => label)).toEqual(['CartService・PointService のファイル']);
  });

  it('6件あるときは5件と残りの件数にする', () => {
    // Arrange
    const many: Codebase = { files: [{ id: 'f', path: 'f.ts', classes: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id.toUpperCase(), methods: [] })) }] };
    const target = { ...none, classIds: ['a', 'b', 'c', 'd', 'e', 'f'] };

    // Act
    const { names, rest } = describeTargets(many, target);

    // Assert
    expect(names.map(({ label }) => label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(rest).toBe(1);
  });

  it('存在しないIDは飛ばす', () => {
    // Arrange
    const target = { fileIds: ['gone-file'], classIds: ['gone-class', 'account'], methodIds: ['gone-method'] };

    // Act
    const { names, rest } = describeTargets(codebase, target);

    // Assert
    expect(names.map(({ label }) => label)).toEqual(['Account']);
    expect(rest).toBe(0);
  });
});

describe('describeDependencies', () => {
  it('依存を from → to の矢印にし、押すと両端のクラスを対象にする', () => {
    // Arrange
    const dependencies = [{ from: 'cart', to: 'account' }, { from: 'gone', to: 'account' }];

    // Act
    const { names, rest } = describeDependencies(codebase, dependencies);

    // Assert
    expect(names).toEqual([{ label: 'CartService → Account', target: { ...none, classIds: ['cart', 'account'] } }]);
    expect(rest).toBe(0);
  });
});
