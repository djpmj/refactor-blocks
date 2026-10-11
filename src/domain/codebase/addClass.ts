import type { Codebase } from './Codebase';
import { validateClassName, type ClassNameError } from './naming';
import { err, ok, type Result } from '../shared/Result';

export type AddClassError = 'file-not-found' | ClassNameError;
export type NewClassIdentity = string | { readonly id: string; readonly autoNamed: true };

/** メソッドが空の新しいクラスを、指定したファイルの末尾に追加する。クラス名はコードベース全体で重複させない。 */
export function addClass(
  codebase: Codebase,
  fileId: string,
  className: string,
  newClass: NewClassIdentity,
): Result<Codebase, AddClassError> {
  if (!codebase.files.some((file) => file.id === fileId)) return err('file-not-found');
  const validated = validateClassName(codebase, className);
  if (!validated.ok) return validated;
  const name = validated.value;
  const codeClass = typeof newClass === 'string'
    ? { id: newClass, name, methods: [] }
    : { id: newClass.id, name, methods: [], autoNamed: true as const };
  return ok({
    files: codebase.files.map((file) =>
      file.id === fileId ? { ...file, classes: [...file.classes, codeClass] } : file,
    ),
  });
}
