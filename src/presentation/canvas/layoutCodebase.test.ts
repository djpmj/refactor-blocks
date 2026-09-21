import { describe, expect, it } from "vitest";
import type { Codebase, Fragment } from "../../domain/codebase/Codebase";
import { dependencyEdges } from "./layoutCodebase";

function callFragment(id: string, uses: readonly string[]): Fragment {
  return { id, label: id, lines: 1, responsibility: "call", uses };
}

/** 各クラスを(ファイル, クラス名, 呼ぶメソッド)で指定する。ファイルは登場順に左から並ぶ。 */
function codebaseOf(
  specs: readonly (readonly [string, string, readonly string[]])[],
): Codebase {
  const paths = [...new Set(specs.map(([path]) => path))];
  return {
    files: paths.map((path) => ({
      id: `file-${path}`,
      path,
      classes: specs
        .filter(([filePath]) => filePath === path)
        .map(([, name, uses]) => ({
          id: `class-${name}`,
          name,
          methods: [
            {
              id: `method-${name}`,
              name: "run",
              visibility: "public",
              fragments: [callFragment(`f-${name}`, uses)],
            },
          ],
        })),
    })),
  };
}

describe("dependencyEdges", () => {
  it("右のファイルのクラスへは、右端から左端へつなぐ", () => {
    // Arrange
    const codebase = codebaseOf([
      ["a", "A", ["method-B"]],
      ["b", "B", []],
    ]);

    // Act
    const [edge] = dependencyEdges(codebase);

    // Assert
    expect(edge).toMatchObject({
      source: "class-A",
      sourceHandle: "source-right",
      target: "class-B",
      targetHandle: "target-left",
    });
  });

  it("左のファイルのクラスへは、左端から右端へつなぐ", () => {
    // Arrange
    const codebase = codebaseOf([
      ["a", "A", []],
      ["b", "B", ["method-A"]],
    ]);

    // Act
    const [edge] = dependencyEdges(codebase);

    // Assert
    expect(edge).toMatchObject({
      source: "class-B",
      sourceHandle: "source-left",
      target: "class-A",
      targetHandle: "target-right",
    });
  });

  it("同じファイルのクラス同士は、右端どうしでつなぐ", () => {
    // Arrange
    const codebase = codebaseOf([
      ["a", "A", ["method-B"]],
      ["a", "B", []],
    ]);

    // Act
    const [edge] = dependencyEdges(codebase);

    // Assert
    expect(edge).toMatchObject({
      sourceHandle: "source-right",
      targetHandle: "target-right",
    });
  });

  it("矢印はファイルの箱より手前に描く", () => {
    // Arrange
    const codebase = codebaseOf([
      ["a", "A", ["method-B"]],
      ["b", "B", []],
    ]);

    // Act
    const [edge] = dependencyEdges(codebase);

    // Assert
    expect(edge.zIndex).toBeGreaterThan(0);
  });
});
