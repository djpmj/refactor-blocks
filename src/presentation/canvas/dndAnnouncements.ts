import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';
import { findClass, findClassOfField, findClassOfMethod, findField, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { parseClassDragId, parseClassDropId, parseFieldDragId, parseFileDropId, parseMethodDragId } from './dndIds';

export const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable: 'スペースキーで持ち上げ、矢印キーで動かします。もう一度スペースキーで置き、Esc で取り消します。',
};

const UNKNOWN_DRAGGABLE = '項目';
const UNKNOWN_DROPPABLE = '移動先';

function describeMethod(codebase: Codebase, methodId: string): string {
  const method = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  return method === undefined || owner === undefined ? UNKNOWN_DRAGGABLE : `${owner.name}.${method.name}()`;
}

function describeField(codebase: Codebase, fieldId: string): string {
  const field = findField(codebase, fieldId);
  const owner = findClassOfField(codebase, fieldId);
  return field === undefined || owner === undefined ? UNKNOWN_DRAGGABLE : `${owner.name}.${field.name}`;
}

function describeClass(codebase: Codebase, classId: string, fallback: string): string {
  const codeClass = findClass(codebase, classId);
  return codeClass === undefined ? fallback : `クラス ${codeClass.name}`;
}

/** ドラッグしている要素の読み上げ名。IDは読み上げず、引けなければ「項目」。 */
export function describeDraggable(codebase: Codebase, id: UniqueIdentifier): string {
  const methodId = parseMethodDragId(id);
  if (methodId !== null) return describeMethod(codebase, methodId);
  const fieldId = parseFieldDragId(id);
  if (fieldId !== null) return describeField(codebase, fieldId);
  const classId = parseClassDragId(id);
  return classId === null ? UNKNOWN_DRAGGABLE : describeClass(codebase, classId, UNKNOWN_DRAGGABLE);
}

/** ドロップ先の読み上げ名。ファイル名は画面に出していないので、中のクラス名で呼ぶ。引けなければ「移動先」。 */
export function describeDroppable(codebase: Codebase, id: UniqueIdentifier): string {
  const classId = parseClassDropId(id);
  if (classId !== null) return describeClass(codebase, classId, UNKNOWN_DROPPABLE);
  const fileId = parseFileDropId(id);
  const file = fileId === null ? undefined : codebase.files.find((candidate) => candidate.id === fileId);
  return file === undefined ? UNKNOWN_DROPPABLE : `${file.classes.map((codeClass) => codeClass.name).join('・')} のファイル`;
}

export function createAnnouncements(codebase: Codebase): Announcements {
  return {
    onDragStart: ({ active }) => `${describeDraggable(codebase, active.id)} を持ち上げました。`,
    onDragOver: ({ active, over }) => {
      const name = describeDraggable(codebase, active.id);
      return over === null ? `${name} はどこの上にもありません。` : `${name} を ${describeDroppable(codebase, over.id)} の上に動かしています。`;
    },
    onDragEnd: ({ active, over }) => {
      const name = describeDraggable(codebase, active.id);
      if (over !== null) return `${name} を ${describeDroppable(codebase, over.id)} に置きました。`;
      // フィールドを余白へ落としても何も作らない(CodebaseCanvas の useDropHandler と同じ)
      if (parseFieldDragId(active.id) !== null) return `${name} は元の場所に戻りました。`;
      return `${name} を余白に置きました。新しいクラスを作ります。`;
    },
    onDragCancel: ({ active }) => `${describeDraggable(codebase, active.id)} の移動を取り消しました。`,
  };
}
