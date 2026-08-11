/**
 * Lightweight achievement system: each def is just a label/icon/description plus a pure
 * `check(stats)` predicate over the player's lifetime stats object. Checked once per level (at
 * NIGHT_ENDED, see gameReducer.js) rather than live during gameplay — simple to reason about,
 * and "you unlocked this at the end of the level you earned it in" reads fine narratively.
 */
export const ACHIEVEMENTS = [
  {
    id: 'firstDelivery',
    label: 'First Delivery',
    icon: '📦',
    description: 'Complete your first delivery.',
    check: (s) => s.totalDeliveries >= 1,
  },
  {
    id: 'tenDeliveries',
    label: '10 Deliveries',
    icon: '🚚',
    description: 'Complete 10 deliveries over your career.',
    check: (s) => s.totalDeliveries >= 10,
  },
  {
    id: 'perfectNight',
    label: 'Perfect Night',
    icon: '✨',
    description: 'Finish a level without failing a single delivery.',
    check: (s) => s.perfectNights >= 1,
  },
  {
    id: 'speedDemon',
    label: 'Speed Demon',
    icon: '💨',
    description: 'Hit 350 speed on the bike.',
    check: (s) => s.maxSpeedReached >= 350,
  },
  {
    id: 'longDistance',
    label: 'Long Distance',
    icon: '🗺️',
    description: 'Complete a delivery at least 300m away.',
    check: (s) => s.longestDeliveryMeters >= 300,
  },
  {
    id: 'comboMaster',
    label: 'Combo Master',
    icon: '🔥',
    description: 'Reach a combo streak of 6 in one level.',
    check: (s) => s.bestComboEver >= 6,
  },
  {
    id: 'nightOwl',
    label: 'Night Owl',
    icon: '🦉',
    description: 'Reach Level 10.',
    check: (s) => s.highestLevel >= 10,
  },
  {
    id: 'millionaire',
    label: 'Millionaire',
    icon: '💰',
    description: 'Earn $10,000 in total lifetime earnings.',
    check: (s) => s.totalEarnedLifetime >= 10000,
  },
  {
    id: 'shortcutKing',
    label: 'Shortcut King',
    icon: '🔀',
    description: 'Collect 5 shortcut pickups over your career.',
    check: (s) => s.shortcutsCollected >= 5,
  },
  {
    id: 'untouchable',
    label: 'Untouchable',
    icon: '🛡️',
    description: "Finish a level without a single collision.",
    check: (s) => s.untouchableNights >= 1,
  },
];

export const DEFAULT_STATS = {
  totalDeliveries: 0,
  totalEarnedLifetime: 0,
  shortcutsCollected: 0,
  maxSpeedReached: 0,
  longestDeliveryMeters: 0,
  perfectNights: 0,
  untouchableNights: 0,
  bestComboEver: 0,
  // Highest level number actually completed (a finished timer, win or not) — 0 for a brand-new
  // player who hasn't finished a level yet, so Level 1 correctly shows as the "next to play"
  // one instead of already-completed on the Levels tab.
  highestLevel: 0,
};

/** Returns the ids of any achievements newly satisfied by `stats` that aren't already unlocked. */
export function checkNewAchievements(stats, unlocked) {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && a.check(stats)).map((a) => a.id);
}
