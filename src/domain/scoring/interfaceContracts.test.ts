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
      methods: [realMethod('method-base-a', 'a'), realMethod('method-base-b', 'b')],
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
