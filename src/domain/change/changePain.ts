import { findClassOfMethod, type Codebase } from '../codebase/Codebase';
import { methodLines } from '../codebase/lineCount';
import type { Stage } from '../stage/Stage';
import { changeKindOf, type ChangeRequest } from './ChangeRequest';
import { measureChange } from './measureChange';

export type PainSummary = {
  readonly siteIds: readonly string[];
  readonly classes: number;
  readonly files: number;
  /** 変更箇所のメソッドの行数(`methodLines`)の合計。同じメソッドは1回だけ数える。 */
  readonly readLines: number;
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
  const siteIds = result.value.sites;
  return { siteIds, classes: result.value.classesTouched, files: result.value.filesTouched, readLines: readLinesOf(codebase, siteIds) };
}

// ponytail: 「読む行数」は変更箇所のメソッドの行数の合計で近似する(クラスの全体や、呼び出し元は数えない)。実際の理解の手間とずれると分かったら、呼び出し元・同じクラスの関係メソッドも足す
function readLinesOf(codebase: Codebase, siteIds: readonly string[]): number {
  return [...new Set(siteIds)].reduce((sum, id) => {
    const method = findClassOfMethod(codebase, id)?.methods.find((candidate) => candidate.id === id);
    return method === undefined ? sum : sum + methodLines(method);
  }, 0);
}

export function measurePain(stage: Pick<Stage, 'codebase' | 'changeRequests' | 'limits'>, current: Codebase): ChangePain | undefined {
  const request = painRequestOf(stage);
  if (request === undefined) return undefined;
  const initial = summarize(stage.codebase, request, stage.limits);
  const currentSummary = summarize(current, request, stage.limits);
  if (initial === undefined || currentSummary === undefined) return undefined;
  const improved = currentSummary.siteIds.length < initial.siteIds.length
    || (currentSummary.siteIds.length === initial.siteIds.length
      && (currentSummary.classes < initial.classes || currentSummary.files < initial.files))
    || currentSummary.readLines < initial.readLines;
  return { request, initial, current: currentSummary, improved };
}
