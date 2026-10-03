import { findClass, findFileOfClass, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type MoveClassError = 'class-not-found' | 'file-not-found' | 'same-file';

function isClassInFile(codebase: Codebase, classId: string, fileId: string): boolean {
  return findFileOfClass(codebase, classId)?.id === fileId;
}

/** クラスの移動先にできる、現在のファイル以外のファイルをファイル順に返す。 */
export function moveClassTargets(codebase: Codebase, classId: string) {
  if (findClass(codebase, classId) === undefined) return [];
  return codebase.files.filter((file) => !isClassInFile(codebase, classId, file.id));
}

/** クラスを別のファイルへ移動する。移動先ファイルの末尾に追加される。 */
export function moveClass(codebase: Codebase, classId: string, targetFileId: string): Result<Codebase, MoveClassError> {
  const codeClass = findClass(codebase, classId);
  if (codeClass === undefined) return err('class-not-found');
  if (!codebase.files.some((file) => file.id === targetFileId)) return err('file-not-found');
  if (isClassInFile(codebase, classId, targetFileId)) return err('same-file');

  return ok({
    files: codebase.files.map((file) => {
      if (file.id === targetFileId) return { ...file, classes: [...file.classes, codeClass] };
      return { ...file, classes: file.classes.filter((existing) => existing.id !== classId) };
    }),
  });
}
