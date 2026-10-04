import { describe, expect, it } from 'vitest';
import { chapterOf, nextChapter, type StoryChapter } from './Story';

function chapter(stageId: string): StoryChapter {
  return { stageId, title: `題-${stageId}`, speaker: '先輩', intro: '導入', outro: '結び' };
}

describe('chapterOf', () => {
  it('章があるステージなら、その章と1始まりの番号を返す', () => {
    // Arrange
    const chapters = [chapter('a'), chapter('b')];
    // Act
    const found = chapterOf(chapters, 'b');
    // Assert
    expect(found).toEqual({ chapter: chapters[1], number: 2 });
  });

  it('章の無いステージなら undefined', () => {
    // Arrange
    const chapters = [chapter('a')];
    // Act
    const found = chapterOf(chapters, 'x');
    // Assert
    expect(found).toBeUndefined();
  });
});

describe('nextChapter', () => {
  it('途中の章なら、その次の章を返す', () => {
    // Arrange
    const chapters = [chapter('a'), chapter('b')];
    // Act
    const next = nextChapter(chapters, 'a');
    // Assert
    expect(next).toBe(chapters[1]);
  });

  it('最後の章なら undefined', () => {
    // Arrange
    const chapters = [chapter('a'), chapter('b')];
    // Act
    const next = nextChapter(chapters, 'b');
    // Assert
    expect(next).toBeUndefined();
  });

  it('章の無いステージなら undefined', () => {
    // Arrange
    const chapters = [chapter('a'), chapter('b')];
    // Act
    const next = nextChapter(chapters, 'x');
    // Assert
    expect(next).toBeUndefined();
  });
});
