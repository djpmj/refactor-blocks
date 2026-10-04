import type { Codebase } from '../codebase/Codebase';
import type { Stage } from '../stage/Stage';
import { changeKindOf, type ChangeRequest } from './ChangeRequest';
import { measureChange } from './measureChange';

export type PainSummary = {
  readonly siteIds: readonly string[];
  readonly classes: number;
  readonly files: number;
};

export type ChangePain = {
  readonly request: ChangeRequest;
  readonly initial: PainSummary;
  readonly current: PainSummary;
  readonly improved: boolean;
};

export function painRequestOf(stage: Pick<Stage, 'changeRequests'>): ChangeRequest | undefined {
  return stage.changeRequests.find((request) => changeKindOf(request) === 'modify');
}

function summarize(codebase: Codebase, request: ChangeRequest, limits: Stage['limits']): PainSummary | undefined {
  const result = measureChange(codebase, request, limits);
  if (!result.ok) return undefined;
  return { siteIds: result.value.sites, classes: result.value.classesTouched, files: result.value.filesTouched };
}

export function measurePain(stage: Pick<Stage, 'codebase' | 'changeRequests' | 'limits'>, current: Codebase): ChangePain | undefined {
  const request = painRequestOf(stage);
  if (request === undefined) return undefined;
  const initial = summarize(stage.codebase, request, stage.limits);
  const currentSummary = summarize(current, request, stage.limits);
  if (initial === undefined || currentSummary === undefined) return undefined;
  const improved = currentSummary.siteIds.length < initial.siteIds.length
    || (currentSummary.siteIds.length === initial.siteIds.length
      && (currentSummary.classes < initial.classes || currentSummary.files < initial.files));
  return { request, initial, current: currentSummary, improved };
}
