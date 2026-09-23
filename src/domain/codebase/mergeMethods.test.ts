import { describe, expect, it } from 'vitest';
import { findClass, findMethod, type CodeClass, type CodeFile, type Codebase, type Fragment, type Method, type Visibility } from './Codebase';
import { findMergeCandidates, mergeMethods, type MergeMethodsRequest } from './mergeMethods';

function fragment(id: string, overrides: Partial<Fragment> = {}): Fragment {
  return { id, label: '送信ログを記録する', lines: 24, responsibility: 'logging', ...overrides };
}

function method(id: string, name: string, fragments: Fragment[], visibility: Visibility = 'private'): Method {
  return { id, name, visibility, fragments };
}

function codeClass(id: string, name: string, methods: Method[]): CodeClass {
  return { id, name, methods };
}

function file(id: string, path: string, classes: CodeClass[]): CodeFile {
  return { id, path, classes };
}

/**
 * ClassA.logA / ClassB.logB / ClassC.logC は同じ duplicateGroup を持つ「本物の重複」。
 * ClassA.callerA / ClassB.callerB はそれぞれ logA / logB を呼び出す(統合後の呼び出し元の書き換えを確認するため)。
 * ClassA.otherA は同じクラス内の統合候補(same-class用)。ClassA.mergedLog は名前衝突チェック用。
 * ClassD.logD は形は同じだが public。ClassE.buildA / ClassF.buildB はresponsibility/labelは同じだが
 * duplicateGroup が無い「別物」(誤爆防止の回帰テスト用)。ClassG.twoStep は fragments が2つで形が違う。
 * ClassH.logH は duplicateGroup の値そのものが違う。
 */
function fixture(): Codebase {
  return {
    files: [
      file('file-a', 'src/A.ts', [
        codeClass('class-a', 'ClassA', [
          method('method-a', 'logA', [fragment('fa1', { duplicateGroup: 'log-group' })]),
          method('method-a-other', 'otherA', [fragment('fa2', { duplicateGroup: 'log-group', lines: 20 })]),
          method('method-a-existing', 'mergedLog', [fragment('fa3', { label: '他の処理', responsibility: 'misc' })]),
          method('method-caller-a', 'callerA', [{ id: 'fa-call', label: 'call', lines: 1, responsibility: 'call', uses: ['method-a'] }], 'public'),
        ]),
      ]),
      file('file-b', 'src/B.ts', [
        codeClass('class-b', 'ClassB', [
          method('method-b', 'logB', [fragment('fb1', { duplicateGroup: 'log-group', lines: 22 })]),
          method('method-caller-b', 'callerB', [{ id: 'fb-call', label: 'call', lines: 1, responsibility: 'call', uses: ['method-b'] }], 'public'),
        ]),
      ]),
      file('file-c', 'src/C.ts', [
        codeClass('class-c', 'ClassC', [method('method-c', 'logC', [fragment('fc1', { duplicateGroup: 'log-group', lines: 18 })])]),
      ]),
      file('file-d', 'src/D.ts', [
        codeClass('class-d', 'ClassD', [method('method-d', 'logD', [fragment('fd1', { duplicateGroup: 'log-group' })], 'public')]),
      ]),
      file('file-e', 'src/E.ts', [
        codeClass('class-e', 'ClassE', [
          method('method-e', 'buildA', [{ id: 'fe1', label: '通知文を組み立てる', lines: 32, responsibility: 'formatting' }]),
        ]),
      ]),
      file('file-f', 'src/F.ts', [
        codeClass('class-f', 'ClassF', [
          method('method-f', 'buildB', [{ id: 'ff1', label: '通知文を組み立てる', lines: 30, responsibility: 'formatting' }]),
        ]),
      ]),
      file('file-g', 'src/G.ts', [
        codeClass('class-g', 'ClassG', [
          method('method-g', 'twoStep', [fragment('fg1', { duplicateGroup: 'log-group' }), fragment('fg2', { duplicateGroup: 'log-group' })]),
        ]),
      ]),
      file('file-h', 'src/H.ts', [
        codeClass('class-h', 'ClassH', [method('method-h', 'logH', [fragment('fh1', { duplicateGroup: 'other-group' })])]),
      ]),
    ],
  };
}

function request(overrides: Partial<MergeMethodsRequest> = {}): MergeMethodsRequest {
  return { methodAId: 'method-a', methodBId: 'method-b', newMethodId: 'method-merged', newMethodName: 'logNotification', ...overrides };
}

describe('mergeMethods', () => {
  it('別クラスにある形の一致した2つのprivateメソッドを統合すると、Aの位置に新メソッドが入りBからは消える', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const result = mergeMethods(codebase, request());

    // Assert
    if (!result.ok) throw new Error(result.error);
    const classA = findClass(result.value, 'class-a');
    const classB = findClass(result.value, 'class-b');
    expect(classA?.methods.map((m) => m.id)).toEqual(['method-merged', 'method-a-other', 'method-a-existing', 'method-caller-a']);
    expect(classB?.methods.map((m) => m.id)).toEqual(['method-caller-b']);
  });

  it('統合後のFragmentのlinesはA/Bの大きいほうになり、label/responsibilityはA側を引き継ぐ', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const result = mergeMethods(codebase, request());

    // Assert
    if (!result.ok) throw new Error(result.error);
    const merged = findMethod(result.value, 'method-merged');
    expect(merged?.fragments).toEqual([{ id: 'method-merged:merge0', label: '送信ログを記録する', lines: 24, responsibility: 'logging' }]);
  });

  it('統合前にA・Bを呼んでいた呼び出し元は、統合後は新メソッドをusesに持つ', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const result = mergeMethods(codebase, request());

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-caller-a')?.fragments[0].uses).toEqual(['method-merged']);
    expect(findMethod(result.value, 'method-caller-b')?.fragments[0].uses).toEqual(['method-merged']);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = fixture();

    // Act
    mergeMethods(codebase, request());

    // Assert
    expect(codebase).toEqual(fixture());
  });

  it.each([
    ['存在しないmethodAId', request({ methodAId: 'missing' }), 'method-not-found'],
    ['存在しないmethodBId', request({ methodBId: 'missing' }), 'method-not-found'],
    ['methodAIdとmethodBIdが同じ', request({ methodBId: 'method-a' }), 'same-method'],
    ['同じクラスの中の2メソッド', request({ methodAId: 'method-a', methodBId: 'method-a-other' }), 'same-class'],
    ['Bがpublic', request({ methodBId: 'method-d' }), 'not-private'],
    ['duplicateGroupの値が違う', request({ methodBId: 'method-h' }), 'shape-mismatch'],
    ['responsibility/labelが同じでもduplicateGroupが無ければ統合できない', request({ methodAId: 'method-e', methodBId: 'method-f' }), 'shape-mismatch'],
    ['Fragmentの個数が違う', request({ methodBId: 'method-g' }), 'shape-mismatch'],
    ['新しい名前が空白だけ', request({ newMethodName: '  ' }), 'empty-method-name'],
    ['統合先に同名メソッドがすでにある', request({ newMethodName: 'mergedLog' }), 'duplicate-method-name'],
  ] as const)('%sときはエラーになる', (_label, invalidRequest, expected) => {
    // Arrange
    const codebase = fixture();

    // Act
    const result = mergeMethods(codebase, invalidRequest);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});

describe('findMergeCandidates', () => {
  it('duplicateGroupが一致する別クラスのprivateメソッドを見つかった順にすべて返す', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const candidates = findMergeCandidates(codebase, 'method-a');

    // Assert
    expect(candidates.map((candidate) => candidate.method.id)).toEqual(['method-b', 'method-c']);
    expect(candidates.map((candidate) => candidate.ownerClassId)).toEqual(['class-b', 'class-c']);
  });

  it('同じクラス内のメソッドは候補にしない', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const candidates = findMergeCandidates(codebase, 'method-a');

    // Assert
    expect(candidates.some((candidate) => candidate.method.id === 'method-a-other')).toBe(false);
  });

  it('publicメソッドは候補にしない', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const candidates = findMergeCandidates(codebase, 'method-a');

    // Assert
    expect(candidates.some((candidate) => candidate.method.id === 'method-d')).toBe(false);
  });

  it('duplicateGroupが設定されていないメソッドは候補にしない(responsibilityが同じでも)', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const candidates = findMergeCandidates(codebase, 'method-e');

    // Assert
    expect(candidates).toEqual([]);
  });

  it('一致する候補が複数クラスにあれば見つかった順に全部返る', () => {
    // Arrange
    const codebase = fixture();

    // Act
    const candidates = findMergeCandidates(codebase, 'method-b');

    // Assert
    expect(candidates.map((candidate) => candidate.method.id)).toEqual(['method-a', 'method-a-other', 'method-c']);
  });
});
