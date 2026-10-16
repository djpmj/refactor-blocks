import { allClasses, type Codebase, type CodeClass } from '../codebase/Codebase';

export type ResponsibilityViolation = {
  readonly classId: string;
  readonly responsibilities: number;
  readonly limit: number;
};

/** 抽出したメソッドの呼び出し行。処理そのものではないので責務としては数えない。 */
export const CALL_RESPONSIBILITY = 'call';

/** クラスの処理が持つ責務の種類(CALL_RESPONSIBILITY を除く)。出現順、重複なし。 */
export function classResponsibilities(codeClass: CodeClass): readonly string[] {
  return [...new Set(
    codeClass.methods
      .flatMap((method) => method.fragments)
      .map((fragment) => fragment.responsibility)
      .filter((responsibility) => responsibility !== CALL_RESPONSIBILITY),
  )];
}

/** 1クラスの中の処理が持つ責務(Fragment の responsibility)の種類数が、上限を超えているクラスを列挙する。 */
export function findResponsibilityViolations(codebase: Codebase, limit: number): ResponsibilityViolation[] {
  return allClasses(codebase)
    .map((codeClass): ResponsibilityViolation => {
      return { classId: codeClass.id, responsibilities: classResponsibilities(codeClass).length, limit };
    })
    .filter((item) => item.responsibilities > item.limit);
}
