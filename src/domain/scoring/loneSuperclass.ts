import { allClasses, type Codebase } from '../codebase/Codebase';

/**
 * extends している子クラスがちょうど1つのクラス(使われない拡張ポイント)のIDを返す。
 * 実装が1つのインターフェース(implements)は、テストの差し替えや依存関係逆転のために正当に使われるので数えない。
 */
export function findLoneSuperclasses(codebase: Codebase): string[] {
  const classes = allClasses(codebase);
  const childCount = new Map<string, number>();
  for (const { superclassId, superclassKind } of classes) {
    if (superclassId !== undefined && (superclassKind ?? 'extends') === 'extends') {
      childCount.set(superclassId, (childCount.get(superclassId) ?? 0) + 1);
    }
  }
  return classes.filter((codeClass) => childCount.get(codeClass.id) === 1).map((codeClass) => codeClass.id);
}
