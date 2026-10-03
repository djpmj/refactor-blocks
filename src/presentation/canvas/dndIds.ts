import type { UniqueIdentifier } from '@dnd-kit/core';

const METHOD_PREFIX = 'method:';
const CLASS_PREFIX = 'class:';
const CLASS_DRAG_PREFIX = 'class-drag:';
const FILE_PREFIX = 'file:';
const FIELD_PREFIX = 'field:';

export function methodDragId(methodId: string): string {
  return `${METHOD_PREFIX}${methodId}`;
}

export function fieldDragId(fieldId: string): string {
  return `${FIELD_PREFIX}${fieldId}`;
}

export function classDropId(classId: string): string {
  return `${CLASS_PREFIX}${classId}`;
}

export function classDragId(classId: string): string {
  return `${CLASS_DRAG_PREFIX}${classId}`;
}

export function fileDropId(fileId: string): string {
  return `${FILE_PREFIX}${fileId}`;
}

function stripPrefix(id: UniqueIdentifier, prefix: string): string | null {
  const text = String(id);
  return text.startsWith(prefix) ? text.slice(prefix.length) : null;
}

export function parseMethodDragId(id: UniqueIdentifier): string | null {
  return stripPrefix(id, METHOD_PREFIX);
}

export function parseClassDropId(id: UniqueIdentifier): string | null {
  return stripPrefix(id, CLASS_PREFIX);
}

export function parseClassDragId(id: UniqueIdentifier): string | null {
  return stripPrefix(id, CLASS_DRAG_PREFIX);
}

export function parseFileDropId(id: UniqueIdentifier): string | null {
  return stripPrefix(id, FILE_PREFIX);
}

export function parseFieldDragId(id: UniqueIdentifier): string | null {
  return stripPrefix(id, FIELD_PREFIX);
}
