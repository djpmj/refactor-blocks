import type { Codebase } from '../domain/codebase/Codebase';
import { buildCritiqueRequest, type CritiqueRequest } from '../domain/critique/critiqueRequest';
import type { Score } from '../domain/scoring/score';
import { err, ok, type Result } from '../domain/shared/Result';
import type { Stage } from '../domain/stage/Stage';

/** AI講評APIへの実際の通信。infrastructure層が実装を注入する。 */
export type RequestCritique = (request: CritiqueRequest) => Promise<string>;

export type CritiqueError = 'request-failed';

/** プレイヤーの「AIの講評をもらう」操作。通信の成否をResultにして返す。 */
export async function requestCritiqueUseCase(
  codebase: Codebase,
  stage: Pick<Stage, 'goal' | 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
  score: Score,
  requestCritique: RequestCritique,
): Promise<Result<string, CritiqueError>> {
  const request = buildCritiqueRequest(codebase, stage, score);
  try {
    return ok(await requestCritique(request));
  } catch {
    return err('request-failed');
  }
}

const CRITIQUE_ERROR_MESSAGES: Record<CritiqueError, string> = {
  'request-failed': 'AI講評を取得できませんでした。しばらくしてからもう一度お試しください',
};

export function describeCritiqueError(error: CritiqueError): string {
  return CRITIQUE_ERROR_MESSAGES[error];
}
