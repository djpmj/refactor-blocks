import type { Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type AddFileError = 'empty-path' | 'duplicate-path';

/** クラスが空の新しいファイルを末尾に追加する。 */
export function addFile(codebase: Codebase, path: string, newFileId: string): Result<Codebase, AddFileError> {
  const trimmed = path.trim();
  if (trimmed === '') return err('empty-path');
  if (codebase.files.some((file) => file.path === trimmed)) return err('duplicate-path');
  return ok({ files: [...codebase.files, { id: newFileId, path: trimmed, classes: [] }] });
}
