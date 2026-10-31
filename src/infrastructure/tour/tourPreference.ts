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

const modeIntroKey = (kind: 'quiz' | 'blank') => `refactor-blocks:mode-intro-seen:${kind}`;

export function loadModeIntroSeen(kind: 'quiz' | 'blank'): boolean {
  try {
    return localStorage.getItem(modeIntroKey(kind)) === 'true';
  } catch {
    return false;
  }
}

export function saveModeIntroSeen(kind: 'quiz' | 'blank'): boolean {
  try {
    localStorage.setItem(modeIntroKey(kind), 'true');
    return true;
  } catch {
    // The guide remains usable when browser storage is unavailable.
    return false;
  }
}
