/** ステージにひもづく物語の1章。ステージ定義とは分けて持つ。 */
export type StoryChapter = {
  readonly stageId: string;
  readonly title: string;
  /** 話し手。例: '先輩の田中さん' */
  readonly speaker: string;
  readonly intro: string;
  readonly outro: string;
};

/** そのステージの章と、章の番号(1始まり)。無ければ undefined。 */
export function chapterOf(chapters: readonly StoryChapter[], stageId: string): { readonly chapter: StoryChapter; readonly number: number } | undefined {
  const index = chapters.findIndex((chapter) => chapter.stageId === stageId);
  return index === -1 ? undefined : { chapter: chapters[index], number: index + 1 };
}

/** 次の章。最後の章・章の無いステージなら undefined。 */
export function nextChapter(chapters: readonly StoryChapter[], stageId: string): StoryChapter | undefined {
  const index = chapters.findIndex((chapter) => chapter.stageId === stageId);
  return index === -1 ? undefined : chapters.at(index + 1);
}
