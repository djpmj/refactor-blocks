import { recommendNextStage } from '../../domain/progress/roadmap';
import { chapterOf } from '../../domain/story/Story';
import type { Stage } from '../../domain/stage/Stage';
import { storyChapters } from '../../infrastructure/story/storyChapters';
import { useGameStore } from '../store/useGameStore';

/** 100点のとき、次のおすすめのステージへ進む入口。StoryOutro が出ているときは、そちらの「次の章へ」に任せる。 */
export function NextStageCard({ stage, perfect }: Readonly<{ stage: Stage; perfect: boolean }>) {
  const storyEnabled = useGameStore((state) => state.storyEnabled);
  const stages = useGameStore((state) => state.stages);
  const progress = useGameStore((state) => state.progress);
  const selectStage = useGameStore((state) => state.selectStage);
  const outroShown = storyEnabled && chapterOf(storyChapters, stage.id) !== undefined;
  if (!perfect || outroShown) return null;
  const next = recommendNextStage(stages, progress);
  // 記録が追いつく前の一瞬は、自分自身がおすすめに出る
  if (next?.id === stage.id) return null;
  return (
    <section className="story-card" aria-label="ステージクリア" data-testid="next-stage-card">
      <h3>ステージクリア</h3>
      {next === undefined ? (
        <p>全ステージをクリアしました</p>
      ) : (
        <>
          <p>次のおすすめ: {next.title}</p>
          <button type="button" data-testid="next-stage-go" onClick={() => selectStage(next.id)}>
            次のステージへ
          </button>
        </>
      )}
    </section>
  );
}
