import { allClasses, type Method } from '../codebase/Codebase';
import { err, ok, type Result } from '../shared/Result';
import { applySolutionSteps } from '../stage/sampleAnswer';
import type { BlankDesignProblem } from './BlankDesignProblem';
import { findUnplacedParts, TRAY_FILE_ID } from './tray';

export type BlankDesignProblemError =
  | 'tray-shape' // codebase がファイル1つ(id が TRAY_FILE_ID)・クラス1つ になっていない
  | 'no-parts' // 部品(部品置き場のメソッド)が0個
  | 'duplicate-part-id' // 部品のメソッドID、または Fragment ID が重複している
  | 'unknown-use' // Fragment.uses に、部品にないメソッドIDが入っている
  | 'missing-responsibility-name' // 'call' 以外の部品の責務について、classNames か responsibilityNames に項目がない
  | 'unknown-change-responsibility' // changeRequests[].responsibility が部品の責務に存在しない
  | 'model-answer-unplaced'; // 模範解答を当てても部品置き場に部品が残る

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function responsibilitiesOf(parts: readonly Method[]): Set<string> {
  const responsibilities = parts.flatMap((part) => part.fragments).map((fragment) => fragment.responsibility);
  return new Set(responsibilities.filter((responsibility) => responsibility !== 'call'));
}

function hasTrayShape(problem: BlankDesignProblem): boolean {
  const [file] = problem.codebase.files;
  return problem.codebase.files.length === 1 && file.id === TRAY_FILE_ID && file.classes.length === 1;
}

function hasUnknownUse(parts: readonly Method[]): boolean {
  const methodIds = new Set(parts.map((part) => part.id));
  return parts.flatMap((part) => part.fragments).some((fragment) => (fragment.uses ?? []).some((id) => !methodIds.has(id)));
}

function hasMissingName(problem: BlankDesignProblem, responsibilities: ReadonlySet<string>): boolean {
  return [...responsibilities].some((responsibility) => !(responsibility in problem.classNames) || !(responsibility in problem.responsibilityNames));
}

/** 白紙設計の問題データが書き方の決まりを満たすかを調べる。満たせば ok、満たさなければ最初に見つかった誤り。 */
export function validateBlankDesignProblem(problem: BlankDesignProblem): Result<BlankDesignProblem, BlankDesignProblemError> {
  if (!hasTrayShape(problem)) return err('tray-shape');
  const parts = allClasses(problem.codebase).flatMap((codeClass) => codeClass.methods);
  if (parts.length === 0) return err('no-parts');
  const fragmentIds = parts.flatMap((part) => part.fragments).map((fragment) => fragment.id);
  if (hasDuplicate(parts.map((part) => part.id)) || hasDuplicate(fragmentIds)) return err('duplicate-part-id');
  if (hasUnknownUse(parts)) return err('unknown-use');
  const responsibilities = responsibilitiesOf(parts);
  if (hasMissingName(problem, responsibilities)) return err('missing-responsibility-name');
  if (problem.changeRequests.some((request) => !responsibilities.has(request.responsibility))) return err('unknown-change-responsibility');
  const placed = applySolutionSteps(problem.codebase, problem.modelAnswer);
  if (findUnplacedParts(problem.codebase, placed).length > 0) return err('model-answer-unplaced');
  return ok(problem);
}
