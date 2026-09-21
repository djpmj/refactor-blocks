import { allClasses, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type ClassNameError = 'empty-class-name' | 'duplicate-class-name';
export type FilePathError = 'empty-path' | 'duplicate-path';

/** クラス名の前後の空白を除き、空・コードベース内での重複を弾く。追加と名前の変更で同じ規則を使う。 */
export function validateClassName(codebase: Codebase, rawName: string): Result<string, ClassNameError> {
  const name = rawName.trim();
  if (name === '') return err('empty-class-name');
  if (allClasses(codebase).some((codeClass) => codeClass.name === name)) return err('duplicate-class-name');
  return ok(name);
}

/** ファイルのパスの前後の空白を除き、空・重複を弾く。追加と名前の変更で同じ規則を使う。 */
export function validateFilePath(codebase: Codebase, rawPath: string): Result<string, FilePathError> {
  const path = rawPath.trim();
  if (path === '') return err('empty-path');
  if (codebase.files.some((file) => file.path === path)) return err('duplicate-path');
  return ok(path);
}
