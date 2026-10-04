import { useMemo } from 'react';
import { findClassOfMethod, findMethod, allClasses, type Codebase } from '../../domain/codebase/Codebase';
import type { Stage } from '../../domain/stage/Stage';
import { runBehaviorTests, type TestFailure, type TestResult } from '../../domain/testing/behaviorTests';

/** 鍵(責務|ラベル)からラベルだけを取り出す。 */
function labelOf(key: string): string {
  return key.slice(key.indexOf('|') + 1);
}

function className(codebase: Codebase, classId: string): string {
  return allClasses(codebase).find((codeClass) => codeClass.id === classId)?.name ?? classId;
}

function describeFailure(codebase: Codebase, failure: TestFailure): string[] {
  switch (failure.kind) {
    case 'entry-missing':
      return ['テストが呼んでいるメソッドが見つかりません'];
    case 'missing':
      return [`実行されなくなった処理: ${failure.keys.map(labelOf).join('、')}`];
    case 'added':
      return [`新たに実行されるようになった処理: ${failure.keys.map(labelOf).join('、')}`];
    case 'compile':
      return failure.violations.map((violation) => {
        const owner = findClassOfMethod(codebase, violation.methodId);
        const name = findMethod(codebase, violation.methodId)?.name ?? violation.methodId;
        return `コンパイルエラー: ${className(codebase, violation.callerClassId)} から ${owner?.name ?? '?'}.${name} は呼べません(${violation.kind})`;
      });
  }
}

/** 今のコードでの「クラス名.メソッド名」。名前を変えた・移したら新しい名前になる。 */
function entryName(codebase: Codebase, methodId: string): string {
  const method = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  return method === undefined || owner === undefined ? methodId : `${owner.name}.${method.name}`;
}

function TestRow({ codebase, result }: Readonly<{ codebase: Codebase; result: TestResult }>) {
  const green = result.failures.length === 0;
  return (
    <li className={green ? 'test-status__item' : 'test-status__item test-status__item--red'}>
      {green ? '✓' : '✗'} {entryName(codebase, result.test.entryMethodId)} の振る舞い(処理 {result.test.expected.size} 個)
      {result.failures.flatMap((failure) => describeFailure(codebase, failure)).map((line) => (
        <p key={line} className="test-status__reason">
          {line}
        </p>
      ))}
    </li>
  );
}

/** ヘッダーのテストバッジ。振る舞いを守るテストが緑かどうかを見せる。入口が無いステージでは何も出さない。 */
export function TestStatus({ stage, codebase }: Readonly<{ stage: Stage; codebase: Codebase }>) {
  const results = useMemo(() => runBehaviorTests(stage, codebase), [stage, codebase]);
  if (results.length === 0) return null;
  const passed = results.filter((result) => result.failures.length === 0).length;
  const allGreen = passed === results.length;
  return (
    <details className="test-status" data-testid="test-status" aria-live="polite">
      <summary data-testid="test-status-summary">
        🧪 テスト {passed}/{results.length} {allGreen ? '✓' : '✗'}
      </summary>
      <div className="test-status__body">
        <p>リファクタリングは、振る舞いを変えずに構造だけを変えることです。テストが緑のままなら、分け方を変えても動作を壊していない証拠になります。</p>
        <ul className="test-status__list">
          {results.map((result) => (
            <TestRow key={result.test.entryMethodId} codebase={codebase} result={result} />
          ))}
        </ul>
      </div>
    </details>
  );
}
