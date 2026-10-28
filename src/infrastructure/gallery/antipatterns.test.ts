import { describe, expect, it } from 'vitest';
import { practiceStages } from '../../domain/gallery/Antipattern';
import { stages } from '../stages/stageCatalog';
import { antipatterns } from './antipatterns';

describe('antipatterns', () => {
  it('id が重複しない', () => {
    // Arrange
    const ids = antipatterns.map((entry) => entry.id);

    // Act
    const unique = new Set(ids);

    // Assert
    expect(unique.size).toBe(ids.length);
  });

  it('文言が空でなく、症状・弊害・直し方は2文以内', () => {
    for (const entry of antipatterns) {
      // Arrange
      const sentences = [entry.symptom, entry.harm, entry.remedy];

      // Act・Assert
      expect(entry.name.trim(), entry.id).not.toBe('');
      for (const text of sentences) {
        expect(text.trim(), entry.id).not.toBe('');
        expect(text.split('。').length - 1, entry.id).toBeLessThanOrEqual(2);
      }
    }
  });

  it('learns が空でなく、各タグが実在するステージの learns にある', () => {
    // Arrange
    const known = new Set(stages.flatMap((stage) => stage.learns));

    for (const entry of antipatterns) {
      // Act・Assert
      expect(entry.learns.length, entry.id).toBeGreaterThan(0);
      for (const tag of entry.learns) expect(known.has(tag), `${entry.id}: ${tag}`).toBe(true);
    }
  });

  it('どの項目も練習できるステージが1件以上ある', () => {
    for (const entry of antipatterns) {
      // Act
      const practice = practiceStages(entry, stages);

      // Assert
      expect(practice.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('臭いと原則がそれぞれ1件以上ある', () => {
    // Arrange・Act
    const kinds = new Set(antipatterns.map((entry) => entry.kind));

    // Assert
    expect(kinds.has('smell')).toBe(true);
    expect(kinds.has('principle')).toBe(true);
  });
});
