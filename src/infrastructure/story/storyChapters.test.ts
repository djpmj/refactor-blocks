import { describe, expect, it } from 'vitest';
import { stages } from '../stages/stageCatalog';
import { storyChapters } from './storyChapters';

const isBlank = (text: string): boolean => text.trim() === '';

describe('storyChapters', () => {
  it('すべての章の stageId が stages に存在する', () => {
    // Arrange
    const stageIds = stages.map((stage) => stage.id);
    // Act
    const unknown = storyChapters.filter((chapter) => !stageIds.includes(chapter.stageId));
    // Assert
    expect(unknown).toEqual([]);
  });

  it('stageId が重複しない', () => {
    // Arrange
    const ids = storyChapters.map((chapter) => chapter.stageId);
    // Act
    const unique = new Set(ids);
    // Assert
    expect(unique.size).toBe(ids.length);
  });

  it('章の並びが stages の並びと同じ順', () => {
    // Arrange
    const chapterIds = storyChapters.map((chapter) => chapter.stageId);
    // Act
    const expected = stages.map((stage) => stage.id).filter((id) => chapterIds.includes(id));
    // Assert
    expect(chapterIds).toEqual(expected);
  });

  it('今の全ステージに章がある', () => {
    // Arrange
    const chapterIds = storyChapters.map((chapter) => chapter.stageId);
    // Act
    const missing = stages.filter((stage) => !chapterIds.includes(stage.id)).map((stage) => stage.id);
    // Assert
    expect(missing).toEqual([]);
  });

  it('title・speaker・intro・outro が空でない', () => {
    // Arrange
    // Act
    const empty = storyChapters.filter((chapter) => [chapter.title, chapter.speaker, chapter.intro, chapter.outro].some(isBlank));
    // Assert
    expect(empty).toEqual([]);
  });
});
