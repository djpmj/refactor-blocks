import { describe, expect, it } from "vitest";
import type { Codebase, Fragment } from "../../domain/codebase/Codebase";
import { dependencyEdges, inheritanceEdges, layoutCodebase } from "./layoutCodebase";

function callFragment(id: string, uses: readonly string[]): Fragment {
  return { id, label: id, lines: 1, responsibility: "call", uses };
}

/** 各クラスを(ファイル, クラス名, 呼ぶメソッド)で指定する。ファイルは登場順に元の並びに入る(層分けで並び替わる)。 */
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

function fileNodeY(nodes: ReturnType<typeof layoutCodebase>, fileId: string): number {
  const node = nodes.find((n) => n.id === fileId);
  if (node === undefined) throw new Error(`node not found: ${fileId}`);
  return node.position.y;
}

describe("layoutCodebase", () => {
  it("依存し合わないファイルは同じ層(横一列)に並べる", () => {
    // Arrange
    const codebase = codebaseOf([
      ["a", "A", []],
      ["b", "B", []],
    ]);

    // Act
    const nodes = layoutCodebase(codebase);

    // Assert
    expect(fileNodeY(nodes, "file-a")).toBe(fileNodeY(nodes, "file-b"));
  });

  it("呼ぶ側のファイルを上、呼ばれる側のファイルを下の層に置く", () => {
    // Arrange
    const codebase = codebaseOf([
      ["a", "A", ["method-B"]],
      ["b", "B", []],
    ]);

    // Act
    const nodes = layoutCodebase(codebase);

    // Assert
    expect(fileNodeY(nodes, "file-a")).toBeLessThan(fileNodeY(nodes, "file-b"));
  });

  it("3段の依存(A→B→C)は3つの層に積む", () => {
    // Arrange
    const codebase = codebaseOf([
      ["a", "A", ["method-B"]],
      ["b", "B", ["method-C"]],
      ["c", "C", []],
    ]);

    // Act
    const nodes = layoutCodebase(codebase);

    // Assert
    const [ay, by, cy] = [fileNodeY(nodes, "file-a"), fileNodeY(nodes, "file-b"), fileNodeY(nodes, "file-c")];
    expect(ay).toBeLessThan(by);
    expect(by).toBeLessThan(cy);
  });
});

describe("dependencyEdges", () => {
  it("層が違うときは、呼ぶ側の下端から呼ばれる側の上端へつなぐ", () => {
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
      sourceHandle: "source-bottom",
      target: "class-B",
      targetHandle: "target-top",
    });
  });

  it("同じ層で隣り合うファイルへは、右端から左端へつなぐ", () => {
    // Arrange: 循環させて A・B を同じ層に留める
    const codebase = codebaseOf([
      ["a", "A", ["method-B"]],
      ["b", "B", ["method-A"]],
    ]);

    // Act
    const edge = dependencyEdges(codebase).find((e) => e.source === "class-A");

    // Assert
    expect(edge).toMatchObject({
      sourceHandle: "source-right",
      targetHandle: "target-left",
    });
  });

  it("同じファイルのクラス同士は、縦に積まれた並びに沿って上のクラスの下端から下のクラスの上端へつなぐ", () => {
    // Arrange: A・B は同じファイルで、Aが先(上)・Bが後(下)に積まれる
    const codebase = codebaseOf([
      ["a", "A", ["method-B"]],
      ["a", "B", []],
    ]);

    // Act
    const [edge] = dependencyEdges(codebase);

    // Assert
    expect(edge).toMatchObject({
      sourceHandle: "source-bottom",
      targetHandle: "target-top",
    });
  });

  it("同じファイルの逆向き(下のクラスから上のクラスへ)は、下のクラスの上端から上のクラスの下端へつなぐ", () => {
    // Arrange: A・B は同じファイルで、Aが先(上)・Bが後(下)に積まれるが、依存は下→上(BがAを呼ぶ)
    const codebase = codebaseOf([
      ["a", "A", []],
      ["a", "B", ["method-A"]],
    ]);

    // Act
    const [edge] = dependencyEdges(codebase);

    // Assert
    expect(edge).toMatchObject({
      sourceHandle: "source-top",
      targetHandle: "target-bottom",
    });
  });

  it("同じファイル内の1クラスから複数クラスへの依存(初級2のような形)は、右端どうしの重なりを避けて全て上下でつなぐ", () => {
    // Arrange: A が同じファイルの B・C 両方に依存する(B・Cは呼ばれるだけで依存先を持たない)
    const codebase = codebaseOf([
      ["a", "A", ["method-B", "method-C"]],
      ["a", "B", []],
      ["a", "C", []],
    ]);

    // Act
    const edges = dependencyEdges(codebase);

    // Assert: 右端どうし(座標が一致し描画できない)にはならない
    expect(edges).toHaveLength(2);
    for (const edge of edges) {
      expect(edge).toMatchObject({ sourceHandle: "source-bottom", targetHandle: "target-top" });
    }
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

  it("循環していて同じ層に残るファイルの中で、1つ以上飛び越える辺はskipでつなぐ", () => {
    // Arrange: A→B→C→D→A の循環に加え、A→D のショートカットを作る(4つとも同じ層に残る)
    const codebase = codebaseOf([
      ["a", "A", ["method-B", "method-D"]],
      ["b", "B", ["method-C"]],
      ["c", "C", ["method-D"]],
      ["d", "D", ["method-A"]],
    ]);

    // Act
    const edge = dependencyEdges(codebase).find((e) => e.source === "class-A" && e.target === "class-D");

    // Assert
    expect(edge).toMatchObject({
      sourceHandle: "source-skip",
      targetHandle: "target-skip",
      type: "topRoute",
      data: { lane: 0 },
    });
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

  it("子クラスから親クラスへ、依存の矢印とは別のクラス名の辺を作る(層が違うので下端→上端)", () => {
    // Arrange
    const codebase = codebaseWithInheritance("class-A");

    // Act
    const [edge] = inheritanceEdges(codebase);

    // Assert
    expect(edge).toMatchObject({
      source: "class-B",
      target: "class-A",
      sourceHandle: "source-bottom",
      targetHandle: "target-top",
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

  it("実装先が3クラスから参照される典型形(Strategyパターン)は、実装クラス側が1つ下の層にまとまり、共通の実装先はさらに下の層になる", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: "file-service",
          path: "service",
          classes: [{ id: "class-Service", name: "Service", methods: [{ id: "method-Service", name: "run", visibility: "public", fragments: [callFragment("f-Service", ["method-Regular", "method-Premium"])] }] }],
        },
        { id: "file-strategy", path: "strategy", classes: [{ id: "class-Strategy", name: "Strategy", methods: [] }] },
        {
          id: "file-regular",
          path: "regular",
          classes: [{ id: "class-Regular", name: "Regular", methods: [{ id: "method-Regular", name: "run", visibility: "public", fragments: [] }], superclassId: "class-Strategy" }],
        },
        {
          id: "file-premium",
          path: "premium",
          classes: [{ id: "class-Premium", name: "Premium", methods: [{ id: "method-Premium", name: "run", visibility: "public", fragments: [] }], superclassId: "class-Strategy" }],
        },
      ],
    };

    // Act
    const nodes = layoutCodebase(codebase);
    const inherit = inheritanceEdges(codebase);

    // Assert: Service < Regular/Premium < Strategy の順に層が深くなる
    const [serviceY, strategyY, regularY, premiumY] = [
      fileNodeY(nodes, "file-service"),
      fileNodeY(nodes, "file-strategy"),
      fileNodeY(nodes, "file-regular"),
      fileNodeY(nodes, "file-premium"),
    ];
    expect(regularY).toBe(premiumY);
    expect(serviceY).toBeLessThan(regularY);
    expect(regularY).toBeLessThan(strategyY);
    // 実装先(Strategy)は層が違うので、2つの実装クラスからの矢印はどちらも上下(top)でつながり重ならない
    expect(inherit).toHaveLength(2);
    for (const edge of inherit) {
      expect(edge).toMatchObject({ sourceHandle: "source-bottom", targetHandle: "target-top" });
    }
  });

  it("1つのクラスが2つのインターフェースを実装しているときは、実装先ごとに1本ずつ辺を作る(IDはinherit-<子>-<親>)", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: "file-a",
          path: "a",
          classes: [{ id: "class-C", name: "C", methods: [], interfaceIds: ["class-X", "class-Y"] }],
        },
        { id: "file-x", path: "x", classes: [{ id: "class-X", name: "X", methods: [] }] },
        { id: "file-y", path: "y", classes: [{ id: "class-Y", name: "Y", methods: [] }] },
      ],
    };

    // Act
    const edges = inheritanceEdges(codebase);

    // Assert
    expect(edges.map((edge) => edge.id)).toEqual(["inherit-class-C-class-X", "inherit-class-C-class-Y"]);
  });

  it("依存と継承のファイル範囲が重なるときも、まとめて別のレーンに割り当てて重ならないようにする", () => {
    // Arrange: A→B→C→D→A の循環に、A→D(依存)のショートカットと B→D(継承)を追加し、
    // 4つとも同じ層に残しつつ、飛び越える依存と継承の範囲(A..D と B..D)を重ねる
    const codebase: Codebase = {
      files: [
        {
          id: "file-a",
          path: "a",
          classes: [{ id: "class-A", name: "A", methods: [{ id: "method-A", name: "run", visibility: "public", fragments: [callFragment("f-A", ["method-B", "method-D"])] }] }],
        },
        {
          id: "file-b",
          path: "b",
          classes: [{ id: "class-B", name: "B", methods: [{ id: "method-B", name: "run", visibility: "public", fragments: [callFragment("f-B", ["method-C"])] }], superclassId: "class-D" }],
        },
        {
          id: "file-c",
          path: "c",
          classes: [{ id: "class-C", name: "C", methods: [{ id: "method-C", name: "run", visibility: "public", fragments: [callFragment("f-C", ["method-D"])] }] }],
        },
        {
          id: "file-d",
          path: "d",
          classes: [{ id: "class-D", name: "D", methods: [{ id: "method-D", name: "run", visibility: "public", fragments: [callFragment("f-D", ["method-A"])] }] }],
        },
      ],
    };

    // Act
    const depEdge = dependencyEdges(codebase).find((edge) => edge.source === "class-A" && edge.target === "class-D");
    const [inheritEdge] = inheritanceEdges(codebase);

    // Assert
    expect(depEdge).toMatchObject({ type: "topRoute" });
    expect(inheritEdge).toMatchObject({ type: "topRoute" });
    expect(depEdge?.data).not.toEqual(inheritEdge.data);
  });
});
