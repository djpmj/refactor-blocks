import type { StageRuntime } from '../stage/StageRuntime';
import { allClasses, findClassOfMethod, findMethod, type Codebase, type CodeClass } from './Codebase';
import { compositionOrder, implementersOf, type CompositionPlan } from './csharpWiring';
import { generateClassSource } from './generateClassSource';
import { isAsyncMethod } from './methodSignature';
import { uniqueName } from './naming';

/** ダウンロードするプロジェクトの名前(名前空間)。補助コード(runtime.support)はこの名前空間に書く。 */
export const csharpProjectName = 'RefactorBlocks';

export type ProjectFile = { readonly path: string; readonly content: string };

function csproj(projectName: string): string {
  return [
    '<Project Sdk="Microsoft.NET.Sdk">',
    '',
    '  <PropertyGroup>',
    '    <OutputType>Exe</OutputType>',
    '    <TargetFramework>net8.0</TargetFramework>',
    '    <ImplicitUsings>enable</ImplicitUsings>',
    '    <Nullable>disable</Nullable>',
    `    <RootNamespace>${projectName}</RootNamespace>`,
    '  </PropertyGroup>',
    '',
    '</Project>',
    '',
  ].join('\n');
}

/** bindings で選んだ実装(interface を実装している手順だけ)。まだ実装していない手順では undefined。 */
function boundImplementation(codebase: Codebase, runtime: StageRuntime, interfaceName: string): CodeClass | undefined {
  const contract = allClasses(codebase).find((codeClass) => codeClass.name === interfaceName);
  const bound = contract === undefined ? undefined : implementersOf(codebase, contract.id).find((codeClass) => codeClass.name === runtime.bindings?.[interfaceName]);
  return bound?.id === contract?.id ? undefined : bound;
}

/** bindings で選んだ実装が、そのインターフェースを実装している手順だけ、補助コードの呼び出し(runtime.bindingDemos)を返す。 */
function bindingDemoLines(codebase: Codebase, runtime: StageRuntime, plan: CompositionPlan): string[] {
  return Object.entries(runtime.bindingDemos ?? {}).flatMap(([interfaceName, statement]) => {
    const bound = boundImplementation(codebase, runtime, interfaceName);
    const variable = plan.steps.find((step) => step.classId === bound?.id)?.variable;
    return variable === undefined ? [] : [statement.replaceAll('{0}', variable)];
  });
}

/**
 * 実行すると出るはずの `[bindings] <選んだ実装のクラス名>.<操作名>` の見出し行(各 `BindingDemo.Run("操作名", ...)` から取る)。
 * scripts/verify-csharp.sh が、完成形の実行結果の見出し行とこれが一致するかで、選んだ実装が実際に呼ばれたことを確かめる。
 */
export function expectedBindingLines(codebase: Codebase, runtime: StageRuntime): string[] {
  return Object.entries(runtime.bindingDemos ?? {}).flatMap(([interfaceName, statements]) => {
    const bound = boundImplementation(codebase, runtime, interfaceName);
    return bound === undefined ? [] : [...statements.matchAll(/BindingDemo\.Run\("([^"]+)"/g)].map((match) => `[bindings] ${bound.name}.${match[1]}`);
  });
}

function program(codebase: Codebase, runtime: StageRuntime, projectName: string): string {
  const plan = compositionOrder(codebase, runtime.bindings);
  const owner = findClassOfMethod(codebase, runtime.entryMethodId);
  const method = findMethod(codebase, runtime.entryMethodId);
  const entryVariable = plan.steps.find((step) => step.classId === owner?.id)?.variable;
  const awaiting = method !== undefined && isAsyncMethod(codebase, method.id) ? 'await ' : '';
  const call = entryVariable === undefined || method === undefined
    ? '// 入口のメソッドが見つかりません'
    : `${awaiting}${entryVariable}.${method.name}(${runtime.entryArguments.join(', ')});`;
  const body = [
    ...plan.steps.map((step) => `var ${step.variable} = new ${step.className}(${step.args.join(', ')});`),
    ...plan.lateAssignments.map((assignment) => `${assignment.variable}.${assignment.property} = ${assignment.value};`),
    call,
    ...bindingDemoLines(codebase, runtime, plan),
    'await Task.CompletedTask;',
  ].map((line) => `        ${line}`);
  return [`namespace ${projectName};`, '', 'public static class Program', '{', '    public static async Task Main()', '    {', ...body, '    }', '}', ''].join('\n');
}

// Windows のファイル名に使えない文字と制御文字(コードポイント 0〜31)
const unsafeNameChars = new RegExp(String.raw`[<>:"|?*\x00-\x1f]`, 'g');

/** プレイヤーが入力したパスを、プロジェクトの中に収まる相対パス(`/` 区切り・`.cs` 終わり)にする。`..`・絶対パス・バックスラッシュ・ドライブ文字は無害化する。 */
function sanitizeSourcePath(rawPath: string): string {
  const segments = rawPath
    .replaceAll('\\', '/')
    .split('/')
    .map((segment) => segment.replaceAll(unsafeNameChars, '_').trim())
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..' && !/^[A-Za-z]_$/.test(segment));
  const last = segments.pop() ?? 'File';
  const stem = last.replace(/\.[^.]*$/, '').replace(/^\.+/, '');
  return [...segments, `${stem === '' ? 'File' : stem}.cs`].join('/');
}

/** 大文字小文字を無視して重複しないよう、`A.cs` が使われていれば `A2.cs`, `A3.cs`... にする。 */
function uniqueSourcePath(path: string, taken: Set<string>): string {
  const stem = path.slice(0, -'.cs'.length);
  const name = uniqueName(stem, (candidate) => taken.has((candidate + '.cs').toLowerCase()));
  const unique = name + '.cs';
  taken.add(unique.toLowerCase());
  return unique;
}

/** ゲームの今のコードを、Visual Studio で開いてビルド・デバッグ実行できる C# コンソールアプリのファイル一式にする。 */
export function generateCSharpProject(codebase: Codebase, runtime: StageRuntime, projectName: string): readonly ProjectFile[] {
  // 生成側で決まっているファイルと、ゲーム側のファイルが同名にならないようにする
  const taken = new Set(['program.cs', ...runtime.support.map((support) => `support/${support.path}`.toLowerCase())]);
  const sources = codebase.files.map((file) => {
    const classes = file.classes.map((codeClass) => generateClassSource(codebase, codeClass.id, 'csharp', 'public partial class'));
    return { path: `${projectName}/${uniqueSourcePath(sanitizeSourcePath(file.path), taken)}`, content: `namespace ${projectName};\n\n${classes.join('\n\n')}\n` };
  });
  return [
    { path: `${projectName}/${projectName}.csproj`, content: csproj(projectName) },
    ...sources,
    { path: `${projectName}/Program.cs`, content: program(codebase, runtime, projectName) },
    ...runtime.support.map((support) => ({ path: `${projectName}/Support/${support.path}`, content: support.code })),
  ];
}
