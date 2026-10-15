import { allClasses, isInterfaceLike, type Codebase } from '../../domain/codebase/Codebase';
import type { Stage } from '../../domain/stage/Stage';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';

/** 初期状態か解答例で継承・インターフェースを扱うステージか。 */
export function usesInheritance(stage: Stage, sample: Codebase = sampleAnswerCodebase(stage)): boolean {
  return [stage.codebase, sample].some((codebase) =>
    allClasses(codebase).some((codeClass) => codeClass.superclassId !== undefined || isInterfaceLike(codeClass)),
  );
}
