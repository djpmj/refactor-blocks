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
    fields: [{ id: `field-${name}`, name: "value", visibility: "private" }],
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
  it("極小メソッドと極小クラスをそのファイルに計上する", () => {
    // Arrange
    const codebase: Codebase = {
      files: [{ id: "file-tiny", path: "src/tiny.ts", classes: [{
        id: "class-tiny", name: "Tiny", methods: [{
          id: "method-tiny", name: "run", visibility: "public",
          fragments: [{ id: "fragment-tiny", label: "work", lines: 1, responsibility: "work" }],
        }],
      }] }],
    };

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-tiny")).toBe(20);
  });

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
              methods: [{ id: "method-other", name: "other", visibility: "public", fragments: [{ id: "f-other", label: "do", lines: 3, responsibility: "x" }] }],
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

  it("Feature Envyは、そのメソッドのあるファイルの減点になる", () => {
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
              methods: [
                {
                  id: "method-a",
                  name: "run",
                  visibility: "public",
                  fragments: [{ id: "f-a", label: "do", lines: 3, responsibility: "x", reads: ["field-b1", "field-b2"] }],
                },
              ],
            },
          ],
        },
        {
          id: "file-b",
          path: "b",
          classes: [
            {
              id: "class-b",
              name: "B",
              methods: [],
              fields: [
                { id: "field-b1", name: "b1", visibility: "public" },
                { id: "field-b2", name: "b2", visibility: "public" },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-a")).toBe(10);
    expect(deductions.get("file-b")).toBe(0);
  });

  it("カプセル化の破れは、触っている側のクラスのあるファイルの減点になる", () => {
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
              methods: [
                {
                  id: "method-a",
                  name: "run",
                  visibility: "public",
                  fragments: [{ id: "f-a", label: "do", lines: 3, responsibility: "x", writes: ["field-b1"] }],
                },
              ],
            },
          ],
        },
        {
          id: "file-b",
          path: "b",
          classes: [{ id: "class-b", name: "B", methods: [], fields: [{ id: "field-b1", name: "b1", visibility: "public" }] }],
        },
      ],
    };

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-a")).toBe(10);
    expect(deductions.get("file-b")).toBe(0);
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

  it("protectedの越境は、呼んでいる側のクラスのあるファイルの減点になる(visibilityEnforcedがなくても数える)", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: "file-a", path: "a", classes: [classOf("A", ["method-B"])] },
        {
          id: "file-b",
          path: "b",
          classes: [{ id: "class-B", name: "B", methods: [{ id: "method-B", name: "run", visibility: "protected", fragments: [] }] }],
        },
      ],
    };

    // Act
    const deductions = fileDeductions(codebase, LOOSE);

    // Assert
    expect(deductions.get("file-a")).toBe(10);
    expect(deductions.get("file-b")).toBe(0);
  });

  it("privateの越境は、visibilityEnforcedのときだけ数える", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: "file-a", path: "a", classes: [classOf("A", ["method-B"])] },
        {
          id: "file-b",
          path: "b",
          classes: [{ id: "class-B", name: "B", methods: [{ id: "method-B", name: "run", visibility: "private", fragments: [] }] }],
        },
      ],
    };

    // Act
    const withoutEnforced = fileDeductions(codebase, LOOSE);
    const withEnforced = fileDeductions(codebase, { ...LOOSE, visibilityEnforced: true });

    // Assert
    expect(withoutEnforced.get("file-a")).toBe(0);
    expect(withEnforced.get("file-a")).toBe(10);
  });

  it("公開されたsetterは、setterのあるファイルの減点になる", () => {
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
              fields: [{ id: "field-a1", name: "a1", visibility: "private" }],
              methods: [
                {
                  id: "method-set",
                  name: "setA1",
                  visibility: "public",
                  fragments: [{ id: "f-set", label: "set", lines: 1, responsibility: "accessor", accessor: true, writes: ["field-a1"] }],
                },
              ],
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

  it("凝集度の低いクラスは、そのクラスのあるファイルの減点になる", () => {
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
              fields: [
                { id: "field-pay", name: "pay", visibility: "private" },
                { id: "field-city", name: "city", visibility: "private" },
              ],
              methods: [
                { id: "method-pay", name: "calcPay", visibility: "public", fragments: [{ id: "f-pay", label: "pay", lines: 3, responsibility: "a", reads: ["field-pay"] }] },
                { id: "method-city", name: "formatCity", visibility: "public", fragments: [{ id: "f-city", label: "city", lines: 3, responsibility: "a", reads: ["field-city"] }] },
              ],
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
