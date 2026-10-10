const STORAGE_KEY = 'refactor-blocks:tour-seen';

export function loadTourSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // The tour remains usable when browser storage is unavailable.
  }
}
