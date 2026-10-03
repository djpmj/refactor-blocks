import { fieldsOf, findClass, findMethod, parentIds, type CodeLanguage, type Codebase, type CodeClass } from './Codebase';
import { CALL_RESPONSIBILITY } from '../scoring/responsibilities';

function renderMethod(codebase: Codebase, method: CodeClass['methods'][number], language: CodeLanguage): string[] {
  const declaration = `    ${method.visibility} void ${method.name}()`;
  if (method.fragments.length === 0) return [`${declaration};`];
  const body = method.fragments.flatMap((fragment) => {
    const explicitCode = fragment.code?.[language];
    const calledMethods = fragment.responsibility === CALL_RESPONSIBILITY
      ? (fragment.uses ?? []).map((methodId) => findMethod(codebase, methodId)).filter((calledMethod) => calledMethod !== undefined)
      : [];
    const inferredCode = calledMethods.map((calledMethod) => `${calledMethod.name}();`).join('\n');
    const code = explicitCode ?? (inferredCode === '' ? undefined : inferredCode);
    return (code ?? `// 未入力: ${fragment.label}`).split('\n').map((line) => `        ${line}`);
  });
  return [`${declaration} {`, ...body, '    }'];
}

/** クラスと各Fragmentに登録されたコードから、読み取り専用のC#疑似ソースを生成する。 */
export function generateClassSource(codebase: Codebase, classId: string, language: CodeLanguage): string {
  const codeClass = findClass(codebase, classId);
  if (codeClass === undefined) return '';
  const parents = parentIds(codeClass).map((id) => findClass(codebase, id)?.name).filter((name) => name !== undefined);
  const inheritance = parents.length === 0 ? '' : ` : ${parents.join(', ')}`;
  const members = [
    ...fieldsOf(codeClass).map((field) => `    ${field.visibility} object ${field.name};`),
    ...codeClass.methods.flatMap((method) => renderMethod(codebase, method, language)),
  ];
  return [`public class ${codeClass.name}${inheritance}`, '{', ...members, '}'].join('\n');
}
