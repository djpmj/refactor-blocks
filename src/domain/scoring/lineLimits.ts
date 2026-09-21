import { allClasses, type Codebase } from '../codebase/Codebase';
import { classLines, fileLines, methodLines } from '../codebase/lineCount';

export type LineLimits = {
  readonly method: number;
  readonly class: number;
  readonly file: number;
};

export type LineLimitViolation = {
  readonly kind: 'method' | 'class' | 'file';
  readonly targetId: string;
  readonly lines: number;
  readonly limit: number;
};

/** ステージごとの行数上限を超えているメソッド・クラス・ファイルを列挙する。 */
export function findLineLimitViolations(codebase: Codebase, limits: LineLimits): LineLimitViolation[] {
  const methodViolations = allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .map((method): LineLimitViolation => ({ kind: 'method', targetId: method.id, lines: methodLines(method), limit: limits.method }));
  const classViolations = allClasses(codebase).map(
    (codeClass): LineLimitViolation => ({ kind: 'class', targetId: codeClass.id, lines: classLines(codeClass), limit: limits.class }),
  );
  const fileViolations = codebase.files.map(
    (file): LineLimitViolation => ({ kind: 'file', targetId: file.id, lines: fileLines(file), limit: limits.file }),
  );
  return [...methodViolations, ...classViolations, ...fileViolations].filter((item) => item.lines > item.limit);
}
