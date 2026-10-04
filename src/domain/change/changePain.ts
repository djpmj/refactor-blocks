import { allClasses, findClassOfMethod, isInterfaceLike, type Codebase } from '../codebase/Codebase';
import { methodLines } from '../codebase/lineCount';
import type { Stage } from '../stage/Stage';
import { changeKindOf, type ChangeRequest } from './ChangeRequest';
import { measureChange } from './measureChange';
import { measurePlacement } from './measurePlacement';
import { sampleImplementation, type SampleTarget } from './sampleImplementation';

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

/** 'modify' とは別に、機能の追加の依頼を痛みの対象にする。それぞれ最初の1件。 */
export function painRequestsOf(stage: Pick<Stage, 'changeRequests'>): { readonly modify?: ChangeRequest; readonly extend?: ChangeRequest } {
  return {
    modify: stage.changeRequests.find((request) => changeKindOf(request) === 'modify'),
    extend: stage.changeRequests.find((request) => changeKindOf(request) === 'extend'),
  };
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
  const request = painRequestsOf(stage).modify;
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

export type ExtendPain = {
  readonly request: ChangeRequest;
  /** 最善の置き方(`sampleImplementation`)をしたときに、書き換えることになる既存クラスのID(挑戦前のコードにあるクラス)。 */
  readonly initialModified: readonly string[];
  readonly currentModified: readonly string[];
  /** 最善の置き方の説明。新しいクラスなら実装するインターフェース名。 */
  readonly currentTarget: SampleTarget;
  readonly improved: boolean;
};

/** 誰も実装していないインターフェース役は、まだ拡張の入口になっていないので無いものとして扱う。 */
function withoutUnimplementedInterfaces(base: Codebase): Codebase {
  const implemented = new Set(allClasses(base).flatMap((codeClass) => codeClass.interfaceIds ?? []));
  const unusable = (id: string, interfaceLike: boolean) => interfaceLike && !implemented.has(id);
  return { files: base.files.map((file) => ({ ...file, classes: file.classes.filter((codeClass) => !unusable(codeClass.id, isInterfaceLike(codeClass))) })) };
}

function bestPlacement(base: Codebase, request: ChangeRequest): { readonly modified: readonly string[]; readonly target: SampleTarget } | undefined {
  const usable = withoutUnimplementedInterfaces(base);
  const sample = sampleImplementation(usable, request);
  if (sample === undefined) return undefined;
  const placement = measurePlacement(usable, sample.codebase, request);
  return placement.ok ? { modified: placement.value.modifiedClassIds, target: sample.target } : undefined;
}

// ponytail: 痛みは「既存クラスを書き換える数」で数える。実務では1クラスの中の複数メソッドを直すが、部品は1メソッドなので1クラスと数える。種類ごとの分岐が複数メソッドに散らばる感覚が弱いと分かったら、分岐の数を数えるタグをFragmentに足す
/** 初期のコードと今のコードで、機能の追加の依頼を最善の置き方で入れたとき、既存のクラスを何個書き換えるかを比べる。解答例が作れないなら undefined。 */
export function measureExtendPain(stage: Pick<Stage, 'codebase'>, current: Codebase, request: ChangeRequest): ExtendPain | undefined {
  const initial = bestPlacement(stage.codebase, request);
  const now = bestPlacement(current, request);
  if (initial === undefined || now === undefined) return undefined;
  return { request, initialModified: initial.modified, currentModified: now.modified, currentTarget: now.target, improved: now.modified.length < initial.modified.length };
}
