import { withoutTray } from '../blank/tray';
import { allClasses, isInterfaceLike, type Codebase } from '../codebase/Codebase';
import { moveMethod } from '../codebase/moveMethod';
import { moveMethodToNewClass } from '../codebase/moveToNewHome';
import { addInterface } from '../codebase/setSuperclass';
import { changePart, withChangePart } from './changePart';
import { changeKindOf, type ChangeRequest } from './ChangeRequest';
import { measurePlacement, type Placement } from './measurePlacement';
import { scorePlacement } from './scorePlacement';

/** 解答例の置き先。新しいクラスは、実装するインターフェース役のクラス名つき。 */
export type SampleTarget =
  | { readonly kind: 'existing-class'; readonly className: string }
  | { readonly kind: 'new-class'; readonly implementing: string };

/** codebase = 解答例どおりに置いたあとのコード(部品置き場なし)。図に使う。placement = 解答例の置き方の測定結果。 */
export type SampleImplementation = { readonly target: SampleTarget; readonly score: number; readonly codebase: Codebase; readonly placement: Placement };

/** 解答例が作る新しいクラス・ファイルのID。依頼ごとに一意にして、前の依頼の解答例の上に重ねても重複しないようにする。 */
function newIds(request: ChangeRequest): { classId: string; fileId: string } {
  return { classId: `class-sample-${request.id}`, fileId: `file-sample-${request.id}` };
}

type Candidate = { readonly target: SampleTarget; readonly implemented: Codebase | undefined };

function existingClassCandidates(withPart: Codebase, request: ChangeRequest): Candidate[] {
  const partId = changePart(request).id;
  return allClasses(withPart).map((codeClass) => {
    const moved = moveMethod(withPart, partId, codeClass.id);
    return { target: { kind: 'existing-class', className: codeClass.name }, implemented: moved.ok ? moved.value : undefined };
  });
}

function newClassCandidates(base: Codebase, withPart: Codebase, request: ChangeRequest): Candidate[] {
  const ids = newIds(request);
  const moved = moveMethodToNewClass(withPart, changePart(request).id, ids);
  if (!moved.ok) return [];
  return allClasses(base)
    .filter(isInterfaceLike)
    .map((codeClass) => {
      const linked = addInterface(moved.value, ids.classId, codeClass.name);
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
    if (best === undefined || total > best.score) best = { target, score: total, codebase: withoutTray(implemented), placement: placement.value };
  }
  return best;
}

/**
 * 前の依頼までを、それぞれの解答例の置き方で積み重ねたコード。プレイヤーが前の依頼で置き間違えても、解答例はこの上で求める。
 * 解答例がない依頼は、そのまま飛ばす。
 */
export function sampleCarried(base: Codebase, requests: readonly ChangeRequest[]): Codebase {
  return requests.reduce((carried, request) => sampleImplementation(carried, request)?.codebase ?? carried, base);
}

/**
 * プレイヤーの置き方が、解答例と同じか。クラス名は見ない(新しいクラスの名前は自動で付くため)。
 * 既存クラスは同じクラス、新しいクラスは同じ先祖(インターフェース役)につないだ新クラスなら同じ。
 */
// ponytail: 前の依頼の解答例が作った新クラスに置く解答例は、IDがプレイヤーの新クラスと違うので名前で突き合わせる。名前の偶然の一致が問題になったら、置き先のクラスを依頼ごとに対応づける
export function placedLikeSample(sample: SampleImplementation, placement: Placement): boolean {
  const expected = sample.placement;
  if (expected.attachment === 'existing-class') {
    return placement.attachment === 'existing-class' && (placement.partClassId === expected.partClassId || placement.partClassName === expected.partClassName);
  }
  return placement.attachment === expected.attachment && placement.attachedClassId === expected.attachedClassId;
}
