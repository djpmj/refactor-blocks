import { findClass, type Codebase } from './Codebase';
import { validateClassName, type ClassNameError } from './naming';
import { err, ok, type Result } from '../shared/Result';

export type RenameClassError = 'class-not-found' | ClassNameError;

/** クラス名を付け替える。今と同じ名前なら何も変えずに成功にする。 */
export function renameClass(codebase: Codebase, classId: string, newName: string): Result<Codebase, RenameClassError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');
  if (newName.trim() === target.name) return ok(codebase);
  const validated = validateClassName(codebase, newName);
  if (!validated.ok) return validated;
  const name = validated.value;
  return ok({
    files: codebase.files.map((file) => ({
      ...file,
      classes: file.classes.map((codeClass) => (codeClass.id === classId ? { ...codeClass, name } : codeClass)),
    })),
  });
}
