import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';

export type Stage = {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly limits: LineLimits;
  readonly codebase: Codebase;
};
