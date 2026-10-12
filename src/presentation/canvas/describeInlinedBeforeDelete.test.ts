import { describe, expect, it } from 'vitest';
import { describeInlinedBeforeDelete } from './describeInlinedBeforeDelete';
import type { InlinedBeforeDelete } from '../../domain/codebase/deleteClass';

const inlined: readonly InlinedBeforeDelete[] = [1, 2, 3, 4].map((number) => ({
  className: `Manager${number}`,
  methodName: `method${number}`,
  callerClassName: `Controller${number}`,
  callerMethodName: `call${number}`,
}));

describe('describeInlinedBeforeDelete', () => {
  it('空なら案内しない', () => {
    expect(describeInlinedBeforeDelete([])).toBeNull();
  });

  it('3件までは全件を順に案内する', () => {
    expect(describeInlinedBeforeDelete(inlined.slice(0, 1))).toBe(
      '削除する前に、処理を呼び出し元へ戻しました: Manager1.method1() → Controller1.call1()',
    );
    expect(describeInlinedBeforeDelete(inlined.slice(0, 3))).toBe(
      '削除する前に、処理を呼び出し元へ戻しました: Manager1.method1() → Controller1.call1()、Manager2.method2() → Controller2.call2()、Manager3.method3() → Controller3.call3()',
    );
  });

  it('4件以上なら先頭3件と残り件数を案内する', () => {
    expect(describeInlinedBeforeDelete(inlined)).toBe(
      '削除する前に、処理を呼び出し元へ戻しました: Manager1.method1() → Controller1.call1()、Manager2.method2() → Controller2.call2()、Manager3.method3() → Controller3.call3()、ほか 1 件',
    );
  });
});
