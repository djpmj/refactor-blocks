import type { Visibility } from '../../domain/codebase/Codebase';

/** メソッド・フィールドの可視性を表す記号。MethodChip・FieldChip の両方から使う。 */
export const VISIBILITY_MARK: Record<Visibility, string> = {
  public: '+',
  private: '-',
  protected: '#',
};
