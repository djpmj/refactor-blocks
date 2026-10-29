import { describe, expect, it } from 'vitest';
import { methodNamingOf } from './methodNaming';
import type { SolutionStep } from './sampleAnswer';

describe('methodNamingOf', () => {
  it('extractの処理数によらず名前の組として取り込み、責務名を返す', () => {
    // Arrange
    const steps: readonly SolutionStep[] = [
      { extract: { from: 'work', fragmentIds: ['a', 'b'], name: 'combine' } },
      { extract: { from: 'work', fragmentIds: ['c'], name: 'single' } },
      { move: { method: 'combine', toClass: 'Other' } },
    ];
    const methodNames = { formatting: 'buildTable' };

    // Act
    const naming = methodNamingOf({ id: 'custom', methodNames }, { custom: steps });

    // Assert
    expect(naming).toEqual({ groups: [{ fragmentIds: ['a', 'b'], name: 'combine' }, { fragmentIds: ['c'], name: 'single' }], byResponsibility: methodNames });
  });

  it('模範解答も責務名も無ければ空の名前情報を返す', () => {
    // Arrange

    // Act
    const naming = methodNamingOf({ id: 'missing' }, {});

    // Assert
    expect(naming).toEqual({ groups: [], byResponsibility: {} });
  });
});
