import type { CodeClass, CodeFile, Method } from './Codebase';

/** メソッドのシグネチャと閉じ括弧の分として、処理の行数に加算する行数。 */
export const METHOD_OVERHEAD_LINES = 2;
/** クラス宣言と閉じ括弧の分として、メソッドの行数合計に加算する行数。 */
export const CLASS_OVERHEAD_LINES = 2;

export function methodLines(method: Method): number {
  return method.fragments.reduce((sum, fragment) => sum + fragment.lines, METHOD_OVERHEAD_LINES);
}

export function classLines(codeClass: CodeClass): number {
  return codeClass.methods.reduce((sum, method) => sum + methodLines(method), CLASS_OVERHEAD_LINES);
}

export function fileLines(file: CodeFile): number {
  return file.classes.reduce((sum, codeClass) => sum + classLines(codeClass), 0);
}
