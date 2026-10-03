import { createContext, useContext } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';

export type CodebasePreviewValue = { readonly codebase: Codebase; readonly methodLimit: number };

/** プレビュー用のノードは store ではなくここから Codebase・行数上限を読む。 */
const CodebasePreviewContext = createContext<CodebasePreviewValue | null>(null);

export const CodebasePreviewProvider = CodebasePreviewContext.Provider;

export function useCodebasePreview(): CodebasePreviewValue {
  const value = useContext(CodebasePreviewContext);
  if (value === null) throw new Error('CodebasePreviewProvider の外で使われました');
  return value;
}
