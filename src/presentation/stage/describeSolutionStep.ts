import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import type { SolutionStep } from '../../domain/stage/sampleAnswer';

/** ステージの初期コードベースから、処理(Fragment)のラベルを引く。見つからなければIDをそのまま返す。 */
function fragmentLabel(codebase: Codebase, fragmentId: string): string {
  const fragment = allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .flatMap((method) => method.fragments)
    .find((candidate) => candidate.id === fragmentId);
  return fragment?.label ?? fragmentId;
}

type SetSuperclassStep = Extract<SolutionStep, { readonly setSuperclass: unknown }>['setSuperclass'];
type AddInterfaceStep = Extract<SolutionStep, { readonly addInterface: unknown }>['addInterface'];
type RemoveInterfaceStep = Extract<SolutionStep, { readonly removeInterface: unknown }>['removeInterface'];

function describeSetSuperclass({ class: className, superclass }: SetSuperclassStep): string {
  if (superclass === null) return `${className} の継承を右クリックメニューの「継承元を設定」で解除しよう`;
  return `${className} の継承元を ${superclass} に設定しよう(右クリックメニューの「継承元を設定」)`;
}

function describeAddInterface({ class: className, interface: interfaceName }: AddInterfaceStep): string {
  return `${className} が実装するインターフェースに ${interfaceName} を追加しよう(右クリック →「実装するインターフェースを設定」)`;
}

function describeRemoveInterface({ class: className, interface: interfaceName }: RemoveInterfaceStep): string {
  return `${className} の implements から ${interfaceName} を外そう`;
}

type RenameClassStep = Extract<SolutionStep, { readonly renameClass: unknown }>['renameClass'];

function describeRenameClass({ name, newName }: RenameClassStep): string {
  return `${name} の名前を ${newName} に変えよう`;
}

type DeleteMethodStep = Extract<SolutionStep, { readonly deleteMethod: unknown }>['deleteMethod'];

function describeDeleteMethod({ method, fromClass }: DeleteMethodStep): string {
  return `${fromClass} の ${method} はもう実装しなくてよい空実装なので、メソッドエディタの「空実装のメソッドを削除」で消そう`;
}

type MoveFieldStep = Extract<SolutionStep, { readonly moveField: unknown }>['moveField'];

function describeMoveField({ field, fromClass, toClass }: MoveFieldStep): string {
  return `${fromClass} のフィールド ${field} を ${toClass} へドラッグして移そう(Move Field)`;
}

type ChangeVisibilityStep = Extract<SolutionStep, { readonly changeVisibility: unknown }>['changeVisibility'];

function describeChangeVisibility({ class: className, method, visibility }: ChangeVisibilityStep): string {
  return `${className} の ${method} を、メソッドエディタの「可視性」で ${visibility} にしよう`;
}

type StructuralStep = Exclude<
  SolutionStep,
  | { readonly extract: unknown }
  | { readonly move: unknown }
  | { readonly merge: unknown }
  | { readonly deleteMethod: unknown }
  | { readonly moveField: unknown }
  | { readonly changeVisibility: unknown }
>;

/** ファイル・クラス・継承関係の組み替え(処理の中身を伴わない手)のヒント文。 */
function describeStructuralStep(step: StructuralStep): string {
  if ('addFile' in step) return '新しいファイルを追加しよう';
  if ('deleteFile' in step) return '空になったファイルを右クリックで削除しよう';
  if ('addClass' in step) return `${step.addClass.name} クラスを追加しよう`;
  if ('moveClass' in step) return `${step.moveClass.name} クラスを別のファイルへ移そう`;
  if ('addInterface' in step) return describeAddInterface(step.addInterface);
  if ('removeInterface' in step) return describeRemoveInterface(step.removeInterface);
  if ('renameClass' in step) return describeRenameClass(step.renameClass);
  return describeSetSuperclass(step.setSuperclass);
}

/** 模範解答の1手を、プレイヤー向けの日本語のヒント文にする。 */
export function describeSolutionStep(codebase: Codebase, step: SolutionStep): string {
  if ('extract' in step) {
    const { from, fromClass, fragmentIds, name } = step.extract;
    const labels = fragmentIds.map((id) => fragmentLabel(codebase, id)).join('・');
    const source = fromClass === undefined ? from : `${fromClass} の ${from}`;
    return `${source} から「${labels}」をExtract Methodで取り出し、${name} という名前にしよう`;
  }
  if ('move' in step) {
    const { method, fromClass, toClass } = step.move;
    const source = fromClass === undefined ? method : `${fromClass} の ${method}`;
    return `${source} をMove Methodで ${toClass} へ移そう`;
  }
  if ('deleteMethod' in step) {
    return describeDeleteMethod(step.deleteMethod);
  }
  if ('moveField' in step) {
    return describeMoveField(step.moveField);
  }
  if ('changeVisibility' in step) {
    return describeChangeVisibility(step.changeVisibility);
  }
  if ('merge' in step) {
    const { methodA, methodAClass, methodB, methodBClass, name } = step.merge;
    const sideA = methodAClass === undefined ? methodA : `${methodAClass} の ${methodA}`;
    const sideB = methodBClass === undefined ? methodB : `${methodBClass} の ${methodB}`;
    return `${sideA} と ${sideB} は同じ処理なので、Merge Methodsで ${name} という名前に統合しよう`;
  }
  return describeStructuralStep(step);
}
