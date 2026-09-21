import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';

/** ステージの難易度。ステージ選択ではこの順に並べる。 */
export type StageLevel = 'tutorial' | 'beginner' | 'intermediate';

export type Stage = {
  readonly id: string;
  readonly level: StageLevel;
  readonly title: string;
  readonly goal: string;
  readonly limits: LineLimits;
  /** 1クラスが依存してよいクラス数の上限。 */
  readonly dependencyLimit: number;
  /** 1クラスに混ぜてよい責務(Fragment の responsibility)の種類数の上限。 */
  readonly responsibilityLimit: number;
  readonly codebase: Codebase;
};
