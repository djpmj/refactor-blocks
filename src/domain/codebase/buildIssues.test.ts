import { describe, expect, it } from 'vitest';
import type { Codebase, CodeClass, Fragment, Visibility } from './Codebase';
import { findBuildIssues } from './buildIssues';

function callerClass(fragment: Partial<Fragment>): CodeClass {
  return { id: 'c-a', name: 'A', methods: [{ id: 'm-a', name: 'run', visibility: 'public', fragments: [{ id: 'f', label: 'f', lines: 1, responsibility: 'call', ...fragment }] }] };
}

function codebaseWith(options: { readonly callerFragment: Partial<Fragment>; readonly visibility: Visibility; readonly sameClass?: boolean }): Codebase {
  const target = { id: 'm-t', name: 'secret', visibility: options.visibility, fragments: [] };
  const field = { id: 'fld', name: 'balance', visibility: options.visibility };
  const caller = callerClass(options.callerFragment);
  if (options.sameClass === true) {
    return { files: [{ id: 'f1', path: 'A.cs', classes: [{ ...caller, methods: [...caller.methods, target], fields: [field] }] }] };
  }
  const owner: CodeClass = { id: 'c-b', name: 'B', methods: [target], fields: [field] };
  return { files: [{ id: 'f1', path: 'A.cs', classes: [caller] }, { id: 'f2', path: 'B.cs', classes: [owner] }] };
}

describe('findBuildIssues', () => {
  it('同じクラスの private メソッドを呼ぶ処理は問題にしない', () => {
    // Arrange
    const codebase = codebaseWith({ callerFragment: { uses: ['m-t'] }, visibility: 'private', sameClass: true });
    // Act / Assert
    expect(findBuildIssues(codebase)).toEqual([]);
  });

  it('別クラスの private メソッドを uses で呼ぶ処理を1件返す', () => {
    // Arrange
    const codebase = codebaseWith({ callerFragment: { uses: ['m-t'] }, visibility: 'private' });
    // Act
    const issues = findBuildIssues(codebase);
    // Assert
    expect(issues).toEqual([{ classId: 'c-a', methodId: 'm-a', memberName: 'secret', ownerClassId: 'c-b', reason: 'private-member' }]);
  });

  it('別クラスの private フィールドを reads / writes で使う処理を1件ずつ返す', () => {
    // Arrange
    const read = codebaseWith({ callerFragment: { reads: ['fld'] }, visibility: 'private' });
    const write = codebaseWith({ callerFragment: { writes: ['fld'] }, visibility: 'private' });
    // Act / Assert
    expect(findBuildIssues(read)).toEqual([{ classId: 'c-a', methodId: 'm-a', memberName: 'balance', ownerClassId: 'c-b', reason: 'private-member' }]);
    expect(findBuildIssues(write)).toHaveLength(1);
  });

  it('同じメンバーを複数の処理で使っても1件にまとめる', () => {
    // Arrange
    const codebase = codebaseWith({ callerFragment: { uses: ['m-t'], reads: ['fld'], writes: ['fld'] }, visibility: 'private' });
    // Act
    const issues = findBuildIssues(codebase);
    // Assert
    expect(issues.map((issue) => issue.memberName)).toEqual(['secret', 'balance']);
  });

  it.each(['public', 'protected'] as const)('%s のメンバーは問題にしない', (visibility) => {
    // Arrange
    const codebase = codebaseWith({ callerFragment: { uses: ['m-t'], reads: ['fld'] }, visibility });
    // Act / Assert
    expect(findBuildIssues(codebase)).toEqual([]);
  });

  it('実装が複数で bindings が無いインターフェースは ambiguous-binding として返す', () => {
    // Arrange
    const fragment = { id: 'f', label: 'f', lines: 1, responsibility: 'x' };
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [
      { id: 'a', name: 'A', methods: [{ id: 'm', name: 'Run', visibility: 'public', fragments: [{ ...fragment, uses: ['i-do'] }] }] },
      { id: 'i', name: 'IPolicy', methods: [{ id: 'i-do', name: 'Apply', visibility: 'public', fragments: [] }] },
      { id: 'p1', name: 'P1', interfaceIds: ['i'], methods: [{ id: 'p1-do', name: 'Apply', visibility: 'public', fragments: [fragment] }] },
      { id: 'p2', name: 'P2', interfaceIds: ['i'], methods: [{ id: 'p2-do', name: 'Apply', visibility: 'public', fragments: [fragment] }] },
    ] }] };
    // Act
    const unbound = findBuildIssues(codebase);
    const bound = findBuildIssues(codebase, { IPolicy: 'P1' });
    // Assert
    expect(unbound).toEqual([{ classId: 'a', methodId: 'm', memberName: 'IPolicy', ownerClassId: 'i', reason: 'ambiguous-binding' }]);
    expect(bound).toEqual([]);
  });
  describe('継承', () => {
    const fragment = { id: 'f', label: 'f', lines: 1, responsibility: 'x' };
    /** 親 Base が、子 Child のメソッド Hook を呼ぶ。親が Hook の宣言(本体なし)を持つかどうかで変わる。 */
    const hookCodebase = (declared: boolean, childVisibility: Visibility = 'protected'): Codebase => ({ files: [{ id: 'f', path: 'x', classes: [
      { id: 'base', name: 'Base', methods: [
        { id: 'run', name: 'Run', visibility: 'public', fragments: [{ ...fragment, uses: ['child-hook'] }] },
        ...(declared ? [{ id: 'base-hook', name: 'Hook', visibility: 'protected' as const, fragments: [] }] : []),
      ] },
      { id: 'child', name: 'Child', superclassId: 'base', methods: [{ id: 'child-hook', name: 'Hook', visibility: childVisibility, fragments: [fragment] }] },
    ] }] });

    it('親が子のメソッドを呼ぶのに、親に宣言が無ければ hook-not-declared として返す', () => {
      // Arrange / Act
      const issues = findBuildIssues(hookCodebase(false));
      // Assert
      expect(issues).toEqual([{ classId: 'base', methodId: 'run', memberName: 'Hook', ownerClassId: 'child', reason: 'hook-not-declared' }]);
    });

    it('親が同じ名前の抽象メソッドを宣言していれば、問題にしない', () => {
      // Arrange / Act / Assert
      expect(findBuildIssues(hookCodebase(true))).toEqual([]);
    });

    it('抽象メソッドの実装を、宣言より狭い可視性にすると narrow-override として返す', () => {
      // Arrange / Act
      const issues = findBuildIssues(hookCodebase(true, 'private'));
      // Assert
      expect(issues).toContainEqual({ classId: 'child', methodId: 'child-hook', memberName: 'Hook', ownerClassId: 'base', reason: 'narrow-override' });
    });
  });
});
