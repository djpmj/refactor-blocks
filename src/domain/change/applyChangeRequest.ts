import { mapClasses, type Codebase, type Method } from '../codebase/Codebase';
import { err, ok, type Result } from '../shared/Result';
import type { ChangeError, ChangeRequest } from './ChangeRequest';
import { findChangeSites } from './findChangeSites';

/** 変更箇所の各メソッドに、依頼の責務を持つ処理を足した新しいCodebaseを返す(元は変更しない)。 */
export function applyChangeRequest(codebase: Codebase, request: ChangeRequest): Result<Codebase, ChangeError> {
  const sites = findChangeSites(codebase, request);
  if (sites.length === 0) return err('no-sites');
  const addChange = (method: Method): Method =>
    sites.includes(method.id)
      ? {
          ...method,
          fragments: [
            ...method.fragments,
            { id: `${request.id}:${method.id}`, label: request.title, lines: request.linesPerSite, responsibility: request.responsibility },
          ],
        }
      : method;
  return ok(mapClasses(codebase, (codeClass) => ({ ...codeClass, methods: codeClass.methods.map(addChange) })));
}
