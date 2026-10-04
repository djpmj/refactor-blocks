import { allClasses, type Codebase } from '../codebase/Codebase';
import { classDependencies } from '../codebase/dependencies';
import type { StageLayer } from '../stage/Stage';
import { CALL_RESPONSIBILITY } from './responsibilities';

export type LayerViolation = {
  readonly fromClassId: string;
  readonly toClassId: string;
  /** 'upward' = 下の層から上の層を呼んでいる。'skip' = 1つ以上の層を飛ばして下の層を呼んでいる。 */
  readonly kind: 'upward' | 'skip';
};

/**
 * クラスID → 層の添字(0 が一番上)。層に属する処理を1つも持たないクラス(空・call だけ・どの層にも属さない責務だけ)は含めない。
 * ponytail: クラスの層は「一番上の層の処理を1つでも持っていればその層」で決める。混ざったクラスが別の層として扱われて紛らわしいと分かったら、多数決にする
 */
export function classLayers(codebase: Codebase, layers: readonly StageLayer[]): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  for (const codeClass of allClasses(codebase)) {
    const indexes = codeClass.methods
      .flatMap((method) => method.fragments)
      .filter((fragment) => fragment.responsibility !== CALL_RESPONSIBILITY)
      .map((fragment) => layers.findIndex((layer) => layer.responsibilities.includes(fragment.responsibility)))
      .filter((index) => index !== -1);
    if (indexes.length > 0) result.set(codeClass.id, Math.min(...indexes));
  }
  return result;
}

/** classDependencies の各依存について、両端のクラスに層があるときだけ向きを調べる。 */
export function findLayerViolations(codebase: Codebase, layers: readonly StageLayer[] | undefined): LayerViolation[] {
  if (layers === undefined) return [];
  const layerOf = classLayers(codebase, layers);
  return classDependencies(codebase).flatMap(({ from, to }): LayerViolation[] => {
    const fromLayer = layerOf.get(from);
    const toLayer = layerOf.get(to);
    if (fromLayer === undefined || toLayer === undefined) return [];
    if (toLayer < fromLayer) return [{ fromClassId: from, toClassId: to, kind: 'upward' }];
    if (toLayer > fromLayer + 1) return [{ fromClassId: from, toClassId: to, kind: 'skip' }];
    return [];
  });
}
