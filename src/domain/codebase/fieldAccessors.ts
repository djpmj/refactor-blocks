import { findClassOfField, findClassOfMethod, type Codebase } from './Codebase';
import { fieldUsage, type FieldAccess } from './fieldUsage';

export type FieldAccessor = {
  readonly methodId: string;
  readonly methodName: string;
  readonly className: string;
  readonly access: FieldAccess;
  /** メソッドのクラスが、フィールドの持ち主のクラスと違う。 */
  readonly outside: boolean;
};

/** フィールドを読み書きするメソッドを、コードの出現順で返す。読み書きの判定は fieldUsage と同じ。 */
export function fieldAccessors(codebase: Codebase, fieldId: string): readonly FieldAccessor[] {
  const owner = findClassOfField(codebase, fieldId);
  if (owner === undefined) return [];

  return fieldUsage(codebase, fieldId).flatMap(({ method, access }) => {
    const codeClass = findClassOfMethod(codebase, method.id);
    if (codeClass === undefined) return [];
    return [{ methodId: method.id, methodName: method.name, className: codeClass.name, access, outside: codeClass.id !== owner.id }];
  });
}
