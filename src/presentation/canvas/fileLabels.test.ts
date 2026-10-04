import { describe, expect, it } from 'vitest';
import type { Codebase } from '../../domain/codebase/Codebase';
import { fileLabels } from './fileLabels';

describe('fileLabels', () => {
  it('クラス名を連結し、空ファイルと重複ラベルを区別する', () => {
    // Arrange
    const codebase: Codebase = { files: [
      { id: 'a', path: 'a', classes: [{ id: 'a1', name: 'DiscountService', methods: [] }, { id: 'a2', name: 'Helper', methods: [] }] },
      { id: 'b', path: 'b', classes: [] },
      { id: 'c', path: 'c', classes: [] },
      { id: 'd', path: 'd', classes: [{ id: 'd1', name: 'DiscountService', methods: [] }, { id: 'd2', name: 'Helper', methods: [] }] },
    ] };

    // Act
    const result = fileLabels(codebase);

    // Assert
    expect(result.map(({ label }) => label)).toEqual(['DiscountService・Helper', '空のファイル', '空のファイル (2)', 'DiscountService・Helper (2)']);
  });
});
