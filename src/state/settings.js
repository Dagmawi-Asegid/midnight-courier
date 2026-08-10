const STORAGE_KEY = 'midnight-courier:settings:v1';

export const DEFAULT_SETTINGS = {
  graphics: { quality: 'high', effects: true, shadows: true },
  audio: { master: 0.8, music: 0.6, sfx: 0.9 },
  gameplay: { cameraSensitivity: 1 },
  accessibility: { reducedShake: false, reducedFlashing: false, highContrast: false },
};

/** Reads saved preferences, shallow-merging each section over the defaults so an older/partial
 * saved shape (or a newly-added field) still comes back fully populated. Returns defaults
 * outright if nothing's saved or storage is unavailable/corrupt — this is a preferences store,
 * never the source of truth for career progress, so it lives under its own key entirely
 * separate from `progress` and can't accidentally clobber or be clobbered by it. */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    return {
      graphics: { ...DEFAULT_SETTINGS.graphics, ...(parsed.graphics ?? {}) },
      audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio ?? {}) },
      gameplay: { ...DEFAULT_SETTINGS.gameplay, ...(parsed.gameplay ?? {}) },
      accessibility: { ...DEFAULT_SETTINGS.accessibility, ...(parsed.accessibility ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists preferences. Silently no-ops if storage isn't available. */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable — preferences just won't survive a reload this session.
  }
}
