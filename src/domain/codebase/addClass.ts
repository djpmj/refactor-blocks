import type { Codebase } from './Codebase';
import { validateClassName, type ClassNameError } from './naming';
import { err, ok, type Result } from '../shared/Result';

export type AddClassError = 'file-not-found' | ClassNameError;

/** メソッドが空の新しいクラスを、指定したファイルの末尾に追加する。クラス名はコードベース全体で重複させない。 */
export function addClass(
  codebase: Codebase,
  fileId: string,
  className: string,
  newClassId: string,
): Result<Codebase, AddClassError> {
  if (!codebase.files.some((file) => file.id === fileId)) return err('file-not-found');
  const validated = validateClassName(codebase, className);
  if (!validated.ok) return validated;
  const name = validated.value;
  return ok({
    files: codebase.files.map((file) =>
      file.id === fileId ? { ...file, classes: [...file.classes, { id: newClassId, name, methods: [] }] } : file,
    ),
  });
}
