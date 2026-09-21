import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';

export type Stage = {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly limits: LineLimits;
  /** 1クラスが依存してよいクラス数の上限。 */
  readonly dependencyLimit: number;
  readonly codebase: Codebase;
};
