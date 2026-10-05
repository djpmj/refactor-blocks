import type { CodeClass, CodeFile, Fragment, Method } from './Codebase';

/** メソッド宣言・波括弧2行の分として、処理の行数に加算する行数。 */
export const METHOD_OVERHEAD_LINES = 3;
/** クラス宣言・波括弧2行の分として、メソッドの行数合計に加算する行数。 */
export const CLASS_OVERHEAD_LINES = 3;

export function fragmentLines(fragment: Fragment): number {
  const code = fragment.code?.csharp;
  return code === undefined ? fragment.lines : code.split('\n').length;
}

export function methodLines(method: Method): number {
  return method.fragments.reduce((sum, fragment) => sum + fragmentLines(fragment), METHOD_OVERHEAD_LINES);
}

export function classLines(codeClass: CodeClass): number {
  return codeClass.methods.reduce((sum, method) => sum + methodLines(method), CLASS_OVERHEAD_LINES)
    + Math.max(0, codeClass.methods.length - 1);
}

export function fileLines(file: CodeFile): number {
  return file.classes.reduce((sum, codeClass) => sum + classLines(codeClass), 0);
}
