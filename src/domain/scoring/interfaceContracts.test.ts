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

  it('extendsの先祖が持っていれば数えない', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a'), contractMethod('m-b', 'b')] };
    const base: CodeClass = {
      id: 'class-base',
      name: 'Base',
      interfaceIds: ['class-i'],
      methods: [realMethod('method-base-a', 'a'), realMethod('method-base-b', 'b'), contractMethod('base-hook', 'hook', 'protected')],
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

  it('具象の先祖から借りた契約メソッドを契約違反に数える', () => {
    // Arrange
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a'), contractMethod('m-b', 'b')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('p-a', 'a'), realMethod('p-b', 'b')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [realMethod('c-a', 'a')] };
    // Act
    const result = findContractViolations(codebaseOf([iface, base, child]));
    // Assert
    expect(result).toEqual(['class-c']);
  });

  it('親経由で届く契約も具象の先祖から借りれば数える', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('p-a', 'a')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', methods: [] };
    expect(findContractViolations(codebaseOf([iface, base, child]))).toEqual(['class-c']);
  });

  it('借用した契約メソッドごとに数え、クラス出現順で返す', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a'), contractMethod('m-b', 'b')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('p-a', 'a'), realMethod('p-b', 'b')] };
    const middle: CodeClass = { id: 'class-q', name: 'Q', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [realMethod('q-a', 'a')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-q', interfaceIds: ['class-i'], methods: [] };
    expect(findContractViolations(codebaseOf([iface, middle, child, base]))).toEqual(['class-q', 'class-c', 'class-c']);
  });

  it('先祖から借りたとしても子自身が契約を持てば数えない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('p-a', 'a')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [realMethod('c-a', 'a')] };
    expect(findContractViolations(codebaseOf([iface, base, child]))).toEqual([]);
  });

  it('抽象役の先祖から受け継ぐ場合は数えない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a')] };
    const base: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('p-a', 'a'), contractMethod('hook', 'hook', 'protected')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [] };
    expect(findContractViolations(codebaseOf([iface, base, child]))).toEqual([]);
  });

  it('最も近い所有者が抽象役なら、遠い具象の同名メソッドがあっても数えない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a')] };
    const concrete: CodeClass = { id: 'class-p', name: 'P', interfaceIds: ['class-i'], methods: [realMethod('p-a', 'a')] };
    const abstractBase: CodeClass = { id: 'class-q', name: 'Q', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [contractMethod('q-a', 'a', 'protected'), contractMethod('hook', 'hook', 'protected')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-q', interfaceIds: ['class-i'], methods: [] };
    expect(findContractViolations(codebaseOf([iface, concrete, abstractBase, child]))).toEqual([]);
  });

  it('契約メソッドを持つ先祖がいなければ借用とは数えない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a')] };
    const base: CodeClass = { id: 'class-p', name: 'P', methods: [] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [] };
    expect(findContractViolations(codebaseOf([iface, base, child]))).toEqual(['class-c']);
  });

  it('契約と無関係な親のメソッドを受け継ぐだけなら数えない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a')] };
    const base: CodeClass = { id: 'class-p', name: 'P', methods: [realMethod('p-run', 'run')] };
    const child: CodeClass = { id: 'class-c', name: 'C', superclassId: 'class-p', interfaceIds: ['class-i'], methods: [] };
    expect(findContractViolations(codebaseOf([iface, base, child]))).toEqual(['class-c']);
  });

  it('削除済みの継承元や継承の輪があっても落ちない', () => {
    const iface: CodeClass = { id: 'class-i', name: 'I', methods: [contractMethod('m-a', 'a')] };
    const missing: CodeClass = { id: 'class-missing', name: 'Missing', superclassId: 'deleted', interfaceIds: ['class-i'], methods: [] };
    const cycleA: CodeClass = { id: 'class-a', name: 'A', superclassId: 'class-b', interfaceIds: ['class-i'], methods: [] };
    const cycleB: CodeClass = { id: 'class-b', name: 'B', superclassId: 'class-a', methods: [realMethod('b-a', 'a')] };
    expect(() => findContractViolations(codebaseOf([iface, missing, cycleA, cycleB]))).not.toThrow();
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
