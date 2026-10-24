import { describe, expect, it } from "vitest";
import type { Codebase } from "../../domain/codebase/Codebase";
import type { StageLayer } from "../../domain/stage/Stage";
import { layerLanes } from "./layerLanes";

const LAYERS: readonly StageLayer[] = [
  { name: "Controller", responsibilities: ["http"] },
  { name: "Service", responsibilities: ["rule"] },
  { name: "Repository", responsibilities: ["persistence"] },
];

/** ファイルごとに、クラスごとの責務の並びを指定してコードベースを作る。 */
function codebaseOf(files: Record<string, readonly (readonly string[])[]>): Codebase {
  return {
    files: Object.entries(files).map(([fileId, classes]) => ({
      id: fileId,
      path: `src/${fileId}.ts`,
      classes: classes.map((responsibilities, index) => ({
        id: `${fileId}-c${String(index)}`,
        name: `C${String(index)}`,
        methods: [{
          id: `${fileId}-m${String(index)}`,
          name: "run",
          visibility: "public" as const,
          fragments: responsibilities.map((responsibility, fragmentIndex) => ({
            id: `${fileId}-f${String(index)}-${String(fragmentIndex)}`,
            label: responsibility,
            lines: 1,
            responsibility,
          })),
        }],
      })),
    })),
  };
}

describe("layerLanes", () => {
  it("Controller・Service・Repository の3ファイルは、それぞれ段0・1・2になる", () => {
    // Arrange
    const codebase = codebaseOf({ c: [["http"]], s: [["rule"]], r: [["persistence"]] });

    // Act
    const lanes = layerLanes(codebase, LAYERS);

    // Assert
    expect([lanes.get("c"), lanes.get("s"), lanes.get("r")]).toEqual([0, 1, 2]);
  });

  it("Controller と Service のクラスがあるファイルは、上の層の段0になる", () => {
    // Arrange
    const codebase = codebaseOf({ mixed: [["rule"], ["http"]] });

    // Act
    const lanes = layerLanes(codebase, LAYERS);

    // Assert
    expect(lanes.get("mixed")).toBe(0);
  });

  it("空のクラスだけのファイルは、役割の隠しタグ(roleResponsibilities)で段が決まる", () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: "svc", path: "src/svc.ts", classes: [{ id: "svc-c", name: "Svc", roleResponsibilities: ["rule"], methods: [] }] },
        { id: "repo", path: "src/repo.ts", classes: [{ id: "repo-c", name: "Repo", roleResponsibilities: ["persistence"], methods: [] }] },
      ],
    };

    // Act
    const lanes = layerLanes(codebase, LAYERS);

    // Assert
    expect([lanes.get("svc"), lanes.get("repo")]).toEqual([1, 2]);
  });

  it("層が決まらないファイルは、最後の層の下の段3(未分類)になる", () => {
    // Arrange
    const codebase = codebaseOf({ empty: [[]], other: [["format"]] });

    // Act
    const lanes = layerLanes(codebase, LAYERS);

    // Assert
    expect([lanes.get("empty"), lanes.get("other")]).toEqual([3, 3]);
  });
});
