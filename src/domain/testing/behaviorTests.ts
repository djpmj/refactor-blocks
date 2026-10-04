import { allClasses, findMethod, isStubMethod, type Codebase } from '../codebase/Codebase';
import { countedVisibilityViolations, type VisibilityViolation } from '../scoring/visibility';
import type { Stage } from '../stage/Stage';

export type BehaviorTest = {
  /** 入口のメソッドID(初期コードで、どの Fragment の uses からも参照されていない、空でも空実装だけでもないメソッド)。 */
  readonly entryMethodId: string;
  /** 初期コードで、入口から呼び出しをたどって実行される処理の「振る舞いの鍵」の集合。 */
  readonly expected: ReadonlySet<string>;
};

export type TestFailure =
  | { readonly kind: 'entry-missing' }
  | { readonly kind: 'missing'; readonly keys: readonly string[] }
  | { readonly kind: 'added'; readonly keys: readonly string[] }
  | { readonly kind: 'compile'; readonly violations: readonly VisibilityViolation[] };

/** failures が空なら緑。 */
export type TestResult = { readonly test: BehaviorTest; readonly failures: readonly TestFailure[] };

/** 振る舞いの鍵 = 責務|ラベル。Fragment の ID ではなく鍵で比べるので、統合で ID が変わっても鍵は同じ。 */
export function behaviorKey(responsibility: string, label: string): string {
  return `${responsibility}|${label}`;
}

/**
 * 入口から呼び出しをたどって実行される処理の鍵と、たどったメソッドID。
 * 呼び出し行(call)と空実装(stub)は振る舞いを持たないので鍵に含めない。輪になっても訪問済みで止まる。
 */
function reachableBehavior(codebase: Codebase, entryMethodId: string): { readonly keys: Set<string>; readonly methodIds: Set<string> } {
  const keys = new Set<string>();
  const methodIds = new Set<string>();
  const pending = [entryMethodId];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (methodIds.has(id)) continue;
    const method = findMethod(codebase, id);
    if (method === undefined) continue;
    methodIds.add(id);
    for (const fragment of method.fragments) {
      if (fragment.responsibility !== 'call' && fragment.stub !== true) keys.add(behaviorKey(fragment.responsibility, fragment.label));
      pending.push(...(fragment.uses ?? []));
    }
  }
  return { keys, methodIds };
}

/** ステージの初期コードからテストを作る。入口が無ければ空。 */
export function behaviorTests(stage: Pick<Stage, 'codebase'>): readonly BehaviorTest[] {
  const methods = allClasses(stage.codebase).flatMap((codeClass) => codeClass.methods);
  const used = new Set(methods.flatMap((method) => method.fragments).flatMap((fragment) => fragment.uses ?? []));
  return methods
    // 空実装だけのメソッドは振る舞いを持たないので入口にしない(消しても振る舞いは変わらない)
    .filter((method) => method.fragments.length > 0 && !isStubMethod(method) && !used.has(method.id))
    .map((method) => ({ entryMethodId: method.id, expected: reachableBehavior(stage.codebase, method.id).keys }));
}

function failuresOf(
  stage: Pick<Stage, 'codebase' | 'visibilityEnforced'>,
  codebase: Codebase,
  test: BehaviorTest,
  initialViolations: ReadonlySet<string>,
): TestFailure[] {
  if (findMethod(codebase, test.entryMethodId) === undefined) return [{ kind: 'entry-missing' }];
  const actual = reachableBehavior(codebase, test.entryMethodId);
  const missing = [...test.expected].filter((key) => !actual.keys.has(key));
  const added = [...actual.keys].filter((key) => !test.expected.has(key));
  const violations = stage.visibilityEnforced === true
    ? countedVisibilityViolations(codebase, true).filter(
        (violation) => !initialViolations.has(`${violation.methodId} ${violation.callerClassId}`) && actual.methodIds.has(violation.methodId),
      )
    : [];
  return [
    ...(missing.length > 0 ? [{ kind: 'missing' as const, keys: missing }] : []),
    ...(added.length > 0 ? [{ kind: 'added' as const, keys: added }] : []),
    ...(violations.length > 0 ? [{ kind: 'compile' as const, violations }] : []),
  ];
}

// ponytail: 「振る舞い」は実行される処理の集合で近似する。実行順・回数・引数は見ない。順序を入れ替えるような操作を足すときに、順序も比べるようにする
/** 今のコードでテストを実行する。 */
export function runBehaviorTests(stage: Pick<Stage, 'codebase' | 'visibilityEnforced'>, codebase: Codebase): readonly TestResult[] {
  const initialViolations = new Set(countedVisibilityViolations(stage.codebase, true).map((violation) => `${violation.methodId} ${violation.callerClassId}`));
  return behaviorTests(stage).map((test) => ({ test, failures: failuresOf(stage, codebase, test, initialViolations) }));
}
