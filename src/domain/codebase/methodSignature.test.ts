import { describe, expect, it } from 'vitest';
import type { Codebase, Fragment, LocalVariable, Method } from './Codebase';
import { inferExtractedSignature, isAsyncMethod } from './methodSignature';

function variable(name: string, type: string): LocalVariable {
  return { name, type: { csharp: type } };
}

function step(id: string, declares: LocalVariable[], uses: string[], code?: string): Fragment {
  return {
    id,
    label: id,
    lines: 1,
    responsibility: 'x',
    variables: { declares, uses },
    ...(code === undefined ? {} : { code: { csharp: code } }),
  };
}

function method(id: string, fragments: Fragment[], parameters: Method['parameters'] = []): Method {
  return { id, name: id, visibility: 'public', parameters, fragments };
}

function codebaseOf(...methods: Method[]): Codebase {
  return { files: [{ id: 'f', path: 'x.cs', classes: [{ id: 'c', name: 'C', methods }] }] };
}

describe('inferExtractedSignature', () => {
  const source = method('m', [
    step('a', [variable('monthly', 'decimal')], ['sales']),
    step('b', [variable('ratio', 'decimal'), variable('label', 'string')], ['monthly']),
    step('c', [], ['ratio', 'label']),
  ], [{ type: 'List<Sale>', name: 'sales' }]);

  it('手前の処理・メソッドの引数が作った変数を使うなら引数になる(宣言順)', () => {
    // Arrange / Act
    const signature = inferExtractedSignature(source, ['b']);
    // Assert
    expect(signature.parameters).toEqual([variable('monthly', 'decimal')]);
    expect(inferExtractedSignature(source, ['a']).parameters).toEqual([variable('sales', 'List<Sale>')]);
  });

  it('中で作って中で使い切る変数は引数にも戻り値にもならない', () => {
    // Arrange / Act
    const signature = inferExtractedSignature(source, ['a', 'b']);
    // Assert
    expect(signature.parameters).toEqual([variable('sales', 'List<Sale>')]);
    expect(signature.returns.map((item) => item.name)).not.toContain('monthly');
  });

  it('後ろの処理が使う変数が戻り値になる(0個・1個・2個以上)', () => {
    // Arrange / Act / Assert
    expect(inferExtractedSignature(source, ['c']).returns).toEqual([]);
    expect(inferExtractedSignature(source, ['a']).returns).toEqual([variable('monthly', 'decimal')]);
    expect(inferExtractedSignature(source, ['b']).returns).toEqual([variable('ratio', 'decimal'), variable('label', 'string')]);
  });

  it('型は変数を作った処理のものを使う', () => {
    // Arrange / Act
    const signature = inferExtractedSignature(source, ['b']);
    // Assert
    expect(signature.returns[0].type.csharp).toBe('decimal');
  });

  it('variables の無い処理だけを抽出すると、引数も戻り値も無い', () => {
    // Arrange
    const plain = method('p', [{ id: 'x', label: 'x', lines: 1, responsibility: 'x' }, { id: 'y', label: 'y', lines: 1, responsibility: 'x' }]);
    // Act
    const signature = inferExtractedSignature(plain, ['x']);
    // Assert
    expect(signature).toEqual({ parameters: [], returns: [] });
  });
});

describe('isAsyncMethod', () => {
  const call = (id: string, target: string): Fragment => ({ id, label: id, lines: 1, responsibility: 'call', uses: [target] });

  it('処理のコードに await を含むメソッドは async', () => {
    // Arrange
    const codebase = codebaseOf(method('m', [step('a', [], [], 'var x = await repo.LoadAsync();')]), method('n', [step('b', [], [], 'x++;')]));
    // Act / Assert
    expect(isAsyncMethod(codebase, 'm')).toBe(true);
    expect(isAsyncMethod(codebase, 'n')).toBe(false);
  });

  it('async なメソッドを呼ぶメソッドも async(推移的)', () => {
    // Arrange
    const codebase = codebaseOf(
      method('top', [call('t', 'mid')]),
      method('mid', [call('u', 'leaf')]),
      method('leaf', [step('a', [], [], 'await Task.Delay(1);')]),
    );
    // Act / Assert
    expect(isAsyncMethod(codebase, 'top')).toBe(true);
  });

  it('呼び出しが循環していても止まる', () => {
    // Arrange
    const codebase = codebaseOf(method('p', [call('a', 'q')]), method('q', [call('b', 'p')]));
    // Act / Assert
    expect(isAsyncMethod(codebase, 'p')).toBe(false);
  });
});

describe('inferExtractedSignature: 元のメソッドの戻り値', () => {
  it('元のメソッドが返す変数を作る処理を抽出すると、その変数が戻り値になる', () => {
    // Arrange
    const source: Method = { ...method('m', [step('a', [variable('x', 'int')], []), step('b', [variable('text', 'string')], ['x'])]), returns: [variable('text', 'string')] };
    // Act
    const signature = inferExtractedSignature(source, ['b']);
    // Assert
    expect(signature.returns).toEqual([variable('text', 'string')]);
  });
});
