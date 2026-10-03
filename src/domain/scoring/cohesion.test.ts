import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Field, Fragment, Method } from '../codebase/Codebase';
import { changeVisibility } from '../codebase/changeVisibility';
import { extractMethod } from '../codebase/extractMethod';
import { sampleCodebase } from '../codebase/testFixtures';
import type { Result } from '../shared/Result';
import { findLowCohesionClasses } from './cohesion';

function field(id: string, name: string, visibility: Field['visibility'] = 'public'): Field {
  return { id, name, visibility };
}

function method(id: string, fragments: readonly Fragment[], visibility: Method['visibility'] = 'public'): Method {
  return { id, name: id, visibility, fragments };
}

function fragment(id: string, options: Partial<Fragment> = {}): Fragment {
  return { id, label: id, lines: 1, responsibility: 'x', ...options };
}

function classOf(id: string, methods: readonly Method[], fields: readonly Field[] = []): CodeClass {
  return { id, name: id, methods, fields };
}

function codebaseOf(classes: readonly CodeClass[]): Codebase {
  return { files: [{ id: 'file', path: 'src/all.ts', classes }] };
}

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
  return result.value;
}

describe('findLowCohesionClasses', () => {
  it('AがxだけB がyだけを触る(呼び合わない) → 2塊', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [method('method-a', [fragment('f-a', { reads: ['field-x'] })]), method('method-b', [fragment('f-b', { reads: ['field-y'] })])],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([{ classId: 'class-C', fieldGroups: [['field-x'], ['field-y']] }]);
  });

  it('Aがx・y、Bがyだけ → 空(フィールドで1塊)', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [
          method('method-a', [fragment('f-a', { reads: ['field-x', 'field-y'] })]),
          method('method-b', [fragment('f-b', { reads: ['field-y'] })]),
        ],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('AがxだけBがyだけだが、AがBを呼ぶ → 空(呼び出しでつながる)', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [
          method('method-a', [fragment('f-a', { reads: ['field-x'], uses: ['method-b'] })]),
          method('method-b', [fragment('f-b', { reads: ['field-y'] })]),
        ],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('BがAを呼ぶ向きでも空', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [
          method('method-a', [fragment('f-a', { reads: ['field-x'] })]),
          method('method-b', [fragment('f-b', { reads: ['field-y'], uses: ['method-a'] })]),
        ],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('Aがx、Bがy、C(フィールドを触らない)がAとBを呼ぶ → 空(1塊につながる)', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [
          method('method-a', [fragment('f-a', { reads: ['field-x'] })]),
          method('method-b', [fragment('f-b', { reads: ['field-y'] })]),
          method('method-c', [fragment('f-c', { uses: ['method-a', 'method-b'] })]),
        ],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('Aがx、Bがy、Cがどのフィールドも触らず誰も呼ばない → 塊は2つ', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [
          method('method-a', [fragment('f-a', { reads: ['field-x'] })]),
          method('method-b', [fragment('f-b', { reads: ['field-y'] })]),
          method('method-c', [fragment('f-c', {})]),
        ],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([{ classId: 'class-C', fieldGroups: [['field-x'], ['field-y']] }]);
  });

  it('getter/setterだけのクラス(xのget/set、yのget) → 2塊。業務メソッドが両方呼ぶと1塊', () => {
    // Arrange
    const withoutCaller = codebaseOf([
      classOf(
        'class-C',
        [
          method('method-get-x', [fragment('f-get-x', { reads: ['field-x'] })]),
          method('method-set-x', [fragment('f-set-x', { writes: ['field-x'] })]),
          method('method-get-y', [fragment('f-get-y', { reads: ['field-y'] })]),
        ],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);
    const withCaller = codebaseOf([
      classOf(
        'class-C',
        [
          method('method-get-x', [fragment('f-get-x', { reads: ['field-x'] })]),
          method('method-set-x', [fragment('f-set-x', { writes: ['field-x'] })]),
          method('method-get-y', [fragment('f-get-y', { reads: ['field-y'] })]),
          method('method-run', [fragment('f-run', { uses: ['method-get-x', 'method-get-y'] })]),
        ],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);

    // Act
    const without = findLowCohesionClasses(withoutCaller);
    const withCall = findLowCohesionClasses(withCaller);

    // Assert
    expect(without).toEqual([{ classId: 'class-C', fieldGroups: [['field-x'], ['field-y']] }]);
    expect(withCall).toEqual([]);
  });

  it('契約メソッドだけのインターフェース役・空実装だけのクラス → 空', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-I', [method('method-a', []), method('method-b', [])], [field('field-x', 'x'), field('field-y', 'y')]),
      classOf(
        'class-Stub',
        [method('method-c', [fragment('f-c', { stub: true })]), method('method-d', [fragment('f-d', { stub: true })])],
        [field('field-p', 'p'), field('field-q', 'q')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('フィールドを持たないクラス → 空', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('他クラスのフィールドだけを触るメソッドは、どの塊にも入らない', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-C', [method('method-a', [fragment('f-a', { reads: ['field-other'] })])], [field('field-x', 'x')]),
      classOf('class-D', [], [field('field-other', 'other')]),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('継承元のフィールドを触るメソッドは、自クラスのフィールドを触ったことにならない', () => {
    // Arrange
    const parent = classOf('class-Parent', [], [field('field-p', 'p')]);
    const child = classOf(
      'class-Child',
      [
        method('method-a', [fragment('f-a', { reads: ['field-x'] })]),
        method('method-b', [fragment('f-b', { reads: ['field-y'] })]),
        method('method-c', [fragment('f-c', { reads: ['field-p'] })]),
      ],
      [field('field-x', 'x'), field('field-y', 'y')],
    );
    const codebase = codebaseOf([parent, { ...child, superclassId: 'class-Parent' }]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([{ classId: 'class-Child', fieldGroups: [['field-x'], ['field-y']] }]);
  });

  it('どのメソッドも触らないフィールドはfieldGroupsに出ない', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [method('method-a', [fragment('f-a', { reads: ['field-x'] })]), method('method-b', [fragment('f-b', { reads: ['field-y'] })])],
        [field('field-x', 'x'), field('field-y', 'y'), field('field-z', 'z')],
      ),
    ]);

    // Act
    const result = findLowCohesionClasses(codebase);

    // Assert
    expect(result).toEqual([{ classId: 'class-C', fieldGroups: [['field-x'], ['field-y']] }]);
  });

  it('Extract Method の前後で結果が変わらない', () => {
    // Arrange
    const before = codebaseOf([
      classOf('class-C', [method('method-a', [fragment('f-a', { reads: ['field-x'] }), fragment('f-b', { reads: ['field-y'] })])], [
        field('field-x', 'x'),
        field('field-y', 'y'),
      ]),
    ]);
    const extracted = unwrap(
      extractMethod(before, { sourceMethodId: 'method-a', fragmentIds: ['f-b'], newMethodId: 'method-extracted', newMethodName: 'extracted' }),
    );

    // Act
    const beforeResult = findLowCohesionClasses(before);
    const afterResult = findLowCohesionClasses(extracted);

    // Assert
    expect(beforeResult).toEqual([]);
    expect(afterResult).toEqual([]);
  });

  it('可視性を変えても結果が変わらない', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf(
        'class-C',
        [method('method-a', [fragment('f-a', { reads: ['field-x'] })]), method('method-b', [fragment('f-b', { reads: ['field-y'] })])],
        [field('field-x', 'x'), field('field-y', 'y')],
      ),
    ]);
    const changed = unwrap(changeVisibility(codebase, 'method-a', 'private'));

    // Act
    const before = findLowCohesionClasses(codebase);
    const after = findLowCohesionClasses(changed);

    // Assert
    expect(before).toEqual(after);
  });
});
