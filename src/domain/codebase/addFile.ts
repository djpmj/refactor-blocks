import type { Codebase } from './Codebase';
import { validateFilePath, type FilePathError } from './naming';
import { ok, type Result } from '../shared/Result';

export type AddFileError = FilePathError;

/** クラスが空の新しいファイルを末尾に追加する。 */
export function addFile(codebase: Codebase, path: string, newFileId: string): Result<Codebase, AddFileError> {
  const validated = validateFilePath(codebase, path);
  if (!validated.ok) return validated;
  return ok({ files: [...codebase.files, { id: newFileId, path: validated.value, classes: [] }] });
}
