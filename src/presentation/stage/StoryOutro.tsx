import { chapterOf, nextChapter } from '../../domain/story/Story';
import type { Stage } from '../../domain/stage/Stage';
import { storyChapters } from '../../infrastructure/story/storyChapters';
import { useGameStore } from '../store/useGameStore';

/** 章の結び。ストーリーがオンで、採点の対象のコードが100点(perfect)のとき、最初の変更依頼へつなぎ、次の章へ進めるようにする。 */
export function StoryOutro({ stage, perfect }: Readonly<{ stage: Stage; perfect: boolean }>) {
  const enabled = useGameStore((state) => state.storyEnabled);
  const startChangeRequests = useGameStore((state) => state.startChangeRequests);
  const selectStage = useGameStore((state) => state.selectStage);
  const found = chapterOf(storyChapters, stage.id);
  if (!enabled || !perfect || found === undefined) return null;
  const next = nextChapter(storyChapters, stage.id);
  const firstRequest = stage.changeRequests.at(0);
  return (
    <section className="story-card" aria-label="章の結び" data-testid="story-outro">
      <h3>第{found.number}章 おわり</h3>
      <p>{found.chapter.outro}</p>
      {firstRequest !== undefined && (
        <>
          <p>
            <strong data-testid="story-request-title">{firstRequest.title}</strong>
          </p>
          <button type="button" data-testid="story-accept" onClick={startChangeRequests}>
            依頼を受ける
          </button>
        </>
      )}
      {next === undefined ? (
        <p data-testid="story-finale">1年間、おつかれさまでした</p>
      ) : (
        <button type="button" data-testid="story-next" onClick={() => selectStage(next.stageId)}>
          次の章へ
        </button>
      )}
    </section>
  );
}
