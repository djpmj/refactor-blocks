import type { Codebase } from './Codebase';
import { uniqueName } from './naming';

/** プレイヤーが追加する空ファイル。内部パスは重複しないよう採番する。 */
export function addNewFile(codebase: Codebase, newFileId: string): Codebase {
  const name = uniqueName('NewFile', (candidate) => codebase.files.some((file) => file.path === `src/${candidate}.ts`));
  return { files: [...codebase.files, { id: newFileId, path: `src/${name}.ts`, classes: [] }] };
}
