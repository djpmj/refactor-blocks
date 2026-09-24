import { describe, expect, it } from "vitest";
import type { CodeClass, Codebase, Fragment } from "../codebase/Codebase";
import { sampleCodebase } from "../codebase/testFixtures";
import { DANGER_POINTS, fileDeductions, fileSeverity } from "./fileScores";
import { scoreCodebase } from "./score";

const LOOSE = {
  limits: { method: 100, class: 100, file: 100 },
  responsibilityLimit: 100,
  dependencyLimit: 100,
};

function callFragment(id: string, uses: readonly string[]): Fragment {
  return { id, label: id, lines: 1, responsibility: "call", uses };
}

function classOf(name: string, uses: readonly string[]): CodeClass {
  return {
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
  };
}

describe("fileDeductions", () => {
  it("子が1つだけの基底クラスは、その基底クラスがあるファイルの減点になる", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: "file-base", path: "src/base.ts", classes: [classOf("Base", [])] },
        {
          id: "file-child",
          path: "src/child.ts",
          classes: [{ ...classOf("Child", []), superclassId: "class-Base" }],
        },
      ],
    };

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-base")).toBe(10);
    expect(deductions.get("file-child")).toBe(0);
  });

  it("行数の違反は、その持ち主のファイルの減点になる", () => {
    // Arrange
    const codebase = sampleCodebase();
    const stage = { ...LOOSE, limits: { method: 20, class: 100, file: 100 } };

    // Act
    const deductions = fileDeductions(codebase, stage);

    // Assert
    expect(deductions.get("file-order")).toBe(10);
    // TaxCalculator には行数の減点は入らず、空のクラスの10点だけが入る
    expect(deductions.get("file-tax")).toBe(10);
  });

  it("責務の混在は、そのクラスのあるファイルの減点になる", () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const deductions = fileDeductions(codebase, {
      ...LOOSE,
      responsibilityLimit: 2,
    });

    // Assert
    expect(deductions.get("file-order")).toBe(10);
  });

  it("循環依存と結合度は、依存元のクラスがあるファイルの減点になる", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: "file-a", path: "a", classes: [classOf("A", ["method-B"])] },
        { id: "file-b", path: "b", classes: [classOf("B", ["method-A"])] },
      ],
    };

    // Act
    const deductions = fileDeductions(codebase, {
      ...LOOSE,
      dependencyLimit: 0,
    });

    // Assert
    expect(deductions.get("file-a")).toBe(20);
    expect(deductions.get("file-b")).toBe(20);
  });

  it("空のクラスは、そのクラスのあるファイルの減点になる", () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-tax")).toBe(10);
    expect(deductions.get("file-order")).toBe(0);
  });

  it("空実装は、そのメソッドのあるファイルの減点になる", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: "file-a",
          path: "a",
          classes: [
            {
              id: "class-a",
              name: "A",
              methods: [{ id: "method-a", name: "run", visibility: "public", fragments: [{ id: "f-a", label: "未対応", lines: 2, responsibility: "x", stub: true }] }],
            },
          ],
        },
      ],
    };

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-a")).toBe(10);
  });

  it("実装漏れ(約束違反)は、実装クラスのあるファイルの減点になる", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: "file-i", path: "i", classes: [{ id: "class-i", name: "I", methods: [{ id: "method-i-run", name: "run", visibility: "public", fragments: [] }] }] },
        {
          id: "file-c",
          path: "c",
          classes: [
            {
              id: "class-c",
              name: "C",
              interfaceIds: ["class-i"],
              methods: [{ id: "method-other", name: "other", visibility: "public", fragments: [{ id: "f-other", label: "do", lines: 1, responsibility: "x" }] }],
            },
          ],
        },
      ],
    };

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-c")).toBe(10);
  });

  it("全ファイルの減点を足すと、採点の減点の合計と一致する", () => {
    // Arrange
    const codebase = sampleCodebase();
    const stage = {
      limits: { method: 20, class: 20, file: 20 },
      responsibilityLimit: 2,
      dependencyLimit: 0,
    };

    // Act
    const total = [...fileDeductions(codebase, stage).values()].reduce(
      (sum, points) => sum + points,
      0,
    );

    // Assert
    expect(total).toBe(100 - scoreCodebase(codebase, stage).total);
    expect(total).toBeGreaterThan(0);
  });
});

describe("fileSeverity", () => {
  it("減点なしは ok、しきい値未満は error、しきい値以上は danger", () => {
    // Arrange
    const points = [0, DANGER_POINTS - 10, DANGER_POINTS];

    // Act
    const severities = points.map(fileSeverity);

    // Assert
    expect(severities).toEqual(["ok", "error", "danger"]);
  });
});
