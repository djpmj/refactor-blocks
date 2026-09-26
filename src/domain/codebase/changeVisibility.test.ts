import { describe, expect, it } from 'vitest';
import { changeVisibility } from './changeVisibility';
import { findMethod, type CodeClass, type Codebase, type Fragment } from './Codebase';

function frag(id: string, uses: readonly string[] = []): Fragment {
  return { id, label: id, lines: 3, responsibility: 'x', uses };
}

/**
 * 3クラス構成:
 * - class-owner: 対象メソッド method-target を持つ
 * - class-other: 無関係なクラス(継承関係なし)。callsFromOtherがtrueならmethod-targetを呼ぶ
 * - class-child(superclassId: class-owner): 子クラス。callsFromChildがtrueならmethod-targetを呼ぶ
 */
function codebaseWith(opts: {
  readonly targetVisibility: 'public' | 'private' | 'protected';
  readonly fragments?: readonly Fragment[];
  readonly callsFromOther?: boolean;
  readonly callsFromChild?: boolean;
  readonly callsFromOwner?: boolean;
}): Codebase {
  const { targetVisibility, fragments = [frag('f-target')], callsFromOther = false, callsFromChild = false, callsFromOwner = false } = opts;
  const owner: CodeClass = {
    id: 'class-owner',
    name: 'Owner',
    methods: [
      { id: 'method-target', name: 'target', visibility: targetVisibility, fragments },
      { id: 'method-owner-run', name: 'run', visibility: 'public', fragments: callsFromOwner ? [frag('f-owner-run', ['method-target'])] : [] },
    ],
  };
  const other: CodeClass = {
    id: 'class-other',
    name: 'Other',
    methods: [{ id: 'method-other-run', name: 'run', visibility: 'public', fragments: callsFromOther ? [frag('f-other-run', ['method-target'])] : [] }],
  };
  const child: CodeClass = {
    id: 'class-child',
    name: 'Child',
    superclassId: 'class-owner',
    methods: [{ id: 'method-child-run', name: 'run', visibility: 'public', fragments: callsFromChild ? [frag('f-child-run', ['method-target'])] : [] }],
  };
  return { files: [{ id: 'file', path: 'src/all.ts', classes: [owner, other, child] }] };
}

describe('changeVisibility', () => {
  it('private → public(他クラスから呼ばれている)→ 変わる', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'private', callsFromOther: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'public');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('public');
  });

  it('private → public(自クラスからしか呼ばれていない)→ widening-not-needed', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'private', callsFromOwner: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'public');

    // Assert
    expect(result).toEqual({ ok: false, error: 'widening-not-needed' });
  });

  it('誰からも呼ばれていない private → public も protected も widening-not-needed', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'private' });

    // Act
    const toPublic = changeVisibility(codebase, 'method-target', 'public');
    const toProtected = changeVisibility(codebase, 'method-target', 'protected');

    // Assert
    expect(toPublic).toEqual({ ok: false, error: 'widening-not-needed' });
    expect(toProtected).toEqual({ ok: false, error: 'widening-not-needed' });
  });

  it('private → protected(子クラスから呼ばれている)→ 変わる', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'private', callsFromChild: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'protected');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('protected');
  });

  it('private → protected(無関係なクラスからだけ呼ばれている)→ widening-not-needed', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'private', callsFromOther: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'protected');

    // Assert
    expect(result).toEqual({ ok: false, error: 'widening-not-needed' });
  });

  it('protected → public(子クラスから呼ばれている)→ 変わる', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'protected', callsFromChild: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'public');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('public');
  });

  it('public → private(呼び出し元がなければ)→ 変わる', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public' });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'private');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('private');
  });

  it('public → protected(自クラスからしか呼ばれていなくても)→ 変わる', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public', callsFromOwner: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'protected');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('protected');
  });

  it('protected → private(子クラスからしか呼ばれていなくても)→ 変わる', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'protected', callsFromChild: false });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'private');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('private');
  });

  it('public → private(無関係なクラスから呼ばれている)→ narrowing-breaks-callers', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public', callsFromOther: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'private');

    // Assert
    expect(result).toEqual({ ok: false, error: 'narrowing-breaks-callers' });
  });

  it('public → protected(無関係なクラスから呼ばれている)→ narrowing-breaks-callers', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public', callsFromOther: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'protected');

    // Assert
    expect(result).toEqual({ ok: false, error: 'narrowing-breaks-callers' });
  });

  it('protected → private(子クラスから呼ばれている)→ narrowing-breaks-callers', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'protected', callsFromChild: true });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'private');

    // Assert
    expect(result).toEqual({ ok: false, error: 'narrowing-breaks-callers' });
  });

  it('同じ可視性を指定すると same-visibility', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public' });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'public');

    // Assert
    expect(result).toEqual({ ok: false, error: 'same-visibility' });
  });

  it('存在しないメソッドIDは method-not-found', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public' });

    // Act
    const result = changeVisibility(codebase, 'method-missing', 'private');

    // Assert
    expect(result).toEqual({ ok: false, error: 'method-not-found' });
  });

  it('インターフェース役のクラスの契約メソッド(fragments: [])は変えられない', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [{ id: 'class-i', name: 'I', methods: [{ id: 'method-i', name: 'run', visibility: 'public', fragments: [] }] }],
        },
      ],
    };

    // Act
    const result = changeVisibility(codebase, 'method-i', 'private');

    // Assert
    expect(result).toEqual({ ok: false, error: 'contract-method' });
  });

  it('インターフェース役でないクラスに移された中身のないメソッドも contract-method', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public', fragments: [] });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'private');

    // Assert
    expect(result).toEqual({ ok: false, error: 'contract-method' });
  });

  it('空実装(stub、中身はある)は変えられる', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public', fragments: [{ ...frag('f-target'), stub: true }] });

    // Act
    const result = changeVisibility(codebase, 'method-target', 'private');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-target')?.visibility).toBe('private');
  });

  it('元の Codebase を変更しない', () => {
    // Arrange
    const codebase = codebaseWith({ targetVisibility: 'public' });

    // Act
    changeVisibility(codebase, 'method-target', 'private');

    // Assert
    expect(codebase).toEqual(codebaseWith({ targetVisibility: 'public' }));
  });
});
