import { fieldsOf, findClass, findClassOfField, findField, mapClasses, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type MoveFieldError = 'field-not-found' | 'class-not-found' | 'same-class' | 'duplicate-field-name';

/** Move Field: フィールドを別クラスへ移す。移動先の末尾に追加する。処理の reads / writes はIDで指しているので書き換えない。 */
export function moveField(codebase: Codebase, fieldId: string, targetClassId: string): Result<Codebase, MoveFieldError> {
  const field = findField(codebase, fieldId);
  const sourceClass = findClassOfField(codebase, fieldId);
  if (field === undefined || sourceClass === undefined) return err('field-not-found');
  const targetClass = findClass(codebase, targetClassId);
  if (targetClass === undefined) return err('class-not-found');
  if (sourceClass.id === targetClass.id) return err('same-class');
  if (fieldsOf(targetClass).some((existing) => existing.name === field.name)) return err('duplicate-field-name');

  return ok(
    mapClasses(codebase, (codeClass) => {
      if (codeClass.id === sourceClass.id) {
        const remaining = fieldsOf(codeClass).filter((existing) => existing.id !== fieldId);
        return { ...codeClass, fields: remaining.length === 0 ? undefined : remaining };
      }
      if (codeClass.id === targetClass.id) {
        return { ...codeClass, fields: [...fieldsOf(codeClass), field] };
      }
      return codeClass;
    }),
  );
}
