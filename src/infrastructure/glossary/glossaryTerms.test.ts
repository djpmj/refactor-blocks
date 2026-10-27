import { describe, expect, it } from 'vitest';
import { splitByTerms } from '../../domain/glossary/Glossary';
import { stages } from '../stages/stageCatalog';
import { glossaryTerms } from './glossaryTerms';

const isBlank = (text: string): boolean => text.trim() === '';

describe('glossaryTerms', () => {
  it('id が重複しない', () => {
    // Arrange
    const ids = glossaryTerms.map((term) => term.id);

    // Assert
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('name と aliases を合わせて、表記が重複しない', () => {
    // Arrange
    const notations = glossaryTerms.flatMap((term) => [term.name, ...term.aliases]);

    // Assert
    expect(new Set(notations).size).toBe(notations.length);
  });

  it('name・definition・example が空でなく、definition は1〜2文', () => {
    // Assert
    for (const term of glossaryTerms) {
      expect(isBlank(term.name), term.id).toBe(false);
      expect(isBlank(term.definition), term.id).toBe(false);
      expect(isBlank(term.example), term.id).toBe(false);
      expect(term.definition.split('。').length - 1, term.id).toBeLessThanOrEqual(2);
    }
  });

  it('全ステージの learns のうち英字を含むタグは、用語が1つ以上見つかる', () => {
    // Arrange
    const tags = stages.flatMap((stage) => stage.learns).filter((tag) => /[A-Za-z]/.test(tag));

    // Assert
    for (const tag of tags) {
      expect(splitByTerms(tag, glossaryTerms).some((segment) => segment.kind === 'term'), tag).toBe(true);
    }
  });
});
