import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import type { Stage } from '../stage/Stage';
import { isDraft, putDraft, takeDraft, type Drafts } from './drafts';
import { stageFingerprint } from './stageFingerprint';

function codebase(lines: number): Codebase {
  return { files: [{ id: 'f', path: 'a.cs', classes: [{ id: 'c', name: 'C', methods: [{ id: 'm', name: 'm', visibility: 'public', fragments: [{ id: 'fr', label: 'l', lines, responsibility: 'r' }] }] }] }] };
}

function stageOf(id: string, lines: number): Stage {
  return {
    id,
    level: 'tutorial',
    title: id,
    why: '',
    goal: '',
    problem: '',
    description: '',
    learns: ['Extract Method'],
    checks: [],
    limits: { method: 10, class: 20, file: 30 },
    dependencyLimit: 3,
    responsibilityLimit: 2,
    codebase: codebase(lines),
    classNames: {},
    responsibilityNames: {},
    changeRequests: [],
  };
}

describe('putDraft / takeDraft', () => {
  it('putDraft したコードを takeDraft で取り出せる', () => {
    // Arrange
    const stage = stageOf('a', 10);
    const edited = codebase(5);

    // Act
    const drafts = putDraft({}, stage, edited);

    // Assert
    expect(takeDraft(drafts, stage)).toEqual(edited);
  });

  it('初期コードそのものを渡すとそのステージの下書きが消える', () => {
    // Arrange
    const stage = stageOf('a', 10);
    const drafts = putDraft({}, stage, codebase(5));

    // Act
    const next = putDraft(drafts, stage, stage.codebase);

    // Assert
    expect(takeDraft(next, stage)).toBeUndefined();
  });

  it('指紋が違う下書きは使わない', () => {
    // Arrange
    const drafts = putDraft({}, stageOf('a', 10), codebase(5));

    // Act
    const taken = takeDraft(drafts, stageOf('a', 11));

    // Assert
    expect(taken).toBeUndefined();
  });

  it('形が壊れた下書きは使わない', () => {
    // Arrange
    const stage = stageOf('a', 10);
    const broken: Drafts = { a: { fingerprint: stageFingerprint(stage), codebase: codebase(-1) } };

    // Act
    const taken = takeDraft(broken, stage);

    // Assert
    expect(taken).toBeUndefined();
  });

  it('以前の役割タグなしの下書きも復元し、ステージの役割タグを引き継ぐ', () => {
    // Arrange
    const oldStage = stageOf('a', 10);
    const stage: Stage = {
      ...oldStage,
      codebase: { files: [{ id: 'f', path: 'a.cs', classes: [{ ...codebase(10).files[0].classes[0], roleResponsibilities: ['tax'] }] }] },
    };
    const legacy = codebase(5);
    const drafts: Drafts = { a: { fingerprint: stageFingerprint(oldStage), codebase: legacy } };

    // Act
    const restored = takeDraft(drafts, stage);

    // Assert
    expect(stageFingerprint(stage)).toBe(stageFingerprint(oldStage));
    expect(restored?.files[0].classes[0].roleResponsibilities).toEqual(['tax']);
    expect(restored?.files[0].classes[0].methods[0].fragments[0].lines).toBe(5);
  });

  it('別のステージの下書きには影響しない', () => {
    // Arrange
    const a = stageOf('a', 10);
    const b = stageOf('b', 10);
    const drafts = putDraft({}, a, codebase(5));

    // Act
    const next = putDraft(drafts, b, b.codebase);

    // Assert
    expect(takeDraft(next, a)).toEqual(codebase(5));
  });

  it('元の Drafts を変更しない', () => {
    // Arrange
    const stage = stageOf('a', 10);
    const drafts: Drafts = {};

    // Act
    const next = putDraft(drafts, stage, codebase(5));

    // Assert
    expect(next).not.toBe(drafts);
    expect(drafts).toEqual({});
  });
});

describe('isDraft', () => {
  it('fingerprint が文字列で codebase が正しければ true', () => {
    // Arrange
    const value = { fingerprint: 'abc', codebase: codebase(3) };

    // Act & Assert
    expect(isDraft(value)).toBe(true);
  });

  it('null・fingerprint なし・fingerprint が数値・codebase が不正なら false', () => {
    // Arrange・Act・Assert
    expect(isDraft(null)).toBe(false);
    expect(isDraft({ fingerprint: 'abc' })).toBe(false);
    expect(isDraft({ fingerprint: 1, codebase: codebase(3) })).toBe(false);
    expect(isDraft({ fingerprint: 'abc', codebase: {} })).toBe(false);
  });
});
