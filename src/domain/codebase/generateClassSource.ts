import { fieldsOf, findClass, parentIds, type CodeLanguage, type Codebase, type CodeClass } from './Codebase';
import { fragmentCode } from './fragmentCode';

export type SourceLine = {
  readonly text: string;
  /** この行が属する処理の id。クラス宣言・フィールド・メソッド宣言・波括弧・空行は undefined。 */
  readonly fragmentId?: string;
};

function plain(text: string): SourceLine {
  return { text };
}

function renderMethod(codebase: Codebase, method: CodeClass['methods'][number], language: CodeLanguage): SourceLine[] {
  const parameters = (method.parameters ?? []).map((parameter) => `${parameter.type} ${parameter.name}`).join(', ');
  const declaration = `    ${method.visibility} void ${method.name}(${parameters})`;
  if (method.fragments.length === 0) return [plain(`${declaration};`)];
  const body = method.fragments.flatMap((fragment, index) => {
    const code = fragmentCode(codebase, fragment, language);
    const texts = code === undefined
      ? [`        // 未入力: ${fragment.label}`]
      : [`        // ${fragment.label}`, ...code.split('\n').map((line) => `        ${line}`)];
    const lines = texts.map((text): SourceLine => ({ text, fragmentId: fragment.id }));
    return [...(index > 0 ? [plain('')] : []), ...lines];
  });
  return [plain(declaration), plain('    {'), ...body, plain('    }')];
}

/** クラスと各Fragmentに登録されたコードから、読み取り専用のC#風疑似ソースを、行ごとの所属処理つきで生成する。 */
export function generateClassSourceLines(codebase: Codebase, classId: string, language: CodeLanguage): SourceLine[] {
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
  return [plain(`public class ${codeClass.name}${inheritance}`), plain('{'), ...members, plain('}')];
}

export function generateClassSource(codebase: Codebase, classId: string, language: CodeLanguage): string {
  return generateClassSourceLines(codebase, classId, language).map((line) => line.text).join('\n');
}
