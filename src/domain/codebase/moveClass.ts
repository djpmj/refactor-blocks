import { findClass, findFileOfClass, type Codebase, type CodeFile } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type MoveClassError = 'class-not-found' | 'file-not-found' | 'same-file';

/** クラスを別のファイルへ移動する。移動先ファイルの末尾に追加される。 */
export function moveClass(codebase: Codebase, classId: string, targetFileId: string): Result<Codebase, MoveClassError> {
  const codeClass = findClass(codebase, classId);
  if (codeClass === undefined) return err('class-not-found');
  if (!codebase.files.some((file) => file.id === targetFileId)) return err('file-not-found');
  const error = targetError(findFileOfClass(codebase, classId), targetFileId);
  if (error !== null) return err(error);

  return ok({
    files: codebase.files.map((file) => {
      if (file.id === targetFileId) return { ...file, classes: [...file.classes, codeClass] };
      return { ...file, classes: file.classes.filter((existing) => existing.id !== classId) };
    }),
  });
}

function targetError(sourceFile: CodeFile | undefined, targetFileId: string): MoveClassError | null {
  return sourceFile?.id === targetFileId ? 'same-file' : null;
}

/** 移動できるファイルをcodebase.filesの順で返す。 */
export function moveClassTargets(codebase: Codebase, classId: string): CodeFile[] {
  const sourceFile = findFileOfClass(codebase, classId);
  if (sourceFile === undefined) return [];
  return codebase.files.filter((file) => targetError(sourceFile, file.id) === null);
}
