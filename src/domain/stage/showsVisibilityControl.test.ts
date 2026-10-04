import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import type { Stage } from './Stage';
import { showsVisibilityControl } from './showsVisibilityControl';

const emptyCodebase: Codebase = { files: [] };

describe('showsVisibilityControl', () => {
  it('可視性を採点するステージでは、protected がなくても表示する', () => {
    // Arrange
    const stage: Pick<Stage, 'visibilityEnforced' | 'codebase'> = {
      visibilityEnforced: true,
      codebase: emptyCodebase,
    };

    // Act
    const result = showsVisibilityControl(stage);

    // Assert
    expect(result).toBe(true);
  });

  it('可視性を採点せず protected もないステージでは表示しない', () => {
    // Arrange
    const stage: Pick<Stage, 'visibilityEnforced' | 'codebase'> = {
      codebase: {
        files: [
          {
            id: 'file-a',
            path: 'A.ts',
            classes: [
              {
                id: 'class-a',
                name: 'A',
                methods: [{ id: 'method-a', name: 'run', visibility: 'public', fragments: [] }],
              },
            ],
          },
        ],
      },
    };

    // Act
    const result = showsVisibilityControl(stage);

    // Assert
    expect(result).toBe(false);
  });

  it('どれかのクラスに protected メソッドがあれば表示する', () => {
    // Arrange
    const stage: Pick<Stage, 'visibilityEnforced' | 'codebase'> = {
      codebase: {
        files: [
          {
            id: 'file-a',
            path: 'A.ts',
            classes: [
              {
                id: 'class-a',
                name: 'A',
                methods: [{ id: 'method-a', name: 'run', visibility: 'protected', fragments: [] }],
              },
            ],
          },
        ],
      },
    };

    // Act
    const result = showsVisibilityControl(stage);

    // Assert
    expect(result).toBe(true);
  });

  it('visibilityEnforced が false でも protected メソッドがあれば表示する', () => {
    // Arrange
    const stage: Pick<Stage, 'visibilityEnforced' | 'codebase'> = {
      visibilityEnforced: false,
      codebase: {
        files: [
          {
            id: 'file-a',
            path: 'A.ts',
            classes: [
              {
                id: 'class-a',
                name: 'A',
                methods: [{ id: 'method-a', name: 'run', visibility: 'protected', fragments: [] }],
              },
            ],
          },
        ],
      },
    };

    // Act
    const result = showsVisibilityControl(stage);

    // Assert
    expect(result).toBe(true);
  });

  it('ファイルもクラスもメソッドもないコードベースでは表示しない', () => {
    // Arrange
    const stage: Pick<Stage, 'visibilityEnforced' | 'codebase'> = { codebase: emptyCodebase };

    // Act
    const result = showsVisibilityControl(stage);

    // Assert
    expect(result).toBe(false);
  });
});
