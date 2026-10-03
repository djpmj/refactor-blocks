import { fieldsOf, type Codebase } from './Codebase';
import { inlineBeforeDelete } from './deleteClass';
import { err, ok, type Result } from '../shared/Result';

export type DeleteFileError = 'file-not-found' | 'last-file' | 'has-fields' | 'has-code';

/** ファイルを削除する。中の各クラスについて、切り出し済みのメソッドは消える前に呼び出し元へ戻す。 */
export function deleteFile(codebase: Codebase, fileId: string): Result<Codebase, DeleteFileError> {
  const target = codebase.files.find((file) => file.id === fileId);
  if (target === undefined) return err('file-not-found');
  if (codebase.files.length <= 1) return err('last-file');
  if (target.classes.some((codeClass) => fieldsOf(codeClass).length > 0)) return err('has-fields');
  const inlined = inlineBeforeDelete(codebase, target.classes.map((codeClass) => codeClass.id));
  if (!inlined.ok) return inlined;
  return ok({ files: inlined.value.files.filter((file) => file.id !== fileId) });
}
