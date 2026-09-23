import { withoutTray } from '../blank/tray';
import { allClasses, type Codebase } from '../codebase/Codebase';
import { moveMethod } from '../codebase/moveMethod';
import { moveMethodToNewClass } from '../codebase/moveToNewHome';
import { setSuperclass } from '../codebase/setSuperclass';
import { changePart, withChangePart } from './changePart';
import { changeKindOf, type ChangeRequest } from './ChangeRequest';
import { isInterfaceLike, measurePlacement } from './measurePlacement';
import { scorePlacement } from './scorePlacement';

/** 解答例の置き先。新しいクラスは、実装するインターフェース役のクラス名つき。 */
export type SampleTarget =
  | { readonly kind: 'existing-class'; readonly className: string }
  | { readonly kind: 'new-class'; readonly implementing: string };

/** codebase = 解答例どおりに置いたあとのコード(部品置き場なし)。図に使う。 */
export type SampleImplementation = { readonly target: SampleTarget; readonly score: number; readonly codebase: Codebase };

const NEW_IDS = { classId: 'class-sample', fileId: 'file-sample' };

type Candidate = { readonly target: SampleTarget; readonly implemented: Codebase | undefined };

function existingClassCandidates(withPart: Codebase, request: ChangeRequest): Candidate[] {
  const partId = changePart(request).id;
  return allClasses(withPart).map((codeClass) => {
    const moved = moveMethod(withPart, partId, codeClass.id);
    return { target: { kind: 'existing-class', className: codeClass.name }, implemented: moved.ok ? moved.value : undefined };
  });
}

function newClassCandidates(base: Codebase, withPart: Codebase, request: ChangeRequest): Candidate[] {
  const moved = moveMethodToNewClass(withPart, changePart(request).id, NEW_IDS);
  if (!moved.ok) return [];
  return allClasses(base)
    .filter(isInterfaceLike)
    .map((codeClass) => {
      const linked = setSuperclass(moved.value, NEW_IDS.classId, codeClass.name, 'implements');
      return { target: { kind: 'new-class', implementing: codeClass.name }, implemented: linked.ok ? linked.value : undefined };
    });
}

/**
 * 依頼の解答例: 部品の置き先を総当たり(既存の各クラス・各インターフェースを実装する新クラス)で試し、置き方の点がいちばん高いものを返す。
 * 同点なら先に試したもの(既存クラス優先)。base は挑戦前のコード(部品置き場なし)。
 */
// ponytail: 置き先の候補はクラス数の分だけ全部採点する。数百クラスで重くなったら、依頼の責務を持つクラスと呼び出されているインターフェースに絞る
export function sampleImplementation(base: Codebase, request: ChangeRequest): SampleImplementation | undefined {
  const withPart = withChangePart(base, request);
  const candidates = [...existingClassCandidates(withPart, request), ...newClassCandidates(base, withPart, request)];
  let best: SampleImplementation | undefined;
  for (const { target, implemented } of candidates) {
    if (implemented === undefined) continue;
    const placement = measurePlacement(base, implemented, request);
    if (!placement.ok) continue;
    const { total } = scorePlacement(placement.value, changeKindOf(request));
    if (best === undefined || total > best.score) best = { target, score: total, codebase: withoutTray(implemented) };
  }
  return best;
}
