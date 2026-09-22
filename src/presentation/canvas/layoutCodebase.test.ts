import { describe, expect, it } from "vitest";
import type { Codebase, Fragment } from "../../domain/codebase/Codebase";
import { dependencyEdges, inheritanceEdges } from "./layoutCodebase";

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

describe("inheritanceEdges", () => {
  function codebaseWithInheritance(superclassId?: string): Codebase {
    return {
      files: [
        {
          id: "file-a",
          path: "a",
          classes: [{ id: "class-B", name: "B", methods: [], superclassId }],
        },
        {
          id: "file-b",
          path: "b",
          classes: [{ id: "class-A", name: "A", methods: [] }],
        },
      ],
    };
  }

  it("子クラスから親クラスへ、依存の矢印とは別のクラス名の辺を作る", () => {
    // Arrange
    const codebase = codebaseWithInheritance("class-A");

    // Act
    const [edge] = inheritanceEdges(codebase);

    // Assert
    expect(edge).toMatchObject({
      source: "class-B",
      target: "class-A",
      className: "edge--inheritance",
    });
  });

  it("継承がないクラスだけなら辺を作らない", () => {
    // Arrange
    const codebase = codebaseWithInheritance();

    // Act
    const edges = inheritanceEdges(codebase);

    // Assert
    expect(edges).toHaveLength(0);
  });

  it("親クラスが削除されて存在しないIDを指しているときは辺を作らない", () => {
    // Arrange
    const codebase = codebaseWithInheritance("class-deleted");

    // Act
    const edges = inheritanceEdges(codebase);

    // Assert
    expect(edges).toHaveLength(0);
  });

  it("有効な継承と、親が削除済みの継承が混在するときは、有効な方の辺だけ作る", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: "file-a",
          path: "a",
          classes: [
            { id: "class-B", name: "B", methods: [], superclassId: "class-A" },
            { id: "class-C", name: "C", methods: [], superclassId: "class-deleted" },
          ],
        },
        {
          id: "file-b",
          path: "b",
          classes: [{ id: "class-A", name: "A", methods: [] }],
        },
      ],
    };

    // Act
    const edges = inheritanceEdges(codebase);

    // Assert
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: "class-B", target: "class-A" });
  });
});
