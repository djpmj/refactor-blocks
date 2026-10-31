import { isStageCleared, unclearedPrerequisites } from '../../domain/progress/roadmap';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';

/** 前提のステージをまだクリアしていないとき、課題パネルの先頭で先にやるステージを案内する。 */
export function PrerequisiteNote({ stage }: Readonly<{ stage: Stage }>) {
  const stages = useGameStore((state) => state.stages);
  const progress = useGameStore((state) => state.progress);
  const selectStage = useGameStore((state) => state.selectStage);
  const investigating = useGameStore((state) => state.changeSession !== null);
  if (investigating || isStageCleared(stage.id, progress)) return null;
  const prerequisites = unclearedPrerequisites(stages, stage, (id) => isStageCleared(id, progress));
  if (prerequisites.length === 0) return null;
  return (
    <section className="story-card" aria-label="先にやると分かりやすいステージ" data-testid="prerequisite-note">
      {prerequisites.map(({ stage: prerequisite, concepts }) => (
        <p key={prerequisite.id}>
          先に「{prerequisite.title}」をやると分かりやすいです({concepts.join('・')})
          <button type="button" data-testid="prerequisite-go" aria-label={`${prerequisite.title}を開く`} onClick={() => selectStage(prerequisite.id)}>
            開く
          </button>
        </p>
      ))}
    </section>
  );
}
