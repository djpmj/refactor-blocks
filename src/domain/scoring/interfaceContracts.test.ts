import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Method } from '../codebase/Codebase';
import { findContractViolations, findStubMethods } from './interfaceContracts';

function contractMethod(id: string, name: string, visibility: Method['visibility'] = 'public'): Method {
  return { id, name, visibility, fragments: [] };
}

function realMethod(id: string, name: string, overrides: Partial<Method> = {}): Method {
  return { id, name, visibility: 'public', fragments: [{ id: `${id}-f`, label: name, lines: 5, responsibility: 'x' }], ...overrides };
}

function codebaseOf(classes: readonly CodeClass[]): Codebase {
  return { files: [{ id: 'file', path: 'src/all.ts', classes }] };
}

describe('findStubMethods', () => {
  it('isStubMethodなメソッドのIDを出現順に返す', () => {
    // Arrange
    const codebase = codebaseOf([
      {
        id: 'class-a',
        name: 'A',
        methods: [
          { id: 'method-normal', name: 'normal', visibility: 'public', fragments: [{ id: 'f1', label: 'x', lines: 1, responsibility: 'x' }] },
          { id: 'method-stub', name: 'stub', visibility: 'public', fragments: [{ id: 'f2', label: 'y', lines: 1, responsibility: 'x', stub: true }] },
        ],
      },
    ]);

    // Act
    const result = findStubMethods(codebase);

    // Assert
    expect(result).toEqual(['method-stub']);
  });
});

describe('findContractViolations', () => {
  it('具象のextends先祖から借りた契約メソッドを減点する', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('pa', 'a'), realMethod('pb', 'b')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [realMethod('ca', 'a')] };

    // Act
    const result = findContractViolations(codebaseOf([iface, base, child]));

    // Assert
    expect(result).toEqual(['class-c']);
  });

  it('具象先祖の実装がインターフェース経由で届けば借用を減点する', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('pa', 'a')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', methods: [] };

    // Act
    const result = findContractViolations(codebaseOf([iface, base, child]));

    // Assert
    expect(result).toEqual(['class-c']);
  });

  it('借りた複数の契約メソッドを契約名ごとに数える', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('pa', 'a'), realMethod('pb', 'b')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', methods: [] };

    // Act
    const result = findContractViolations(codebaseOf([iface, base, child]));

    // Assert
    expect(result).toEqual(['class-c', 'class-c']);
  });

  it('子クラス自身が契約メソッドを実装していれば借用にしない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('pa', 'a'), realMethod('pb', 'b')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [realMethod('ca', 'a'), realMethod('cb', 'b')] };

    // Act
    const result = findContractViolations(codebaseOf([iface, base, child]));

    // Assert
    expect(result).toEqual([]);
  });

  it('抽象役のextends先祖から借りた契約は減点しない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('pa', 'a'), contractMethod('template', 'template', 'protected')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', methods: [] };

    // Act
    const result = findContractViolations(codebaseOf([iface, base, child]));

    // Assert
    expect(result).toEqual([]);
  });

  it('extends鎖の各段で借りた契約を近い所有者ごとに数える', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('pa', 'a'), realMethod('pb', 'b')] };
    const middle: CodeClass = { id: 'class-q', name: 'Q', superclassId: 'class-p', methods: [realMethod('qa', 'a')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-q', methods: [] };

    // Act
    const result = findContractViolations(codebaseOf([iface, base, middle, child]));

    // Assert
    expect(result).toEqual(['class-q', 'class-c', 'class-c']);
  });

  it('最も近い所有者が抽象役なら遠い具象の同名メソッドでも借用にしない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a')] };
    const concrete: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('pa', 'a')] };
    const abstract: CodeClass = { id: 'class-q', name: 'Q', superclassId: 'class-p', methods: [realMethod('qa', 'a'), contractMethod('template', 'template', 'protected')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-q', methods: [] };

    // Act
    const result = findContractViolations(codebaseOf([iface, concrete, abstract, child]));

    // Assert
    expect(result).toEqual([]);
  });

  it('extendsしたインターフェース役の契約を検査する', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const impl: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-i', methods: [realMethod('a-c', 'a')] };
    expect(findContractViolations(codebaseOf([iface, impl]))).toEqual(['class-c']);
  });

  it('extendsしたインターフェース役の契約を実装していれば違反にしない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const impl: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-i', methods: [realMethod('a-c', 'a'), realMethod('b-c', 'b')] };
    expect(findContractViolations(codebaseOf([iface, impl]))).toEqual([]);
  });

  it('extendsしたインターフェース役の契約は空実装でも満たす', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a')] };
    const impl: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-i', methods: [{ id: 'a-c', name: 'a', visibility: 'public', fragments: [{ id: 'f', label: 'stub', lines: 1, responsibility: 'x', stub: true }] }] };
    expect(findContractViolations(codebaseOf([iface, impl]))).toEqual([]);
  });

  it('インターフェース役の先祖の契約名を実装済みに数えない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const impl: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-i', methods: [realMethod('run', 'run')] };
    expect(findContractViolations(codebaseOf([iface, impl]))).toEqual(['class-c', 'class-c']);
  });

  it('Bは実装漏れ、Cは具象の先祖Bからの借用で両方減点される', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const base: CodeClass = { id: 'class-b', name: 'B', superclassId: 'class-i', methods: [realMethod('a-b', 'a')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-b', methods: [realMethod('b-c', 'b')] };
    expect(findContractViolations(codebaseOf([iface, base, child]))).toEqual(['class-b', 'class-c']);
  });

  it('implementsとextendsで同じ契約元が重複しても一度だけ調べる', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a'), contractMethod('b', 'b')] };
    const impl: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-i', interfaceIds: ['class-i'], methods: [realMethod('a-c', 'a')] };
    expect(findContractViolations(codebaseOf([iface, impl]))).toEqual(['class-c']);
  });

  it('インターフェース役同士のextendsは実装漏れを調べない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('a', 'a')] };
    const child: CodeClass = { id: 'class-j', name: 'J', superclassId: 'class-i', methods: [contractMethod('x', 'x')] };
    expect(findContractViolations(codebaseOf([iface, child]))).toEqual([]);
  });

  it('インターフェース役でない先祖は契約元として調べない', () => {
    const base: CodeClass = { id: 'class-base', name: 'Base', methods: [realMethod('a-base', 'a')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-base', methods: [realMethod('other', 'other')] };
    expect(findContractViolations(codebaseOf([base, child]))).toEqual([]);
  });

  it('extends先祖が削除されていても落ちない', () => {
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'deleted', methods: [realMethod('other', 'other')] };
    expect(() => findContractViolations(codebaseOf([child]))).not.toThrow();
  });

  it('extendsが循環していても終了する', () => {
    const first: CodeClass = { id: 'class-a', name: 'A', superclassId: 'class-b', methods: [realMethod('a', 'a')] };
    const second: CodeClass = { id: 'class-b', name: 'B', superclassId: 'class-a', methods: [realMethod('b', 'b')] };
    expect(() => findContractViolations(codebaseOf([first, second]))).not.toThrow();
  });

  it('実装先の契約をすべて同名で持っていれば空', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a'), contractMethod('m-b', 'b')] };
    const impl: CodeClass = {
      id: 'class-c',
      name: 'C',
      interfaceIds: ['class-i'],
      methods: [realMethod('method-a', 'a'), realMethod('method-b', 'b')],
    };
    const codebase = codebaseOf([iface, impl]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('契約2つのうち1つがなければ実装クラスのIDが1つ', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a'), contractMethod('m-b', 'b')] };
    const impl: CodeClass = { id: 'class-c', name: 'C', interfaceIds: ['class-i'], methods: [realMethod('method-a', 'a')] };
    const codebase = codebaseOf([iface, impl]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual(['class-c']);
  });

  it('空実装で持っていれば数えない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a'), contractMethod('m-b', 'b')] };
    const impl: CodeClass = {
      id: 'class-c',
      name: 'C',
      interfaceIds: ['class-i'],
      methods: [realMethod('method-a', 'a'), { id: 'method-b', name: 'b', visibility: 'public', fragments: [{ id: 'fb', label: '未対応', lines: 2, responsibility: 'b', stub: true }] }],
    };
    const codebase = codebaseOf([iface, impl]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('抽象役のextends先祖が持っていれば数えない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a'), contractMethod('m-b', 'b')] };
    const base: CodeClass = {
      id: 'class-base',
      name: 'Base',
      interfaceIds: ['class-i'],
      methods: [realMethod('method-base-a', 'a'), realMethod('method-base-b', 'b'), contractMethod('template', 'template', 'protected')],
    };
    const impl: CodeClass = {
      id: 'class-c',
      name: 'C',
      superclassId: 'class-base',
      interfaceIds: ['class-i'],
      methods: [realMethod('method-a', 'a')],
    };
    const codebase = codebaseOf([iface, base, impl]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('isInterfaceLikeでない相手を実装していても実装漏れを見ない', () => {
    // Arrange
    const concreteInterfaceLike: CodeClass = { id: 'class-e', name: 'E', methods: [realMethod('method-e-a', 'a')] };
    const impl: CodeClass = { id: 'class-d', name: 'D', interfaceIds: ['class-e'], methods: [realMethod('method-d', 'run')] };
    const codebase = codebaseOf([concreteInterfaceLike, impl]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('具象クラスのpublicな中身なしメソッドは、そのメソッドIDを返す', () => {
    // Arrange
    const concrete: CodeClass = {
      id: 'class-f',
      name: 'F',
      methods: [realMethod('method-real', 'real'), contractMethod('method-contract', 'contract')],
    };
    const codebase = codebaseOf([concrete]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual(['method-contract']);
  });

  it('中身のないメソッドがprivateなら数えない', () => {
    // Arrange
    const concrete: CodeClass = {
      id: 'class-f',
      name: 'F',
      methods: [realMethod('method-real', 'real'), contractMethod('method-contract', 'contract', 'private')],
    };
    const codebase = codebaseOf([concrete]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('契約と同名のpublicメソッドを持つのに実装を宣言していなければ、そのクラスのIDを返す', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-j', name: 'J', methods: [contractMethod('m-x', 'x')] };
    const concrete: CodeClass = { id: 'class-g', name: 'G', methods: [realMethod('method-other', 'other'), realMethod('method-x', 'x')] };
    const codebase = codebaseOf([iface, concrete]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual(['class-g']);
  });

  it('継承元がそのインターフェースを実装していれば宣言漏れに数えない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-j', name: 'J', methods: [contractMethod('m-x', 'x')] };
    const base: CodeClass = { id: 'class-base', name: 'Base', interfaceIds: ['class-j'], methods: [realMethod('method-base-x', 'x')] };
    const concrete: CodeClass = {
      id: 'class-g',
      name: 'G',
      superclassId: 'class-base',
      methods: [realMethod('method-other', 'other'), realMethod('method-x', 'x')],
    };
    const codebase = codebaseOf([iface, base, concrete]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('インターフェース役のクラス自身は宣言漏れの対象にしない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-j', name: 'J', methods: [contractMethod('m-x', 'x')] };
    const codebase = codebaseOf([iface]);

    // Act
    const result = findContractViolations(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('削除済みの実装先IDがあっても落ちない', () => {
    // Arrange
    const impl: CodeClass = { id: 'class-c', name: 'C', interfaceIds: ['class-deleted'], methods: [realMethod('method-a', 'a')] };
    const codebase = codebaseOf([impl]);

    // Act
    const act = () => findContractViolations(codebase);

    // Assert
    expect(act).not.toThrow();
    expect(act()).toEqual([]);
  });
});
