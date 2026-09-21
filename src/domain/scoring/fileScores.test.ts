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
  it("行数の違反は、その持ち主のファイルの減点になる", () => {
    // Arrange
    const codebase = sampleCodebase();
    const stage = { ...LOOSE, limits: { method: 20, class: 100, file: 100 } };

    // Act
    const deductions = fileDeductions(codebase, stage);

    // Assert
    expect(deductions.get("file-order")).toBe(10);
    expect(deductions.get("file-tax")).toBe(0);
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
