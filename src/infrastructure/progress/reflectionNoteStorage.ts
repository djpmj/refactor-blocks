import { isReflectionNotes, type ReflectionNotes } from '../../domain/progress/reflectionNotes';

const STORAGE_KEY = 'refactor-blocks:reflection-notes';

export function loadReflectionNotes(): ReflectionNotes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return isReflectionNotes(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveReflectionNotes(notes: ReflectionNotes): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}
