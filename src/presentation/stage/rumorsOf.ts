import { rumoredRequests } from '../../domain/change/rumors';
import type { Stage } from '../../domain/stage/Stage';

/** そのステージで、うわさ(rumor)を持つ変更依頼。 */
export function rumorsOf(stage: Stage) {
  return rumoredRequests(stage).filter((request) => request.rumor !== undefined);
}
