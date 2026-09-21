import { findClass, findFileOfClass, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type MoveClassError = 'class-not-found' | 'file-not-found' | 'same-file';

/** クラスを別のファイルへ移動する。移動先ファイルの末尾に追加される。 */
export function moveClass(codebase: Codebase, classId: string, targetFileId: string): Result<Codebase, MoveClassError> {
  const codeClass = findClass(codebase, classId);
  if (codeClass === undefined) return err('class-not-found');
  if (!codebase.files.some((file) => file.id === targetFileId)) return err('file-not-found');
  if (findFileOfClass(codebase, classId)?.id === targetFileId) return err('same-file');

  return ok({
    files: codebase.files.map((file) => {
      if (file.id === targetFileId) return { ...file, classes: [...file.classes, codeClass] };
      return { ...file, classes: file.classes.filter((existing) => existing.id !== classId) };
    }),
  });
}
