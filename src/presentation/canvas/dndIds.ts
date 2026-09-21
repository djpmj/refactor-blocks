import type { UniqueIdentifier } from '@dnd-kit/core';

const METHOD_PREFIX = 'method:';
const CLASS_PREFIX = 'class:';

export function methodDragId(methodId: string): string {
  return `${METHOD_PREFIX}${methodId}`;
}

export function classDropId(classId: string): string {
  return `${CLASS_PREFIX}${classId}`;
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
