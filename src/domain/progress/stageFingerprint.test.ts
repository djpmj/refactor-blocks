import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { stageFingerprint } from './stageFingerprint';

function codebase(lines: number): Codebase {
  return { files: [{ id: 'f', path: 'a.cs', classes: [{ id: 'c', name: 'C', methods: [{ id: 'm', name: 'm', visibility: 'public', fragments: [{ id: 'fr', label: 'l', lines, responsibility: 'r' }] }] }] }] };
}

describe('stageFingerprint', () => {
  it('同じ定義からは同じ値', () => {
    // Arrange / Act / Assert
    expect(stageFingerprint({ codebase: codebase(3) })).toBe(stageFingerprint({ codebase: codebase(3) }));
  });

  it('Fragment の lines が違えば違う値', () => {
    // Arrange / Act / Assert
    expect(stageFingerprint({ codebase: codebase(3) })).not.toBe(stageFingerprint({ codebase: codebase(4) }));
  });

  it('空でない文字列を返す', () => {
    // Arrange / Act
    const fingerprint = stageFingerprint({ codebase: codebase(3) });

    // Assert
    expect(fingerprint.length).toBeGreaterThan(0);
  });
});
