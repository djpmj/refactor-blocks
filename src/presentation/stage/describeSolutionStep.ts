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

function describeSetSuperclass({ class: className, superclass, kind }: SetSuperclassStep): string {
  if (superclass === null) return `${className} の継承を右クリックメニューの「継承元を設定」で解除しよう`;
  return `${className} の継承元を ${superclass} に設定しよう(${kind === 'implements' ? '実装' : '継承'})`;
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
    return `${step.move.method} をMove Methodで ${step.move.toClass} へ移そう`;
  }
  if ('merge' in step) {
    const { methodA, methodAClass, methodB, methodBClass, name } = step.merge;
    const sideA = methodAClass === undefined ? methodA : `${methodAClass} の ${methodA}`;
    const sideB = methodBClass === undefined ? methodB : `${methodBClass} の ${methodB}`;
    return `${sideA} と ${sideB} は同じ処理なので、Merge Methodsで ${name} という名前に統合しよう`;
  }
  if ('addFile' in step) return `ファイル ${step.addFile} を追加しよう`;
  if ('deleteFile' in step) return `空になったファイル ${step.deleteFile} を右クリックで削除しよう`;
  if ('addClass' in step) return `${step.addClass.file} に ${step.addClass.name} クラスを追加しよう`;
  if ('moveClass' in step) return `${step.moveClass.name} クラスを ${step.moveClass.toFile} へ移そう`;
  return describeSetSuperclass(step.setSuperclass);
}
