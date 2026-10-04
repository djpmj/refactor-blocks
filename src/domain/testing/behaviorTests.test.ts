import { describe, expect, it } from 'vitest';
import { mapClasses, type Codebase, type Fragment, type Method } from '../codebase/Codebase';
import { extractMethod } from '../codebase/extractMethod';
import { mergeMethods } from '../codebase/mergeMethods';
import { moveMethod } from '../codebase/moveMethod';
import { behaviorTests, runBehaviorTests, type TestResult } from './behaviorTests';

function frag(id: string, responsibility: string, uses?: readonly string[], extra?: Partial<Fragment>): Fragment {
  return { id, label: `処理${id}`, lines: 2, responsibility, ...(uses === undefined ? {} : { uses }), ...extra };
}

function method(id: string, fragments: readonly Fragment[], visibility: Method['visibility'] = 'public'): Method {
  return { id, name: id, visibility, fragments };
}

/** A.run(入口) → B.helper → B.deep。B.lonely はどこからも呼ばれない別の入口。A.contract は契約。 */
const initial: Codebase = {
  files: [
    {
      id: 'f',
      path: 'a.cs',
      classes: [
        {
          id: 'A',
          name: 'A',
          methods: [method('run', [frag('r1', 'x'), frag('r2', 'y', ['helper'])]), method('contract', [])],
        },
        {
          id: 'B',
          name: 'B',
          methods: [
            method('helper', [frag('h1', 'z', ['deep'])]),
            method('deep', [frag('d1', 'w'), frag('d2', 'stub', undefined, { stub: true })]),
            method('lonely', [frag('l1', 'q')]),
          ],
        },
      ],
    },
  ],
};
const stage = { codebase: initial };

function isGreen(results: readonly TestResult[]): boolean {
  return results.every((result) => result.failures.length === 0);
}

function removeMethod(codebase: Codebase, id: string): Codebase {
  return mapClasses(codebase, (codeClass) => ({ ...codeClass, methods: codeClass.methods.filter((target) => target.id !== id) }));
}

function replaceMethod(codebase: Codebase, id: string, transform: (target: Method) => Method): Codebase {
  return mapClasses(codebase, (codeClass) => ({ ...codeClass, methods: codeClass.methods.map((target) => (target.id === id ? transform(target) : target)) }));
}

describe('behaviorTests', () => {
  it('呼ばれていない処理ありのメソッドが入口になり、契約と呼ばれるメソッドは入口にならない', () => {
    // Arrange & Act
    const tests = behaviorTests(stage);

    // Assert
    expect(tests.map((test) => test.entryMethodId)).toEqual(['run', 'lonely']);
  });

  it('空実装だけのメソッドは入口にならない', () => {
    // Arrange
    const withStub = replaceMethod(initial, 'lonely', (target) => ({ ...target, fragments: [frag('l1', 'q', undefined, { stub: true })] }));

    // Act
    const tests = behaviorTests({ codebase: withStub });

    // Assert
    expect(tests.map((test) => test.entryMethodId)).toEqual(['run']);
  });

  it('expected は呼び出しをたどった処理の鍵で、call と stub は含まない', () => {
    // Arrange
    const withCall = replaceMethod(initial, 'run', (target) => ({ ...target, fragments: [...target.fragments, frag('c', 'call', ['lonely'])] }));

    // Act
    const [first] = behaviorTests({ codebase: withCall });

    // Assert
    expect(first.expected).toEqual(new Set(['x|処理r1', 'y|処理r2', 'z|処理h1', 'w|処理d1', 'q|処理l1']));
  });

  it('呼び出しが輪になっていても止まる', () => {
    // Arrange
    const cyclic = replaceMethod(initial, 'deep', (target) => ({ ...target, fragments: [frag('d1', 'w', ['helper'])] }));

    // Act
    const tests = behaviorTests({ codebase: cyclic });

    // Assert
    expect(tests.map((test) => test.entryMethodId)).toEqual(['run', 'lonely']);
    expect(tests[0].expected).toEqual(new Set(['x|処理r1', 'y|処理r2', 'z|処理h1', 'w|処理d1']));
  });
});

describe('runBehaviorTests', () => {
  const allGreen = (codebase: Codebase) => isGreen(runBehaviorTests(stage, codebase));

  it('初期コードでは全部緑', () => {
    // Arrange & Act & Assert
    expect(allGreen(initial)).toBe(true);
  });

  it('Extract Method しても緑', () => {
    // Arrange
    const result = extractMethod(initial, { sourceMethodId: 'run', fragmentIds: ['r1'], newMethodId: 'ex', newMethodName: 'ex' });
    if (!result.ok) throw new Error('extract failed');

    // Act & Assert
    expect(allGreen(result.value)).toBe(true);
  });

  it('抽出したメソッドを Move Method しても緑', () => {
    // Arrange
    const extracted = extractMethod(initial, { sourceMethodId: 'run', fragmentIds: ['r1'], newMethodId: 'ex', newMethodName: 'ex' });
    if (!extracted.ok) throw new Error('extract failed');
    const moved = moveMethod(extracted.value, 'ex', 'B');
    if (!moved.ok) throw new Error('move failed');

    // Act & Assert
    expect(allGreen(moved.value)).toBe(true);
  });

  it('重複メソッドを mergeMethods で統合しても緑', () => {
    // Arrange
    const duplicate = (id: string) => method(id, [frag(`${id}-f`, 'dup', undefined, { duplicateGroup: 'g', label: '共通処理' })], 'private');
    const base: Codebase = {
      files: [
        {
          id: 'f',
          path: 'a.cs',
          classes: [
            { id: 'A', name: 'A', methods: [method('a', [frag('a1', 'call', ['dupA'])]), duplicate('dupA')] },
            { id: 'B', name: 'B', methods: [method('b', [frag('b1', 'call', ['dupB'])]), duplicate('dupB')] },
          ],
        },
      ],
    };
    const merged = mergeMethods(base, { methodAId: 'dupA', methodBId: 'dupB', newMethodId: 'shared', newMethodName: 'shared' });
    if (!merged.ok) throw new Error('merge failed');

    // Act
    const results = runBehaviorTests({ codebase: base }, merged.value);

    // Assert
    expect(results).toHaveLength(2);
    expect(isGreen(results)).toBe(true);
  });

  it('入口のメソッドの名前を変えても緑', () => {
    // Arrange
    const renamed = replaceMethod(initial, 'run', (target) => ({ ...target, name: 'renamed' }));

    // Act & Assert
    expect(allGreen(renamed)).toBe(true);
  });

  it('入口から届いていた処理が届かなくなると missing で赤', () => {
    // Arrange
    const cut = replaceMethod(initial, 'run', (target) => ({ ...target, fragments: [frag('r1', 'x')] }));

    // Act
    const [first] = runBehaviorTests(stage, cut);

    // Assert
    expect(first.failures).toEqual([{ kind: 'missing', keys: ['y|処理r2', 'z|処理h1', 'w|処理d1'] }]);
  });

  it('新しい処理が届くようになると added で赤', () => {
    // Arrange
    const more = replaceMethod(initial, 'run', (target) => ({ ...target, fragments: [...target.fragments, frag('r3', 'call', ['lonely'])] }));

    // Act
    const [first] = runBehaviorTests(stage, more);

    // Assert
    expect(first.failures).toEqual([{ kind: 'added', keys: ['q|処理l1'] }]);
  });

  it('入口のメソッドが消えると entry-missing で赤', () => {
    // Arrange
    const gone = removeMethod(initial, 'lonely');

    // Act
    const results = runBehaviorTests(stage, gone);

    // Assert
    expect(results[1].failures).toEqual([{ kind: 'entry-missing' }]);
  });

  describe('可視性', () => {
    const privatized = replaceMethod(initial, 'helper', (target) => ({ ...target, visibility: 'private' }));

    it('visibilityEnforced なら、新しく生まれた越境は compile で赤', () => {
      // Arrange & Act
      const [first, second] = runBehaviorTests({ codebase: initial, visibilityEnforced: true }, privatized);

      // Assert
      expect(first.failures).toEqual([{ kind: 'compile', violations: [{ methodId: 'helper', callerClassId: 'A', kind: 'private' }] }]);
      expect(second.failures).toEqual([]);
    });

    it('visibilityEnforced が無ければ同じコードでも緑', () => {
      // Arrange & Act & Assert
      expect(isGreen(runBehaviorTests(stage, privatized))).toBe(true);
    });

    it('初期コードにもともとある越境は赤にしない', () => {
      // Arrange & Act
      const results = runBehaviorTests({ codebase: privatized, visibilityEnforced: true }, privatized);

      // Assert
      expect(isGreen(results)).toBe(true);
    });
  });
});
