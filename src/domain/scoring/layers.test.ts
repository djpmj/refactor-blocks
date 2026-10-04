import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import type { StageLayer } from '../stage/Stage';
import { classLayers, findLayerViolations } from './layers';

const LAYERS: readonly StageLayer[] = [
  { name: 'Controller', responsibilities: ['http'] },
  { name: 'Service', responsibilities: ['rule'] },
  { name: 'Repository', responsibilities: ['persistence'] },
];

type ClassSpec = { readonly responsibilities: readonly string[]; readonly uses?: readonly string[] };

/** クラスごとに「責務の並び」と「呼ぶメソッドID(`m-<クラスID>`)」を指定してコードベースを作る。 */
function codebaseOf(specs: Record<string, ClassSpec>): Codebase {
  const classes = Object.entries(specs).map(([id, spec]) => ({
    id,
    name: id,
    methods: [
      {
        id: `m-${id}`,
        name: `run${id}`,
        visibility: 'public' as const,
        fragments: spec.responsibilities.map((responsibility, index) => ({
          id: `f-${id}-${String(index)}`,
          label: responsibility,
          lines: 1,
          responsibility,
          uses: index === 0 ? spec.uses : undefined,
        })),
      },
    ],
  }));
  return { files: [{ id: 'file', path: 'src/all.ts', classes }] };
}

describe('classLayers', () => {
  it('http だけのクラスは層0、persistence だけのクラスは層2', () => {
    // Arrange
    const codebase = codebaseOf({ C: { responsibilities: ['http'] }, R: { responsibilities: ['persistence'] } });

    // Act
    const layers = classLayers(codebase, LAYERS);

    // Assert
    expect(layers.get('C')).toBe(0);
    expect(layers.get('R')).toBe(2);
  });

  it('http と persistence が混ざったクラスは、上の層の0になる', () => {
    // Arrange
    const codebase = codebaseOf({ X: { responsibilities: ['persistence', 'http'] } });

    // Act
    const layers = classLayers(codebase, LAYERS);

    // Assert
    expect(layers.get('X')).toBe(0);
  });

  it('call だけのクラス・空のクラス・どの層の責務も持たないクラスは含めない', () => {
    // Arrange
    const codebase = codebaseOf({ A: { responsibilities: ['call'] }, B: { responsibilities: [] }, C: { responsibilities: ['misc'] } });

    // Act
    const layers = classLayers(codebase, LAYERS);

    // Assert
    expect(layers.size).toBe(0);
  });

  it('layers が空なら空の Map', () => {
    // Arrange
    const codebase = codebaseOf({ C: { responsibilities: ['http'] } });

    // Act
    const layers = classLayers(codebase, []);

    // Assert
    expect(layers.size).toBe(0);
  });
});

describe('findLayerViolations', () => {
  it('layers が undefined なら空', () => {
    // Arrange
    const codebase = codebaseOf({ C: { responsibilities: ['http'], uses: ['m-R'] }, R: { responsibilities: ['persistence'] } });

    // Act
    const violations = findLayerViolations(codebase, undefined);

    // Assert
    expect(violations).toEqual([]);
  });

  it('Controller → Service → Repository の一方通行なら0件', () => {
    // Arrange
    const codebase = codebaseOf({
      C: { responsibilities: ['http'], uses: ['m-S'] },
      S: { responsibilities: ['rule'], uses: ['m-R'] },
      R: { responsibilities: ['persistence'] },
    });

    // Act
    const violations = findLayerViolations(codebase, LAYERS);

    // Assert
    expect(violations).toEqual([]);
  });

  it('Controller → Repository を直接呼ぶと skip が1件', () => {
    // Arrange
    const codebase = codebaseOf({ C: { responsibilities: ['http'], uses: ['m-R'] }, R: { responsibilities: ['persistence'] } });

    // Act
    const violations = findLayerViolations(codebase, LAYERS);

    // Assert
    expect(violations).toEqual([{ fromClassId: 'C', toClassId: 'R', kind: 'skip' }]);
  });

  it('Repository → Service を呼ぶと upward が1件', () => {
    // Arrange
    const codebase = codebaseOf({ S: { responsibilities: ['rule'] }, R: { responsibilities: ['persistence'], uses: ['m-S'] } });

    // Act
    const violations = findLayerViolations(codebase, LAYERS);

    // Assert
    expect(violations).toEqual([{ fromClassId: 'R', toClassId: 'S', kind: 'upward' }]);
  });

  it('同じ層のクラスどうしの依存は違反にしない', () => {
    // Arrange
    const codebase = codebaseOf({ A: { responsibilities: ['rule'], uses: ['m-B'] }, B: { responsibilities: ['rule'] } });

    // Act
    const violations = findLayerViolations(codebase, LAYERS);

    // Assert
    expect(violations).toEqual([]);
  });

  it('層の無いクラスとの依存は違反にしない', () => {
    // Arrange
    const codebase = codebaseOf({
      C: { responsibilities: ['http'], uses: ['m-U'] },
      U: { responsibilities: ['misc'], uses: ['m-R'] },
      R: { responsibilities: ['persistence'] },
    });

    // Act
    const violations = findLayerViolations(codebase, LAYERS);

    // Assert
    expect(violations).toEqual([]);
  });
});
