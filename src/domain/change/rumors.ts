import { painRequestsOf } from './changePain';
import type { ChangeRequest } from './ChangeRequest';
import type { Stage } from '../stage/Stage';

/** 最初に全文を見せる modify / extend を除いた、うわさの対象依頼。 */
export function rumoredRequests(stage: Pick<Stage, 'changeRequests'>): readonly ChangeRequest[] {
  const pains = painRequestsOf(stage);
  const excluded = new Set([pains.modify?.id, pains.extend?.id]);
  return stage.changeRequests.filter((request) => !excluded.has(request.id));
}
