import type { Codebase } from './Codebase';
import { inlineExtractedMethods } from './deleteClass';
import { err, ok, type Result } from '../shared/Result';

export type DeleteFileError = 'file-not-found' | 'last-file';

/** ファイルを削除する。中の各クラスについて、切り出し済みのメソッドは消える前に呼び出し元へ戻す。 */
export function deleteFile(codebase: Codebase, fileId: string): Result<Codebase, DeleteFileError> {
  const target = codebase.files.find((file) => file.id === fileId);
  if (target === undefined) return err('file-not-found');
  if (codebase.files.length <= 1) return err('last-file');
  const inlined = target.classes.reduce((current, codeClass) => inlineExtractedMethods(current, codeClass.id), codebase);
  return ok({ files: inlined.files.filter((file) => file.id !== fileId) });
}
