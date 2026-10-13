import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { responsibilityMarkLetter, responsibilityMarks } from './responsibilityMarks';

function codebase(responsibilities: readonly string[]): Codebase {
  return {
    files: [{ id: 'file', path: 'a.ts', classes: [{ id: 'class', name: 'A', methods: responsibilities.map((responsibility, index) => ({
      id: `method-${index}`, name: `method${index}`, visibility: 'public',
      fragments: [{ id: `fragment-${index}`, label: responsibility, lines: 1, responsibility }],
    })) }] }],
  };
}

describe('responsibilityMarks', () => {
  it('色の周期を越えても異なる英字の印を付けられる', () => {
    // Arrange
    const numbers = [0, 8, 25, 26, 27];

    // Act
    const letters = numbers.map(responsibilityMarkLetter);

    // Assert
    expect(letters).toEqual(['A', 'I', 'Z', 'AA', 'AB']);
  });

  it('初期コードの最初の出現順に連番を付け、currentだけの責務は辞書順で列挙する', () => {
    // Arrange
    const initial = codebase(['x', 'y', 'x', 'z', 'call']);
    const current = codebase(['p', 'm', 'call']);

    // Act
    const marks = responsibilityMarks(initial, current);

    // Assert
    expect([...marks.keys()]).toEqual(['x', 'y', 'z', 'm', 'p']);
    expect(marks.get('x')).toBe(0);
    expect(marks.get('y')).toBe(1);
    expect(marks.get('z')).toBe(2);
    expect(marks.get('m')).not.toBe(marks.get('p'));
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
