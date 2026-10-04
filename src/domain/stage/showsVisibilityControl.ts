import type { Stage } from './Stage';

/** 可視性を学ぶステージか、protected メソッドを扱うステージなら選択欄を表示する。 */
export function showsVisibilityControl(stage: Pick<Stage, 'visibilityEnforced' | 'codebase'>): boolean {
  return (
    stage.visibilityEnforced === true ||
    stage.codebase.files.some((file) =>
      file.classes.some((codeClass) => codeClass.methods.some((method) => method.visibility === 'protected')),
    )
  );
}
