import type { InlinedBeforeDelete } from '../../domain/codebase/deleteClass';

/** 削除前に呼び出し元へ戻した処理をプレイヤーへ案内する。 */
export function describeInlinedBeforeDelete(inlined: readonly InlinedBeforeDelete[]): string | null {
  if (inlined.length === 0) return null;
  const shown = inlined.slice(0, 3).map(({ className, methodName, callerClassName, callerMethodName }) =>
    `${className}.${methodName}() → ${callerClassName}.${callerMethodName}()`,
  );
  const remaining = inlined.length - shown.length;
  if (remaining > 0) shown.push(`ほか ${remaining} 件`);
  return `削除する前に、処理を呼び出し元へ戻しました: ${shown.join('、')}`;
}
