import { withoutTray } from '../blank/tray';
import { allClasses, fieldsOf, findClass, isInterfaceLike, parentIds, type CodeClass, type Codebase } from '../codebase/Codebase';
import { classDependencies } from '../codebase/dependencies';
import { err, ok, type Result } from '../shared/Result';
import type { ChangeRequest } from './ChangeRequest';
import { CALL_RESPONSIBILITY } from './measureChange';

export type PlacementError = 'unplaced-part';

/** 部品が新しいクラスに置かれたとき、既存のコードとどうつながっているか。 */
export type Attachment =
  | 'existing-class' // 既存クラスに置いた(つながりは既存クラスのまま。減点なし)
  | 'abstract' // 新クラスが、既存コードから呼ばれている抽象(インターフェース役)を継承・実装している
  | 'concrete' // 新クラスが呼ばれている先祖につながっているが、一番近い既存の先祖が中身のある具象クラス
  | 'none'; // 新クラスがどこからも呼ばれない(呼ばれている既存の先祖がない)

export type Placement = {
  /** 部品を置いたクラスのID。 */
  readonly partClassId: string;
  /** 表示用。新しいクラスは挑戦前のコードにないので、名前をここに残す。 */
  readonly partClassName: string;
  /** 挑戦前からあったクラスのうち、実装後に中身が変わった・消えたクラスのID(挑戦前のコードでの並び順)。 */
  readonly modifiedClassIds: readonly string[];
  /** 置いた先のクラスが持つ、依頼の責務でも 'call' でもない責務の種類数。 */
  readonly otherResponsibilities: number;
  /** 依頼の責務を持つクラスの数が、実装で何個増えたか(0未満にはしない)。 */
  readonly addedResponsibilityClasses: number;
  readonly attachment: Attachment;
  /** attachment が 'abstract' / 'concrete' のとき、一番近い既存の先祖のID。 */
  readonly attachedClassId?: string;
};

function partFragmentId(request: ChangeRequest): string {
  return `${request.id}:part`;
}

function findPartClass(design: Codebase, request: ChangeRequest): CodeClass | undefined {
  return allClasses(design).find((codeClass) =>
    codeClass.methods.some((method) => method.fragments.some((fragment) => fragment.id === partFragmentId(request))),
  );
}

/** クラスの中身。メソッド・フィールドの並び順は見ない(移して戻すと末尾に付くため)。実装先(implements)も並べ替えて比較する(付けて外して付け直しても同じ中身)。 */
function classContent(codeClass: CodeClass): string {
  const methods = codeClass.methods
    .map((method) => [method.id, method.name, method.visibility, method.fragments.map((fragment) => fragment.id)])
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  const interfaceIds = [...(codeClass.interfaceIds ?? [])].sort((a, b) => a.localeCompare(b));
  const fields = fieldsOf(codeClass)
    .map((field) => [field.id, field.name, field.visibility])
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  return JSON.stringify([codeClass.name, codeClass.superclassId ?? null, interfaceIds, methods, fields]);
}

function findModifiedClassIds(base: Codebase, design: Codebase): string[] {
  return allClasses(base)
    .filter((codeClass) => {
      const after = findClass(design, codeClass.id);
      return after === undefined || classContent(after) !== classContent(codeClass);
    })
    .map((codeClass) => codeClass.id);
}

function countOtherResponsibilities(codeClass: CodeClass, request: ChangeRequest): number {
  const others = codeClass.methods
    .flatMap((method) => method.fragments)
    .map((fragment) => fragment.responsibility)
    .filter((responsibility) => responsibility !== request.responsibility && responsibility !== CALL_RESPONSIBILITY);
  return new Set(others).size;
}

function countResponsibilityClasses(codebase: Codebase, request: ChangeRequest): number {
  return allClasses(codebase).filter((codeClass) =>
    codeClass.methods.some((method) => method.fragments.some((fragment) => fragment.responsibility === request.responsibility)),
  ).length;
}

/**
 * 近い順の先祖のうち、挑戦前のコードにあるクラス。継承元 → 実装先の宣言順で幅優先に辿る
 * (一番近い既存の先祖はその順の先頭)。輪になっていても訪問済みで止まる。
 */
function existingAncestors(base: Codebase, design: Codebase, start: CodeClass): CodeClass[] {
  const visited = new Set([start.id]);
  const ancestors: CodeClass[] = [];
  let queue = parentIds(start);
  while (queue.length > 0) {
    const next: string[] = [];
    for (const id of queue) {
      if (visited.has(id)) continue;
      visited.add(id);
      const ancestor = findClass(design, id);
      if (ancestor === undefined) continue;
      if (findClass(base, id) !== undefined) ancestors.push(ancestor);
      next.push(...parentIds(ancestor));
    }
    queue = next;
  }
  return ancestors;
}

function measureAttachment(base: Codebase, design: Codebase, partClass: CodeClass): Pick<Placement, 'attachment' | 'attachedClassId'> {
  if (findClass(base, partClass.id) !== undefined) return { attachment: 'existing-class' };
  const calledIds = new Set(classDependencies(base).map((dependency) => dependency.to));
  const ancestors = existingAncestors(base, design, partClass);
  const nearest = ancestors.at(0);
  if (nearest === undefined || !ancestors.some((ancestor) => calledIds.has(ancestor.id))) return { attachment: 'none' };
  return { attachment: isInterfaceLike(nearest) ? 'abstract' : 'concrete', attachedClassId: nearest.id };
}

/**
 * base = 挑戦前のコード(部品置き場なし)。implemented = プレイヤーが部品を置いたあとのコード(部品置き場を含んでよい)。
 * 部品が部品置き場に残っている・消えているなら err('unplaced-part')。
 */
export function measurePlacement(base: Codebase, implemented: Codebase, request: ChangeRequest): Result<Placement, PlacementError> {
  const design = withoutTray(implemented);
  const partClass = findPartClass(design, request);
  if (partClass === undefined) return err('unplaced-part');
  // ponytail: 既存クラスは呼ばれている前提にする。呼ばれていない既存クラスに置く抜け道が問題になったら、入口クラスの印をステージ定義に足す
  return ok({
    partClassId: partClass.id,
    partClassName: partClass.name,
    modifiedClassIds: findModifiedClassIds(base, design),
    otherResponsibilities: countOtherResponsibilities(partClass, request),
    addedResponsibilityClasses: Math.max(0, countResponsibilityClasses(design, request) - countResponsibilityClasses(base, request)),
    ...measureAttachment(base, design, partClass),
  });
}
