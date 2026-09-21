import { allClasses, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type AddClassError = 'file-not-found' | 'empty-class-name' | 'duplicate-class-name';

/** メソッドが空の新しいクラスを、指定したファイルの末尾に追加する。クラス名はコードベース全体で重複させない。 */
export function addClass(
  codebase: Codebase,
  fileId: string,
  className: string,
  newClassId: string,
): Result<Codebase, AddClassError> {
  if (!codebase.files.some((file) => file.id === fileId)) return err('file-not-found');
  const name = className.trim();
  if (name === '') return err('empty-class-name');
  if (allClasses(codebase).some((codeClass) => codeClass.name === name)) return err('duplicate-class-name');
  return ok({
    files: codebase.files.map((file) =>
      file.id === fileId ? { ...file, classes: [...file.classes, { id: newClassId, name, methods: [] }] } : file,
    ),
  });
}
