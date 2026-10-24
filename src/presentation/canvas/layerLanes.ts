import type { CodeClass, Codebase } from "../../domain/codebase/Codebase";
import { classLayers } from "../../domain/scoring/layers";
import type { StageLayer } from "../../domain/stage/Stage";

/** 空のクラスはメソッドから層が決まらないので、ステージ作者が付けた役割(`roleResponsibilities`)で決める。 */
function roleLayer(codeClass: CodeClass, layers: readonly StageLayer[]): number | undefined {
  const indexes = (codeClass.roleResponsibilities ?? [])
    .map((responsibility) => layers.findIndex((layer) => layer.responsibilities.includes(responsibility)))
    .filter((index) => index !== -1);
  return indexes.length === 0 ? undefined : Math.min(...indexes);
}

/**
 * ファイルID → 段の番号(0 が一番上の層)。ファイルの中のクラスのうち一番上の層の段に置く。
 * クラスの層は `classLayers`(処理の責務)で決め、空のクラスは役割の隠しタグで決める。層が決まらないファイルは、最後の層の下の「未分類」の段(`layers.length`)に置く。
 */
export function layerLanes(codebase: Codebase, layers: readonly StageLayer[]): ReadonlyMap<string, number> {
  const layerOf = classLayers(codebase, layers);
  return new Map(codebase.files.map((file) => {
    const indexes = file.classes.flatMap((codeClass) => layerOf.get(codeClass.id) ?? roleLayer(codeClass, layers) ?? []);
    return [file.id, indexes.length === 0 ? layers.length : Math.min(...indexes)] as const;
  }));
}
