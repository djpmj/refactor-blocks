import type { CodeClass, CodeFile, Codebase, Fragment, Method } from './Codebase';
import { fragmentCode } from './fragmentCode';

/** メソッド宣言と波括弧2行の分として、処理の行数に加算する行数。 */
export const METHOD_OVERHEAD_LINES = 3;
/** クラス宣言と波括弧2行の分として、メソッドの行数合計に加算する行数。 */
export const CLASS_OVERHEAD_LINES = 3;

export function fragmentLines(fragment: Fragment, codebase?: Codebase): number {
  const code = codebase === undefined ? fragment.code?.csharp : fragmentCode(codebase, fragment, 'csharp');
  return code === undefined ? fragment.lines : code.split('\n').length + 1;
}

export function methodLines(method: Method, codebase?: Codebase): number {
  return method.fragments.reduce((sum, fragment) => sum + fragmentLines(fragment, codebase), METHOD_OVERHEAD_LINES)
    + Math.max(0, method.fragments.length - 1);
}

export function classLines(codeClass: CodeClass, codebase?: Codebase): number {
  return codeClass.methods.reduce((sum, method) => sum + methodLines(method, codebase), CLASS_OVERHEAD_LINES)
    + Math.max(0, codeClass.methods.length - 1);
}

export function fileLines(file: CodeFile, codebase?: Codebase): number {
  return file.classes.reduce((sum, codeClass) => sum + classLines(codeClass, codebase), 0);
}
