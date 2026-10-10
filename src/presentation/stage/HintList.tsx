import type { Codebase } from '../../domain/codebase/Codebase';
import { stepTargets } from '../../domain/stage/stepTargets';
import type { SolutionStep } from '../../domain/stage/sampleAnswer';
import { useGameStore } from '../store/useGameStore';

type Hint = { readonly text: string; readonly step: SolutionStep };

function targetsAreReady(step: SolutionStep, target: ReturnType<typeof stepTargets>): boolean {
  if ('move' in step) return target.methodIds.length > 0 && target.classIds.length > 0;
  if ('merge' in step) return target.methodIds.length >= 2;
  return target.fileIds.length + target.classIds.length + target.methodIds.length > 0;
}

export function HintList({ hints, codebase, disabled = false }: Readonly<{ hints: readonly Hint[]; codebase: Codebase; disabled?: boolean }>) {
  const hintTarget = useGameStore((state) => state.hintTarget);
  const hintTargetKey = useGameStore((state) => state.hintTargetKey);
  const focusHint = useGameStore((state) => state.focusHint);
  if (hints.length === 0) return null;
  return (
    <ol className="stage-panel__hint-list">
      {hints.map(({ text, step }, index) => {
        const target = stepTargets(codebase, step);
        const hasTargets = targetsAreReady(step, target);
        const hintKey = String(index);
        const pressed = hintTarget !== null && hintTargetKey === hintKey;
        return (
          <li key={index}>
            {text}{' '}
            <button
              type="button"
              aria-label={`ヒント${index + 1}の場所をキャンバスで見る`}
              aria-pressed={pressed}
              title={hasTargets ? undefined : 'まだこの名前のブロックがありません'}
              disabled={disabled || !hasTargets}
              onClick={() => focusHint(pressed ? null : target, hintKey)}
            >
              キャンバスで見る
            </button>
          </li>
        );
      })}
    </ol>
  );
}
