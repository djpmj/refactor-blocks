import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { generateCSharpProject } from './csharpProject';
import type { StageRuntime } from '../stage/StageRuntime';

function codebaseOf(entryOwner: 'A' | 'B'): Codebase {
  const entry = { id: 'm-entry', name: 'run', visibility: 'public' as const, fragments: [{ id: 'f1', label: 'x', lines: 1, responsibility: 'x', code: { csharp: 'Console.WriteLine(1);' } }] };
  return {
    files: [
      { id: 'file-a', path: 'src/A.cs', classes: [{ id: 'c-a', name: 'A', methods: entryOwner === 'A' ? [entry] : [] }] },
      { id: 'file-b', path: 'src/B.cs', classes: [{ id: 'c-b', name: 'B', methods: entryOwner === 'B' ? [entry] : [] }] },
    ],
  };
}

const runtime: StageRuntime = {
  entryMethodId: 'm-entry',
  entryArguments: ['SampleData.Sales()', '3'],
  support: [{ path: 'Sale.cs', code: 'public class Sale { }' }],
};

function contentOf(files: readonly { path: string; content: string }[], path: string): string {
  return files.find((file) => file.path === path)?.content ?? '';
}

describe('generateCSharpProject', () => {
  it('.csproj を1つ作り、net8.0・Exe・ImplicitUsings を入れる', () => {
    // Arrange / Act
    const files = generateCSharpProject(codebaseOf('A'), runtime, 'Demo');
    // Assert
    const projects = files.filter((file) => file.path.endsWith('.csproj'));
    expect(projects.map((file) => file.path)).toEqual(['Demo/Demo.csproj']);
    const xml = projects[0].content;
    expect(xml).toContain('Microsoft.NET.Sdk');
    expect(xml).toContain('<OutputType>Exe</OutputType>');
    expect(xml).toContain('<TargetFramework>net8.0</TargetFramework>');
    expect(xml).toContain('<ImplicitUsings>enable</ImplicitUsings>');
    expect(xml).toContain('<Nullable>disable</Nullable>');
    expect(xml).toContain('<RootNamespace>Demo</RootNamespace>');
  });

  it('ゲームのファイルごとに .cs を1つ作り、パスはそのまま、先頭に namespace を置く', () => {
    // Arrange / Act
    const files = generateCSharpProject(codebaseOf('A'), runtime, 'Demo');
    // Assert
    const a = contentOf(files, 'Demo/src/A.cs');
    expect(a.startsWith('namespace Demo;\n')).toBe(true);
    expect(a).toContain('public partial class A');
    expect(contentOf(files, 'Demo/src/B.cs')).toContain('public partial class B');
  });

  it('.ts など .cs 以外の拡張子は .cs にそろえる', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'src/report/ReportService.ts', classes: [{ id: 'c', name: 'ReportService', methods: [] }] }] };
    // Act
    const paths = generateCSharpProject(codebase, runtime, 'Demo').map((file) => file.path);
    // Assert
    expect(paths).toContain('Demo/src/report/ReportService.cs');
  });

  it.each(['A', 'B'] as const)('Program.cs は入口メソッドの今の持ち主(%s)を呼ぶ', (owner) => {
    // Arrange / Act
    const files = generateCSharpProject(codebaseOf(owner), runtime, 'Demo');
    // Assert
    const program = contentOf(files, 'Demo/Program.cs');
    expect(program).toContain('static async Task Main()');
    expect(program).toContain(`var ${owner.toLowerCase()} = new ${owner}();`);
    expect(program).toContain(`${owner.toLowerCase()}.run(SampleData.Sales(), 3);`);
  });

  it('入口のメソッドが await を含む(async)なら、Program.cs でも await して呼ぶ', () => {
    // Arrange
    const codebase = codebaseOf('A');
    const entry = codebase.files[0].classes[0].methods[0];
    const asyncCodebase: Codebase = {
      files: [{ ...codebase.files[0], classes: [{ ...codebase.files[0].classes[0], methods: [{ ...entry, fragments: [{ ...entry.fragments[0], code: { csharp: 'await Task.Delay(1);' } }] }] }] }, codebase.files[1]],
    };
    // Act
    const program = contentOf(generateCSharpProject(asyncCodebase, runtime, 'Demo'), 'Demo/Program.cs');
    // Assert
    expect(program).toContain('await a.run(SampleData.Sales(), 3);');
  });

  it('runtime.support を Support/ の下にそのまま出す', () => {
    // Arrange / Act
    const files = generateCSharpProject(codebaseOf('A'), runtime, 'Demo');
    // Assert
    expect(contentOf(files, 'Demo/Support/Sale.cs')).toBe('public class Sale { }');
  });

  it('同じ入力からは並び順まで同じ出力になる', () => {
    // Arrange / Act
    const first = generateCSharpProject(codebaseOf('A'), runtime, 'Demo');
    const second = generateCSharpProject(codebaseOf('A'), runtime, 'Demo');
    // Assert
    expect(second).toEqual(first);
    expect(first.map((file) => file.path)).toEqual(['Demo/Demo.csproj', 'Demo/src/A.cs', 'Demo/src/B.cs', 'Demo/Program.cs', 'Demo/Support/Sale.cs']);
  });
});

describe('generateCSharpProject: プレイヤーが入力したパスの正規化(zip-slip 対策)', () => {
  function pathsFor(...paths: string[]): string[] {
    const files = paths.map((path, index) => ({ id: `f${String(index)}`, path, classes: [{ id: `c${String(index)}`, name: `C${String(index)}`, methods: [] }] }));
    return generateCSharpProject({ files }, runtime, 'Demo').map((file) => file.path);
  }

  it.each([
    ['../x.ts', 'Demo/x.cs'],
    ['a/../../x.ts', 'Demo/a/x.cs'],
    ['/etc/x.ts', 'Demo/etc/x.cs'],
    ['..\\x.ts', 'Demo/x.cs'],
    ['src\\sub\\y.ts', 'Demo/src/sub/y.cs'],
    ['C:\\win\\z.ts', 'Demo/win/z.cs'],
    ['./w.ts', 'Demo/w.cs'],
  ])('%s は Demo/ の外に出ない相対パスにする', (input, expected) => {
    // Arrange / Act
    const paths = pathsFor(input);
    // Assert
    expect(paths).toContain(expected);
    expect(paths.every((path) => path.startsWith('Demo/') && !path.includes('..') && !path.includes('\\'))).toBe(true);
  });

  it('拡張子なしのパスには .cs を付ける', () => {
    // Arrange / Act
    const paths = pathsFor('Foo');
    // Assert
    expect(paths).toContain('Demo/Foo.cs');
  });

  it('a.ts と a.cs のように変換後に同名になるパスは連番で避ける', () => {
    // Arrange / Act
    const paths = pathsFor('a.ts', 'a.cs');
    // Assert
    expect(paths).toContain('Demo/a.cs');
    expect(paths).toContain('Demo/a2.cs');
  });

  it('生成する Program.cs や Support/ のファイルと同名になるパスも避ける', () => {
    // Arrange / Act
    const paths = pathsFor('Program.ts', 'Support/Sale.ts');
    // Assert
    expect(new Set(paths.map((path) => path.toLowerCase())).size).toBe(paths.length);
    expect(contentOf(generateCSharpProject({ files: [{ id: 'f', path: 'Program.ts', classes: [] }] }, runtime, 'Demo'), 'Demo/Support/Sale.cs')).toBe('public class Sale { }');
  });

  it('大文字小文字だけが違うパスも別名にする', () => {
    // Arrange / Act
    const paths = pathsFor('A.ts', 'a.ts');
    // Assert
    expect(new Set(paths.map((path) => path.toLowerCase())).size).toBe(paths.length);
  });

  it('パスが空になったら File.cs にする', () => {
    // Arrange / Act
    const paths = pathsFor('../..');
    // Assert
    expect(paths).toContain('Demo/File.cs');
  });
});
