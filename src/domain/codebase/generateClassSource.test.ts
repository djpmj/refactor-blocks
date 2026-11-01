import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { extractMethod } from './extractMethod';
import { generateClassSource, generateClassSourceLines } from './generateClassSource';
import { renameMethod } from './renameMethod';

describe('generateClassSource', () => {
  it('adds a label comment before coded fragments and separates later fragments with a blank line', () => {
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'm', name: 'run', visibility: 'public', fragments: [
        { id: 'a', label: 'first work', lines: 1, responsibility: 'x', code: { csharp: 'first();' } },
        { id: 'b', label: 'second work', lines: 2, responsibility: 'x', code: { csharp: '// existing note\nsecond();' } },
      ] },
    ] }] }] };

    const source = generateClassSource(codebase, 'c', 'csharp');

    expect(source).toContain('        // first work\n        first();\n\n        // second work\n        // existing note\n        second();');
  });

  it('renders the class, method, and fragment code in order', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Report', methods: [{ id: 'm', name: 'run', visibility: 'public', fragments: [{ id: 'a', label: 'a', lines: 1, responsibility: 'x', code: { csharp: 'var x = 1;' } }, { id: 'b', label: 'b', lines: 1, responsibility: 'x', code: { csharp: 'print(x);' } }] }] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    const classIndex = source.indexOf('public class Report');
    const methodIndex = source.indexOf('public void run()');
    const firstFragmentIndex = source.indexOf('var x = 1;');
    const secondFragmentIndex = source.indexOf('print(x);');
    expect(classIndex).toBeGreaterThanOrEqual(0);
    expect(methodIndex).toBeGreaterThan(classIndex);
    expect(firstFragmentIndex).toBeGreaterThan(methodIndex);
    expect(secondFragmentIndex).toBeGreaterThan(firstFragmentIndex);
    expect(source).toContain('    public void run()\n    {');
  });

  it('renders a placeholder only where fragment code is missing', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'm', name: 'run', visibility: 'protected', fragments: [{ id: 'a', label: '未実装処理', lines: 1, responsibility: 'x' }] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('// 未入力: 未実装処理');
  });

  it('renders calls for call fragments using the current names of referenced methods', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'old label', lines: 1, responsibility: 'call', uses: ['target'] }] },
      { id: 'target', name: 'work', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('work();');
    expect(source).not.toContain('未入力');
  });

  it('renders multiple calls in uses order', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'calls', lines: 1, responsibility: 'call', uses: ['a', 'b'] }] },
      { id: 'a', name: 'a', visibility: 'private', fragments: [] },
      { id: 'b', name: 'b', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source.indexOf('a();')).toBeLessThan(source.indexOf('b();'));
    expect(source).toContain('        a();\n        b();');
  });

  it('renders declared call arguments and matching method parameters', () => {
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Cart', methods: [
      { id: 'caller', name: 'checkout', visibility: 'public', fragments: [{ id: 'call', label: 'calls helper', lines: 1, responsibility: 'call', uses: ['target'], callArguments: ['order'] }] },
      { id: 'target', name: 'calculateShippingFee', visibility: 'private', parameters: [{ type: 'Order', name: 'order' }], fragments: [] },
    ] }] }] };

    const source = generateClassSource(codebase, 'c', 'csharp');

    expect(source).toContain('calculateShippingFee(order);');
    expect(source).toContain('private void calculateShippingFee(Order order);');
  });

  it('prefers explicit code on call fragments', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'calls', lines: 1, responsibility: 'call', uses: ['target'], code: { csharp: 'customCall();' } }] },
      { id: 'target', name: 'target', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('customCall();');
    expect(source).not.toContain('        target();');
  });

  it('keeps the placeholder for call fragments with empty or unresolved uses', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [
        { id: 'empty', label: 'empty target', lines: 1, responsibility: 'call', uses: [] },
        { id: 'missing', label: 'missing target', lines: 1, responsibility: 'call', uses: ['gone'] },
      ] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('// 未入力: empty target');
    expect(source).toContain('// 未入力: missing target');
  });

  it('renders renamed extracted methods through their call fragments', () => {
    // Arrange
    const original: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'source', name: 'run', visibility: 'public', fragments: [
        { id: 'before', label: 'before', lines: 1, responsibility: 'x', code: { csharp: 'before();' } },
        { id: 'selected', label: 'selected', lines: 1, responsibility: 'x', code: { csharp: 'selected();' } },
      ] },
    ] }] }] };
    const extracted = extractMethod(original, { sourceMethodId: 'source', fragmentIds: ['selected'], newMethodId: 'new', newMethodName: 'oldName' });
    if (!extracted.ok) throw new Error('extract should succeed');
    const renamed = renameMethod(extracted.value, 'new', 'newName');
    if (!renamed.ok) throw new Error('rename should succeed');
    // Act
    const source = generateClassSource(renamed.value, 'c', 'csharp');
    // Assert
    expect(source).toContain('newName();');
    expect(source).not.toContain('oldName();');
  });

  it('does not infer calls for non-call fragments even when uses resolve', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'work', label: 'work', lines: 1, responsibility: 'x', uses: ['target'] }] },
      { id: 'target', name: 'target', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('// 未入力: work');
    expect(source).not.toContain('        target();');
  });

  it('renders fields in declaration order', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', fields: [
      { id: 'first', name: 'value', visibility: 'private', description: '数値', type: { csharp: 'decimal' } },
      { id: 'second', name: 'title', visibility: 'public', type: { csharp: 'string' } },
    ], methods: [] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('// 数値\n    private decimal value;');
    expect(source).toContain('public string title;');
    expect(source.indexOf('private decimal value;')).toBeLessThan(source.indexOf('public string title;'));
  });

  it('renders a placeholder when a field has no type for the selected language', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', fields: [
      { id: 'unknown', name: 'value', visibility: 'private', description: '値' },
    ], methods: [] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('    // 未入力: フィールド value');
    expect(source).not.toContain('object');
  });

  it('separates fields from methods and methods from each other by one blank line', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', fields: [
      { id: 'field', name: 'value', visibility: 'private', type: { csharp: 'object' } },
    ], methods: [
      { id: 'first', name: 'first', visibility: 'public', fragments: [{ id: 'a', label: 'a', lines: 1, responsibility: 'x', code: { csharp: 'firstWork();' } }] },
      { id: 'second', name: 'second', visibility: 'private', fragments: [{ id: 'b', label: 'b', lines: 1, responsibility: 'x', code: { csharp: 'secondWork();' } }] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('private object value;\n\n    public void first()\n    {');
    expect(source).toContain('    }\n\n    private void second()\n    {');
  });

  it('does not add blank lines around a single method without fields', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'run', name: 'run', visibility: 'public', fragments: [{ id: 'a', label: 'a', lines: 1, responsibility: 'x', code: { csharp: 'work();' } }] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toBe('public class Thing\n{\n    public void run()\n    {\n        // a\n        work();\n    }\n}');
  });

  it('renders the superclass and interfaces in order and ignores missing parent IDs', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [
      { id: 'parent', name: 'Base', methods: [] }, { id: 'iface', name: 'IThing', methods: [] },
      { id: 'c', name: 'Thing', superclassId: 'parent', interfaceIds: ['iface', 'gone'], methods: [] },
    ] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('public class Thing : Base, IThing');
    expect(source).not.toContain('gone');
  });

  it('renders contract methods without a body', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'contract', name: 'contract', visibility: 'public', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('public void contract();');
    expect(source).not.toContain('public void contract() {');
  });

  it('returns empty string for an unknown class', () => {
    // Arrange
    const codebase: Codebase = { files: [] };
    // Act
    const source = generateClassSource(codebase, 'missing', 'csharp');
    // Assert
    expect(source).toBe('');
  });
});

describe('generateClassSourceLines(行ごとのソース)', () => {
  const twoFragments: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', fields: [{ id: 'fd', name: 'count', visibility: 'private', type: { csharp: 'int' } }], methods: [
    { id: 'm', name: 'run', visibility: 'public', fragments: [
      { id: 'a', label: 'first work', lines: 1, responsibility: 'x', code: { csharp: 'first();' } },
      { id: 'b', label: 'second work', lines: 1, responsibility: 'x' },
    ] },
  ] }] }] };

  it('行を連結すると generateClassSource と同じ文字列になる', () => {
    // Arrange / Act
    const text = generateClassSourceLines(twoFragments, 'c', 'csharp').map((line) => line.text).join('\n');
    // Assert
    expect(text).toBe(generateClassSource(twoFragments, 'c', 'csharp'));
  });

  it('処理の行にはFragment IDが付き、構造の行と空行には付かない', () => {
    // Arrange / Act
    const lines = generateClassSourceLines(twoFragments, 'c', 'csharp');
    // Assert
    const tagged = lines.map((line) => `${line.fragmentId ?? '-'}:${line.text.trim()}`);
    expect(tagged).toEqual([
      '-:public class Thing', '-:{', '-:private int count;', '-:', '-:public void run()', '-:{',
      'a:// first work', 'a:first();', '-:', 'b:// 未入力: second work', '-:}', '-:}',
    ]);
  });

  it('存在しないクラスでは行を返さない', () => {
    // Arrange / Act / Assert
    expect(generateClassSourceLines(twoFragments, 'none', 'csharp')).toEqual([]);
    expect(generateClassSource(twoFragments, 'none', 'csharp')).toBe('');
  });
});

describe('generateClassSourceLines の引数・戻り値・async', () => {
  const decl = (name: string, type: string) => ({ name, type: { csharp: type } });
  const code = (id: string, text: string) => ({ id, label: id, lines: 1, responsibility: 'x', code: { csharp: text } });
  const call = (id: string, target: string, args: string) => ({ id, label: id, lines: 1, responsibility: 'call', uses: [target], callArguments: [args] });
  function codebaseOf(methods: Codebase['files'][number]['classes'][number]['methods']): Codebase {
    return { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'C', methods }] }] };
  }

  it('戻り値1個のメソッドは型付きの宣言になり、末尾に return が出る', () => {
    // Arrange
    const codebase = codebaseOf([{ id: 't', name: 'CalculateTax', visibility: 'private', parameters: [{ type: 'decimal', name: 'subtotal' }], returns: [decl('taxAmount', 'decimal')], fragments: [code('a', 'var taxAmount = subtotal * 0.1m;')] }]);
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('    private decimal CalculateTax(decimal subtotal)');
    expect(source).toContain('        return taxAmount;\n    }');
  });

  it('戻り値2個は名前付きタプルになり、呼び出し側は var (a, b) = M(...); になる', () => {
    // Arrange
    const codebase = codebaseOf([
      { id: 'm', name: 'Run', visibility: 'public', fragments: [call('k', 't', 'x')] },
      { id: 't', name: 'Split', visibility: 'private', parameters: [{ type: 'int', name: 'x' }], returns: [decl('a', 'int'), decl('b', 'string')], fragments: [code('s', 'var a = x;')] },
    ]);
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('private (int a, string b) Split(int x)');
    expect(source).toContain('        return (a, b);');
    expect(source).toContain('        var (a, b) = Split(x);');
  });

  it('async なメソッドは async Task<T> になり、呼び出し側(も async)に await が付く', () => {
    // Arrange
    const codebase = codebaseOf([
      { id: 'm', name: 'Run', visibility: 'public', fragments: [call('k', 't', '')] },
      { id: 't', name: 'Load', visibility: 'private', returns: [decl('rows', 'List<int>')], fragments: [code('s', 'var rows = await repo.LoadAsync();')] },
    ]);
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('private async Task<List<int>> Load()');
    expect(source).toContain('public async Task Run()');
    expect(source).toContain('        var rows = await Load();');
  });

  it('戻り値の無い async メソッドは async Task になる', () => {
    // Arrange
    const codebase = codebaseOf([{ id: 't', name: 'Save', visibility: 'private', fragments: [code('s', 'await repo.SaveAsync();')] }]);
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('private async Task Save()');
  });

  it('return 行はどの処理にも属さない', () => {
    // Arrange
    const codebase = codebaseOf([{ id: 't', name: 'F', visibility: 'private', returns: [decl('v', 'int')], fragments: [code('s', 'var v = 1;')] }]);
    // Act
    const lines = generateClassSourceLines(codebase, 'c', 'csharp');
    // Assert
    expect(lines.find((line) => line.text.includes('return v;'))?.fragmentId).toBeUndefined();
  });
});
