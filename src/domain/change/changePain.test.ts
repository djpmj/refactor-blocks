import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { methodLines } from '../codebase/lineCount';
import { fragment, sampleCodebase } from '../codebase/testFixtures';
import type { Stage } from '../stage/Stage';
import { measurePain, painRequestOf } from './changePain';
import type { ChangeRequest } from './ChangeRequest';

const modify: ChangeRequest = { id: 'modify', title: '変更', description: '', responsibility: 'tax', linesPerSite: 2 };
const extend: ChangeRequest = { ...modify, id: 'extend', kind: 'extend' };
const limits = { method: 20, class: 100, file: 100 };
const stage = (codebase: Codebase, changeRequests: readonly ChangeRequest[] = [modify]): Pick<Stage, 'codebase' | 'changeRequests' | 'limits'> => ({ codebase, changeRequests, limits });

describe('painRequestOf', () => {
  it('最初のmodifyを返す。kind省略もmodifyとして扱う', () => {
    // Arrange
    const requests = [extend, modify, { ...modify, id: 'later' }];

    // Act
    const result = painRequestOf({ changeRequests: requests });

    // Assert
    expect(result).toBe(modify);
  });

  it('modifyがなければundefinedを返す', () => {
    // Arrange / Act
    const result = painRequestOf({ changeRequests: [extend] });

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('measurePain', () => {
  it('初期コードと同じなら同じ集計でimprovedではない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = measurePain(stage(codebase), codebase);

    // Assert
    expect(result?.initial).toEqual(result?.current);
    expect(result?.improved).toBe(false);
  });

  it('責務が1メソッドにまとまると変更箇所が減りimprovedになる', () => {
    // Arrange
    const initial: Codebase = { files: [{ id: 'f', path: 'a.ts', classes: [{ id: 'c', name: 'A', methods: ['first', 'second'].map((id) => ({ id, name: id, visibility: 'public' as const, fragments: [fragment(`${id}-tax`, 2, 'tax')] })) }] }] };
    const current: Codebase = { files: [{ id: 'f', path: 'a.ts', classes: [{ id: 'c', name: 'A', methods: [{ id: 'combined', name: 'combined', visibility: 'public', fragments: [fragment('one', 2, 'tax'), fragment('two', 2, 'tax')] }] }] }] };

    // Act
    const result = measurePain(stage(initial), current);

    // Assert
    expect(result?.current.siteIds).toHaveLength(1);
    expect(result?.improved).toBe(true);
  });

  it('変更箇所数が同じでもクラス数またはファイル数の減少でimprovedになる', () => {
    // Arrange
    const initial: Codebase = { files: ['first', 'second'].map((id) => ({ id: `file-${id}`, path: `${id}.ts`, classes: [{ id: `class-${id}`, name: id, methods: [{ id: `method-${id}`, name: id, visibility: 'public' as const, fragments: [fragment(`frag-${id}`, 2, 'tax')] }] }] })) };
    const current: Codebase = { files: [{ id: 'combined-file', path: 'combined.ts', classes: [{ id: 'combined-class', name: 'Combined', methods: ['first', 'second'].map((id) => ({ id: `method-${id}`, name: id, visibility: 'public' as const, fragments: [fragment(`frag-${id}`, 2, 'tax')] })) }] }] };

    // Act
    const result = measurePain(stage(initial), current);

    // Assert
    expect(result?.current.siteIds).toHaveLength(result?.initial.siteIds.length ?? -1);
    expect(result?.improved).toBe(true);
  });

  it('変更箇所数とクラス数・ファイル数が増えてもimprovedではない', () => {
    // Arrange
    const initial = sampleCodebase();
    const extraFile: Codebase = { files: [...initial.files, { id: 'extra', path: 'extra.ts', classes: [{ id: 'extra-class', name: 'Extra', methods: [{ id: 'extra-tax', name: 'extraTax', visibility: 'public', fragments: [fragment('extra-frag', 2, 'tax')] }] }] }] };

    // Act
    const result = measurePain(stage(initial), extraFile);

    // Assert
    expect(result?.improved).toBe(false);
  });

  it('依頼がない、または現コードに該当箇所がない場合はundefined', () => {
    // Arrange
    const codebase = sampleCodebase();
    const noSites: Codebase = { files: [] };

    // Act
    const absentRequest = measurePain(stage(codebase, [extend]), codebase);
    const absentSites = measurePain(stage(codebase), noSites);

    // Assert
    expect(absentRequest).toBeUndefined();
    expect(absentSites).toBeUndefined();
  });
});

describe('measurePain readLines', () => {
  const single = (methods: Codebase['files'][number]['classes'][number]['methods']): Codebase => ({ files: [{ id: 'f', path: 'a.ts', classes: [{ id: 'c', name: 'A', methods }] }] });
  const method = (id: string, fragments: ReturnType<typeof fragment>[]) => ({ id, name: id, visibility: 'public' as const, fragments });

  it('1メソッドならmethodLinesの値になる', () => {
    // Arrange
    const codebase = single([method('m', [fragment('a', 50, 'tax')])]);

    // Act
    const result = measurePain(stage(codebase), codebase);

    // Assert
    expect(result?.current.readLines).toBe(52);
  });

  it('2メソッドなら合計になる', () => {
    // Arrange
    const methods = [method('m1', [fragment('a', 10, 'tax')]), method('m2', [fragment('b', 20, 'tax')])];
    const codebase = single(methods);

    // Act
    const result = measurePain(stage(codebase), codebase);

    // Assert
    expect(result?.current.readLines).toBe(methods.reduce((sum, m) => sum + methodLines(m), 0));
  });

  it('1メソッドに複数の依頼の責務があっても1回だけ数える', () => {
    // Arrange
    const codebase = single([method('m', [fragment('a', 10, 'tax'), fragment('b', 10, 'tax')])]);

    // Act
    const result = measurePain(stage(codebase), codebase);

    // Assert
    expect(result?.current.readLines).toBe(22);
  });

  it('長いメソッドから責務の処理だけ抽出すると読む行数が減りimprovedになる', () => {
    // Arrange
    const initial = single([method('long', [fragment('other', 100, 'x'), fragment('tax', 5, 'tax')])]);
    const current = single([method('long', [fragment('other', 100, 'x')]), method('extracted', [fragment('tax', 5, 'tax')])]);

    // Act
    const result = measurePain(stage(initial), current);

    // Assert
    expect(result?.initial.readLines).toBe(107);
    expect(result?.current.readLines).toBe(7);
    expect(result?.improved).toBe(true);
  });

  it('箇所数・クラス数・ファイル数が同じでもreadLinesが小さければimprovedになる', () => {
    // Arrange
    const initial = single([method('m', [fragment('other', 30, 'x'), fragment('tax', 5, 'tax')])]);
    const current = single([method('m', [fragment('tax', 5, 'tax')])]);

    // Act
    const result = measurePain(stage(initial), current);

    // Assert
    expect(result?.current.siteIds).toHaveLength(1);
    expect(result?.improved).toBe(true);
  });
});
