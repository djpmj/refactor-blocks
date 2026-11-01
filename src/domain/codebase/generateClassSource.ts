import { fieldsOf, findClass, parentIds, type LocalVariable, type CodeLanguage, type Codebase, type CodeClass } from './Codebase';
import { isAsyncMethod } from './methodSignature';
import { fragmentCode } from './fragmentCode';

export type SourceLine = {
  readonly text: string;
  /** この行が属する処理の id。クラス宣言・フィールド・メソッド宣言・波括弧・空行は undefined。 */
  readonly fragmentId?: string;
};

/** クラス宣言の頭。画面の疑似ソースは 'public class'、C#プロジェクトは補助コードから足せるよう 'public partial class'。 */
export type ClassDeclaration = 'public class' | 'public partial class';

function plain(text: string): SourceLine {
  return { text };
}

function typeOf(item: LocalVariable, language: CodeLanguage): string {
  return item.type[language] ?? 'object';
}

function plainReturnType(returns: readonly LocalVariable[], language: CodeLanguage): string | undefined {
  if (returns.length === 0) return undefined;
  if (returns.length === 1) return typeOf(returns[0], language);
  const items = returns.map((item) => `${typeOf(item, language)} ${item.name}`);
  return `(${items.join(', ')})`;
}

/** 戻り値の数に応じた型。0個は void、1個は T、2個以上は名前付きタプル。async なら Task で包む。 */
function returnType(returns: readonly LocalVariable[], isAsync: boolean, language: CodeLanguage): string {
  const plainType = plainReturnType(returns, language);
  if (!isAsync) return plainType ?? 'void';
  return plainType === undefined ? 'async Task' : `async Task<${plainType}>`;
}

function returnStatement(returns: readonly LocalVariable[]): string {
  return returns.length === 1 ? `return ${returns[0].name};` : `return (${returns.map((item) => item.name).join(', ')});`;
}

function renderMethod(codebase: Codebase, method: CodeClass['methods'][number], language: CodeLanguage): SourceLine[] {
  const parameters = (method.parameters ?? []).map((parameter) => `${parameter.type} ${parameter.name}`).join(', ');
  const returns = method.returns ?? [];
  const type = returnType(returns, isAsyncMethod(codebase, method.id), language);
  const declaration = `    ${method.visibility} ${type} ${method.name}(${parameters})`;
  if (method.fragments.length === 0) return [plain(`${declaration};`)];
  const body = method.fragments.flatMap((fragment, index) => {
    const code = fragmentCode(codebase, fragment, language);
    const texts = code === undefined
      ? [`        // 未入力: ${fragment.label}`]
      : [`        // ${fragment.label}`, ...code.split('\n').map((line) => `        ${line}`)];
    const lines = texts.map((text): SourceLine => ({ text, fragmentId: fragment.id }));
    return [...(index > 0 ? [plain('')] : []), ...lines];
  });
  const returnLines = returns.length === 0 ? [] : [plain(`        ${returnStatement(returns)}`)];
  return [plain(declaration), plain('    {'), ...body, ...returnLines, plain('    }')];
}

/** クラスと各Fragmentに登録されたコードから、読み取り専用のC#風疑似ソースを、行ごとの所属処理つきで生成する。 */
export function generateClassSourceLines(codebase: Codebase, classId: string, language: CodeLanguage, declaration: ClassDeclaration = 'public class'): SourceLine[] {
  const codeClass = findClass(codebase, classId);
  if (codeClass === undefined) return [];
  const parents = parentIds(codeClass).map((id) => findClass(codebase, id)?.name).filter((name) => name !== undefined);
  const inheritance = parents.length === 0 ? '' : ` : ${parents.join(', ')}`;
  const fields = fieldsOf(codeClass).flatMap((field) => {
    const type = field.type?.[language];
    if (type === undefined) return [plain(`    // 未入力: フィールド ${field.name}`)];
    return [
      ...(field.description === undefined ? [] : [plain(`    // ${field.description}`)]),
      plain(`    ${field.visibility} ${type} ${field.name};`),
    ];
  });
  const methods = codeClass.methods.flatMap((method, index) => [
    ...(index > 0 ? [plain('')] : []),
    ...renderMethod(codebase, method, language),
  ]);
  const members = [...fields, ...(fields.length > 0 && methods.length > 0 ? [plain('')] : []), ...methods];
  return [plain(`${declaration} ${codeClass.name}${inheritance}`), plain('{'), ...members, plain('}')];
}

export function generateClassSource(codebase: Codebase, classId: string, language: CodeLanguage, declaration: ClassDeclaration = 'public class'): string {
  return generateClassSourceLines(codebase, classId, language, declaration).map((line) => line.text).join('\n');
}
