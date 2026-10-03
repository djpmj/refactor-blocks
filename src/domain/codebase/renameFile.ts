import type { Codebase } from './Codebase';
import { validateFilePath, type FilePathError } from './naming';
import { err, ok, type Result } from '../shared/Result';

export type RenameFileError = 'file-not-found' | FilePathError;

/** ファイルのパスを付け替える。今と同じパスなら何も変えずに成功にする。 */
export function renameFile(codebase: Codebase, fileId: string, newPath: string): Result<Codebase, RenameFileError> {
  const target = codebase.files.find((file) => file.id === fileId);
  if (target === undefined) return err('file-not-found');
  if (newPath.trim() === target.path) return ok(codebase);
  const validated = validateFilePath(codebase, newPath);
  if (!validated.ok) return validated;
  const path = validated.value;
  return ok({ files: codebase.files.map((file) => (file.id === fileId ? { ...file, path } : file)) });
}
