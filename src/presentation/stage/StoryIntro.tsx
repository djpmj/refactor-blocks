import { useState } from 'react';
import { chapterOf } from '../../domain/story/Story';
import { storyChapters } from '../../infrastructure/story/storyChapters';
import { useGameStore } from '../store/useGameStore';

/** 章の導入。閉じたステージを覚えておき、別のステージへ切り替えたらまた出る。 */
export function StoryIntro({ stageId }: Readonly<{ stageId: string }>) {
  const [closed, setClosed] = useState(false);
  const enabled = useGameStore((state) => state.storyEnabled);
  const found = chapterOf(storyChapters, stageId);
  if (!enabled || found === undefined) return null;
  if (closed) {
    return (
      <button type="button" className="story-card__reopen" aria-expanded="false" onClick={() => setClosed(false)}>
        第{found.number}章 {found.chapter.title} ▸
      </button>
    );
  }
  return (
    <section className="story-card" aria-label="章の導入" data-testid="story-intro">
      <h3>
        第{found.number}章 {found.chapter.title}
      </h3>
      <p className="story-card__speaker">{found.chapter.speaker}</p>
      <p>{found.chapter.intro}</p>
      <button type="button" onClick={() => setClosed(true)}>
        閉じる
      </button>
    </section>
  );
}
