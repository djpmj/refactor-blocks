import { addClass } from './addClass';
import { addFile } from './addFile';
import { allClasses, findClass, findMethod, type Codebase } from './Codebase';
import { moveClass } from './moveClass';
import { moveMethod } from './moveMethod';
import { err, type Result } from '../shared/Result';

export type MoveClassToNewFileError = 'class-not-found';
export type MoveMethodToNewClassError = 'method-not-found';

/** 使われていない名前になるまで連番(2, 3, ...)を付ける。 */
function uniqueName(base: string, isTaken: (candidate: string) => boolean): string {
  let suffix = 1;
  while (isTaken(suffix === 1 ? base : `${base}${String(suffix)}`)) suffix++;
  return suffix === 1 ? base : `${base}${String(suffix)}`;
}

function newFilePath(codebase: Codebase, className: string): string {
  const name = uniqueName(className, (candidate) => codebase.files.some((file) => file.path === `src/${candidate}.ts`));
  return `src/${name}.ts`;
}

/** クラスをファイルの枠外へ出したとき: クラス名のパスで新しいファイルを作り、そこへクラスを移す。 */
export function moveClassToNewFile(
  codebase: Codebase,
  classId: string,
  newFileId: string,
): Result<Codebase, MoveClassToNewFileError> {
  const codeClass = findClass(codebase, classId);
  if (codeClass === undefined) return err('class-not-found');
  const withFile = addFile(codebase, newFilePath(codebase, codeClass.name), newFileId);
  // パスは重複しないよう採番済みなので、ここで失敗するのは想定外
  if (!withFile.ok) return err('class-not-found');
  const moved = moveClass(withFile.value, classId, newFileId);
  return moved.ok ? moved : err('class-not-found');
}

/** メソッドをファイルの枠外へ出したとき: 新しいクラスを新しいファイルに作り、そこへメソッドを移す。 */
export function moveMethodToNewClass(
  codebase: Codebase,
  methodId: string,
  ids: { readonly classId: string; readonly fileId: string },
): Result<Codebase, MoveMethodToNewClassError> {
  if (findMethod(codebase, methodId) === undefined) return err('method-not-found');
  const className = uniqueName('NewClass', (name) => allClasses(codebase).some((codeClass) => codeClass.name === name));
  const withFile = addFile(codebase, newFilePath(codebase, className), ids.fileId);
  if (!withFile.ok) return err('method-not-found');
  const withClass = addClass(withFile.value, ids.fileId, className, ids.classId);
  if (!withClass.ok) return err('method-not-found');
  const moved = moveMethod(withClass.value, methodId, ids.classId);
  return moved.ok ? moved : err('method-not-found');
}
