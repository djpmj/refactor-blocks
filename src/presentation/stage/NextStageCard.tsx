import { remainingMilestones } from '../../domain/progress/milestones';
import { recommendNextStage } from '../../domain/progress/roadmap';
import { chapterOf } from '../../domain/story/Story';
import type { Stage } from '../../domain/stage/Stage';
import { storyChapters } from '../../infrastructure/story/storyChapters';
import { useGameStore } from '../store/useGameStore';
import { MILESTONE_LABEL } from './milestoneLabel';

/** 100点のとき、次のおすすめのステージへ進む入口。StoryOutro が出ているときは、そちらの「次の章へ」に任せる。 */
export function NextStageCard({ stage, perfect }: Readonly<{ stage: Stage; perfect: boolean }>) {
  const storyEnabled = useGameStore((state) => state.storyEnabled);
  const stages = useGameStore((state) => state.stages);
  const progress = useGameStore((state) => state.progress);
  const milestones = useGameStore((state) => state.milestones);
  const selectStage = useGameStore((state) => state.selectStage);
  const manualFixing = useGameStore((state) => state.manualFix !== null);
  const outroShown = storyEnabled && chapterOf(storyChapters, stage.id) !== undefined;
  if (!perfect || outroShown || manualFixing) return null;
  const next = recommendNextStage(stages.filter((candidate) => candidate.id !== stage.id), progress, milestones);
  const remaining = remainingMilestones(stage, milestones);
  const heading = remaining.length === 0 ? 'ステージクリア' : '100点達成';
  return (
    <section className="story-card" aria-label={heading} data-testid="next-stage-card">
      <h3>{heading}</h3>
      {remaining.length > 0 && <p data-testid="next-stage-remaining">このステージの残り: {remaining.map((milestone) => MILESTONE_LABEL[milestone]).join('・')}</p>}
      {next === undefined ? (
        remaining.length === 0 && <p>全ステージをクリアしました</p>
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
