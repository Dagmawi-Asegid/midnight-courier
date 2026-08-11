import { DEFAULT_UPGRADE_LEVELS, upgradeCost } from '../game/engine/constants.js';
import { getDifficulty } from '../game/engine/difficulty.js';
import { computeNightBonus, computeNightRating } from '../game/utils/rating.js';
import { checkNewAchievements, DEFAULT_STATS } from './achievements.js';
import { loadProgress } from './persistence.js';

export const SCREENS = {
  MENU: 'menu',
  NIGHT_INTRO: 'nightIntro',
  PLAYING: 'playing',
  NIGHT_COMPLETE: 'nightComplete',
  UPGRADE: 'upgrade',
};

/** Builds the starting state from saved progress when present, otherwise fresh defaults.
 * Missing fields (an older save written before stats/achievements existed, or an upgrade id
 * added after the save was written) fall back to sane defaults field-by-field, so a
 * partial/outdated save never crashes the game — it just resumes with whatever it does have. */
function buildInitialState() {
  const saved = loadProgress();
  return {
    screen: SCREENS.MENU,
    night: saved?.night ?? 1,
    totalMoney: saved?.totalMoney ?? 0,
    upgradeLevels: { ...DEFAULT_UPGRADE_LEVELS, ...(saved?.upgradeLevels ?? {}) },
    stats: { ...DEFAULT_STATS, ...(saved?.stats ?? {}) },
    achievements: { ...(saved?.achievements ?? {}) },
    levelStars: { ...(saved?.levelStars ?? {}) },
    lastNightSummary: null,
  };
}

export const initialState = buildInitialState();

/** Fresh-career defaults, used by "New Game" and "Reset Save" — everything career-related
 * resets; settings (a separate storage key entirely) are untouched by this. */
function freshProgressState(screen) {
  return {
    screen,
    night: 1,
    totalMoney: 0,
    upgradeLevels: { ...DEFAULT_UPGRADE_LEVELS },
    stats: { ...DEFAULT_STATS },
    achievements: {},
    levelStars: {},
    lastNightSummary: null,
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START_GAME':
      // Resumes with whatever progress is already in state (fresh or loaded from storage) —
      // it never resets money/upgrades, so a saved career picks up where it left off. Every
      // night starts with a briefing screen before play begins.
      return { ...state, screen: SCREENS.NIGHT_INTRO };

    case 'NEW_GAME':
      // Wipes career progress and jumps straight into a Level 1 briefing. The caller
      // (MainMenu) is responsible for confirming with the player first when there's existing
      // progress to lose — this action itself just performs the reset unconditionally.
      return freshProgressState(SCREENS.NIGHT_INTRO);

    case 'RESET_PROGRESS':
      // Same reset, but returns to the menu instead of jumping into a night — used by the
      // Settings screen's "Reset Save" action, which isn't necessarily followed by playing.
      return freshProgressState(SCREENS.MENU);

    case 'BEGIN_NIGHT':
      return { ...state, screen: SCREENS.PLAYING };

    case 'NIGHT_ENDED': {
      const {
        money,
        deliveriesCompleted,
        deliveriesFailed,
        bestCombo,
        distanceTraveled,
        maxSpeedReached = 0,
        shortcutsCollected = 0,
        longestDeliveryMeters = 0,
        tookDamage = false,
      } = action.payload;
      const rating = computeNightRating({ deliveriesCompleted, deliveriesFailed, bestCombo });
      const bonus = computeNightBonus(money, rating);
      const earned = money + bonus;

      const stats = {
        ...state.stats,
        totalDeliveries: state.stats.totalDeliveries + deliveriesCompleted,
        totalEarnedLifetime: state.stats.totalEarnedLifetime + earned,
        shortcutsCollected: state.stats.shortcutsCollected + shortcutsCollected,
        maxSpeedReached: Math.max(state.stats.maxSpeedReached, maxSpeedReached),
        longestDeliveryMeters: Math.max(state.stats.longestDeliveryMeters, longestDeliveryMeters),
        perfectNights: state.stats.perfectNights + (deliveriesCompleted > 0 && deliveriesFailed === 0 ? 1 : 0),
        untouchableNights: state.stats.untouchableNights + (!tookDamage ? 1 : 0),
        bestComboEver: Math.max(state.stats.bestComboEver, bestCombo),
        highestLevel: Math.max(state.stats.highestLevel, state.night),
      };

      const newlyUnlocked = checkNewAchievements(stats, state.achievements);
      const achievements = { ...state.achievements };
      for (const id of newlyUnlocked) achievements[id] = true;

      // Best-ever star rating for this specific level number, shown on the Levels tab —
      // replaying an earlier level to improve your rating only ever raises it, never lowers it.
      const levelStars = {
        ...state.levelStars,
        [state.night]: Math.max(state.levelStars[state.night] ?? 0, rating),
      };

      return {
        ...state,
        totalMoney: state.totalMoney + earned,
        stats,
        achievements,
        levelStars,
        lastNightSummary: {
          night: state.night,
          money,
          deliveriesCompleted,
          deliveriesFailed,
          bestCombo,
          distanceTraveled,
          bonus,
          rating,
          newlyUnlocked,
          // A night with zero completed deliveries gets the dramatic "game over" framing on the
          // results screen instead of the normal one — same continue-to-upgrades flow either
          // way, this only changes how the outcome reads.
          gameOver: deliveriesCompleted === 0,
        },
        screen: SCREENS.NIGHT_COMPLETE,
      };
    }

    case 'GO_TO_UPGRADE':
      return { ...state, screen: SCREENS.UPGRADE };

    case 'BUY_UPGRADE': {
      // Cost is recomputed here from the current level (and the night's difficulty-scaled
      // price multiplier) rather than trusted from the dispatched payload — the UI's own cost
      // figure can go stale (e.g. rapid clicks firing before a re-render lands), and the
      // reducer must stay the source of truth so a purchase is never charged an out-of-date price.
      const { def } = action.payload;
      const currentLevel = state.upgradeLevels[def.id] || 0;
      if (currentLevel >= def.maxLevel) return state;
      const costMultiplier = getDifficulty(state.night).upgradeCostMultiplier;
      const cost = upgradeCost(def, currentLevel, costMultiplier);
      if (state.totalMoney < cost) return state;
      return {
        ...state,
        totalMoney: state.totalMoney - cost,
        upgradeLevels: { ...state.upgradeLevels, [def.id]: currentLevel + 1 },
      };
    }

    case 'START_NEXT_NIGHT':
      // Advances from the furthest level actually reached, not from `state.night` — those
      // differ after replaying an earlier level from the Levels tab, and this is what keeps a
      // replay from ever rewinding forward progress.
      return { ...state, screen: SCREENS.NIGHT_INTRO, night: state.stats.highestLevel + 1 };

    case 'PLAY_LEVEL':
      // Jumps straight to a specific level's briefing — used by the Levels tab both to resume
      // ("play the next unplayed level") and to replay any already-completed one. Doesn't touch
      // `stats.highestLevel`, so finishing this run and continuing still advances from wherever
      // the player's real progress actually was.
      return { ...state, screen: SCREENS.NIGHT_INTRO, night: action.payload.level };

    case 'GO_TO_MENU':
      return { ...state, screen: SCREENS.MENU };

    default:
      return state;
  }
}
