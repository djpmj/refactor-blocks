import { describe, expect, it } from 'vitest';
import { placeFiles } from './keepFilePositions';
import type { CodebaseFlowNode } from './layoutCodebase';

function file(id: string, x: number, y: number, size = { width: 120, height: 100 }): CodebaseFlowNode {
  return { id, type: 'fileNode', position: { x, y }, style: size, data: { fileId: id } };
}

describe('placeFiles', () => {
  it('知っているファイルは依存関係が変わっても記憶した位置に置く', () => {
    // Arrange
    const known = new Map([['a', { x: 400, y: 120 }], ['b', { x: 50, y: 300 }]]);

    // Act
    const placed = placeFiles([file('a', 0, 0), file('b', 0, 200)], known, new Map());

    // Assert
    expect(placed.map((node) => node.position)).toEqual([{ x: 400, y: 120 }, { x: 50, y: 300 }]);
  });

  it('知らないファイルは既存矩形の右隣に上端を合わせて置く', () => {
    // Arrange
    const known = new Map([['a', { x: 20, y: 80 }]]);
    const rects = new Map([['a', { x: 20, y: 80, width: 180, height: 120 }]]);

    // Act
    const placed = placeFiles([file('a', 0, 0), file('b', 0, 300)], known, rects);

    // Assert
    expect(placed[1]?.position).toEqual({ x: 260, y: 80 });
  });

  it('知らないファイルが複数なら既存矩形の右へ順に置く', () => {
    // Arrange
    const rects = new Map([['a', { x: 20, y: 80, width: 180, height: 120 }]]);

    // Act
    const placed = placeFiles([file('a', 20, 80), file('b', 0, 0), file('c', 0, 0)], new Map([['a', { x: 20, y: 80 }]]), rects);

    // Assert
    expect(placed.slice(1).map((node) => node.position)).toEqual([{ x: 260, y: 80 }, { x: 440, y: 80 }]);
  });

  it('知らないファイルを右へ順に並べて、ドロップ位置と既知の座標を保つ', () => {
    // Arrange
    const known = new Map([['a', { x: 20, y: 80 }], ['d', { x: 900, y: 40 }]]);
    const rects = new Map([['a', { x: 20, y: 80, width: 180, height: 120 }]]);
    const nodes = [file('a', 0, 0), file('b', 0, 0), file('c', 0, 0), file('d', 0, 0)];

    // Act
    const placed = placeFiles(nodes, known, rects, new Map([['c', { x: 700, y: 500 }]]));

    // Assert
    expect(placed.map((node) => node.position)).toEqual([
      { x: 20, y: 80 }, { x: 260, y: 80 }, { x: 700, y: 500 }, { x: 900, y: 40 },
    ]);
  });

  it('既知位置に残る削除済みファイルは配置せず、配置位置のない初期状態は元のまま', () => {
    // Arrange
    const nodes = [file('a', 10, 20), file('b', 300, 40)];
    const known = new Map([['deleted', { x: 999, y: 999 }]]);

    // Act
    const placed = placeFiles(nodes, known, new Map());

    // Assert
    expect(placed).toEqual(nodes);
  });
});
