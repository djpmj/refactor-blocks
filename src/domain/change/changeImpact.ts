import { allClasses, type Codebase, type Method } from '../codebase/Codebase';
import { methodLines } from '../codebase/lineCount';
import type { ChangeRequest } from './ChangeRequest';
import { findChangeSites } from './findChangeSites';

/** 変更が必要なメソッド1つ分(表示用の名前と行数つき)。 */
export type ImpactSite = { readonly methodId: string; readonly className: string; readonly methodName: string; readonly lines: number };
export type ImpactSide = { readonly sites: readonly ImpactSite[]; readonly readLines: number };
export type ImpactMove = {
  readonly kind: 'gathered' | 'extracted' | 'moved';
  readonly fragmentLabels: readonly string[];
  readonly from: readonly ImpactSite[];
  readonly to: ImpactSite;
};
export type ChangeImpact = {
  readonly before: ImpactSide;
  readonly after: ImpactSide;
  readonly moves: readonly ImpactMove[];
  readonly verdict: 'better' | 'same' | 'worse';
};

function sitesOf(codebase: Codebase, request: ChangeRequest): ImpactSite[] {
  return findChangeSites(codebase, request).flatMap((methodId) => {
    const owner = allClasses(codebase).find((codeClass) => codeClass.methods.some((method) => method.id === methodId));
    const method = owner?.methods.find((candidate) => candidate.id === methodId);
    return owner === undefined || method === undefined ? [] : [{ methodId, className: owner.name, methodName: method.name, lines: methodLines(method, codebase) }];
  });
}

function sideOf(sites: readonly ImpactSite[]): ImpactSide {
  return { sites, readLines: sites.reduce((total, site) => total + site.lines, 0) };
}

function initialOwners(codebase: Codebase): Map<string, { readonly site: ImpactSite; readonly classId: string }> {
  const result = new Map<string, { readonly site: ImpactSite; readonly classId: string }>();
  for (const codeClass of allClasses(codebase)) {
    for (const method of codeClass.methods) {
      const site = { methodId: method.id, className: codeClass.name, methodName: method.name, lines: methodLines(method, codebase) };
      for (const fragment of method.fragments) result.set(fragment.id, { site, classId: codeClass.id });
    }
  }
  return result;
}

function moveFor(method: Method, to: ImpactSite, context: { readonly classId: string; readonly owners: ReadonlyMap<string, { readonly site: ImpactSite; readonly classId: string }>; readonly responsibility: string }): ImpactMove | undefined {
  const fragments = method.fragments.filter((fragment) => fragment.responsibility === context.responsibility);
  const fromEntries = fragments.flatMap((fragment) => {
    const owner = context.owners.get(fragment.id);
    return owner === undefined ? [] : [owner];
  });
  const unique = new Map(fromEntries.map((entry) => [entry.site.methodId, entry]));
  const from = [...unique.values()];
  if (from.length === 0) return undefined;
  let kind: ImpactMove['kind'];
  if (from.length > 1) kind = 'gathered';
  else if (from[0]?.site.methodId !== method.id) kind = 'extracted';
  else if (from[0]?.classId !== context.classId) kind = 'moved';
  else return undefined;
  const trackedLabels = fragments.flatMap((fragment) => context.owners.has(fragment.id) ? [fragment.label] : []);
  return { kind, fragmentLabels: [...new Set(trackedLabels)], from: from.map((entry) => entry.site), to };
}

// ponytail: Fragment の id が組み替えの前後で保たれる前提。統合(merge)で id が変わる処理は追えず、数字の比較だけになる。追えないケースが目立ったら、統合時に元の id を記録する
/** 初期コードと現在のコードを比べ、変更箇所と責務の移動を求める。 */
export function explainChangeImpact(initial: Codebase, current: Codebase, request: ChangeRequest): ChangeImpact | undefined {
  const before = sideOf(sitesOf(initial, request));
  const after = sideOf(sitesOf(current, request));
  if (before.sites.length === 0 || after.sites.length === 0) return undefined;
  const owners = initialOwners(initial);
  const moves = after.sites.flatMap((to) => {
    const owner = allClasses(current).find((codeClass) => codeClass.methods.some((method) => method.id === to.methodId));
    const method = owner?.methods.find((candidate) => candidate.id === to.methodId);
    const move = owner === undefined || method === undefined ? undefined : moveFor(method, to, { classId: owner.id, owners, responsibility: request.responsibility });
    return move === undefined ? [] : [move];
  });
  const better = after.sites.length < before.sites.length || (after.sites.length === before.sites.length && after.readLines < before.readLines);
  const same = after.sites.length === before.sites.length && after.readLines === before.readLines;
  let verdict: ChangeImpact['verdict'] = 'worse';
  if (better) verdict = 'better';
  else if (same) verdict = 'same';
  return { before, after, moves, verdict };
}
