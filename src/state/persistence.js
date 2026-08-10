const STORAGE_KEY = 'midnight-courier:progress:v1';

/** Reads saved career progress (money, upgrades, night count). Returns null if there's
 * nothing saved, storage is unavailable (private browsing, quota, disabled), or the
 * saved data is corrupt — callers should fall back to fresh defaults in that case. */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Persists career progress. Silently no-ops if storage isn't available. */
export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable — progression just won't survive a reload this session.
  }
}
