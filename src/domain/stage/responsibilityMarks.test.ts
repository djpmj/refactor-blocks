import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { responsibilityMarks } from './responsibilityMarks';

function codebase(responsibilities: readonly string[]): Codebase {
  return {
    files: [{ id: 'file', path: 'a.ts', classes: [{ id: 'class', name: 'A', methods: responsibilities.map((responsibility, index) => ({
      id: `method-${index}`, name: `method${index}`, visibility: 'public',
      fragments: [{ id: `fragment-${index}`, label: responsibility, lines: 1, responsibility }],
    })) }] }],
  };
}

describe('responsibilityMarks', () => {
  it('初期コードの最初の出現順に連番を付け、予約された変更依頼の責務は辞書順で続ける', () => {
    // Arrange
    const initial = codebase(['x', 'y', 'x', 'z', 'call']);
    const current = codebase(['p', 'm', 'call']);

    // Act
    const marks = responsibilityMarks(initial, current, ['p', 'm']);

    // Assert
    expect([...marks.keys()]).toEqual(['x', 'y', 'z', 'm', 'p']);
    expect(marks.get('x')).toBe(0);
    expect(marks.get('y')).toBe(1);
    expect(marks.get('z')).toBe(2);
    expect(marks.get('m')).toBe(3);
    expect(marks.get('p')).toBe(4);
  });

  it('後から表示される変更依頼の責務が既存の印をずらさない', () => {
    // Arrange
    const initial = codebase(['x', 'y']);
    const reserved = ['p', 'm'];
    const beforeSecondRequest = codebase(['x', 'p']);
    const afterSecondRequest = codebase(['x', 'p', 'm']);

    // Act
    const beforeMarks = responsibilityMarks(initial, beforeSecondRequest, reserved);
    const afterMarks = responsibilityMarks(initial, afterSecondRequest, reserved);

    // Assert
    expect(beforeMarks.get('p')).toBe(3);
    expect(afterMarks.get('p')).toBe(3);
    expect(afterMarks.get('m')).toBe(2);
  });


  it('クラスを移動しても初期コードにある責務の番号は変わらない', () => {
    // Arrange
    const initial = codebase(['x', 'y']);
    const moved: Codebase = { files: [{ id: 'other', path: 'b.ts', classes: [{ id: 'new-class', name: 'B', methods: [{ id: 'moved', name: 'moved', visibility: 'public', fragments: [{ id: 'fragment', label: 'x', lines: 1, responsibility: 'x' }] }] }] }] };

    // Act
    const marks = responsibilityMarks(initial, moved);

    // Assert
    expect(marks.get('x')).toBe(0);
    expect(marks.get('y')).toBe(1);
  });
});
