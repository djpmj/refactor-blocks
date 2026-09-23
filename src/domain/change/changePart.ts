import { trayCodebase, findUnplacedParts } from '../blank/tray';
import type { Codebase, Method } from '../codebase/Codebase';
import type { ChangeRequest } from './ChangeRequest';

/** 依頼の新規部品。public のメソッド1つで、処理(Fragment)を1つ持つ。 */
export function changePart(request: ChangeRequest): Method {
  return {
    id: `method-part-${request.id}`,
    name: request.partName ?? 'addedLogic',
    visibility: 'public',
    fragments: [{ id: `${request.id}:part`, label: request.title, lines: request.linesPerSite, responsibility: request.responsibility }],
  };
}

/** 今のコードの末尾に、部品を1つだけ入れた部品置き場のファイルを足す(元は変更しない)。 */
export function withChangePart(codebase: Codebase, request: ChangeRequest): Codebase {
  return { files: [...codebase.files, ...trayCodebase([changePart(request)]).files] };
}

/** 部品が部品置き場の外に置かれているか。 */
export function isChangePartPlaced(codebase: Codebase, request: ChangeRequest): boolean {
  return findUnplacedParts(trayCodebase([changePart(request)]), codebase).length === 0;
}
