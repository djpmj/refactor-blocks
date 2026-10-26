const STORAGE_KEY = 'refactor-blocks:tour-seen';

export function loadTourSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveTourSeen(): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
    return true;
  } catch {
    // The tour remains usable when browser storage is unavailable.
    return false;
  }
}
