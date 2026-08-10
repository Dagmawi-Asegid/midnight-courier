import { DEFAULT_UPGRADE_LEVELS, upgradeCost } from '../game/engine/constants.js';
import { getDifficulty } from '../game/engine/difficulty.js';
import { computeNightBonus, computeNightRating } from '../game/utils/rating.js';
import { loadProgress } from './persistence.js';

export const SCREENS = {
  MENU: 'menu',
  NIGHT_INTRO: 'nightIntro',
  PLAYING: 'playing',
  NIGHT_COMPLETE: 'nightComplete',
  UPGRADE: 'upgrade',
};

/** Builds the starting state from saved progress when present, otherwise fresh defaults.
 * Missing upgrade ids (e.g. a def added after the save was written) default to level 0. */
function buildInitialState() {
  const saved = loadProgress();
  return {
    screen: SCREENS.MENU,
    night: saved?.night ?? 1,
    totalMoney: saved?.totalMoney ?? 0,
    upgradeLevels: { ...DEFAULT_UPGRADE_LEVELS, ...(saved?.upgradeLevels ?? {}) },
    lastNightSummary: null,
  };
}

export const initialState = buildInitialState();

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START_GAME':
      // Resumes with whatever progress is already in state (fresh or loaded from storage) —
      // it never resets money/upgrades, so a saved career picks up where it left off. Every
      // night starts with a briefing screen before play begins.
      return { ...state, screen: SCREENS.NIGHT_INTRO };

    case 'BEGIN_NIGHT':
      return { ...state, screen: SCREENS.PLAYING };

    case 'NIGHT_ENDED': {
      const { money, deliveriesCompleted, deliveriesFailed, bestCombo, distanceTraveled } = action.payload;
      const rating = computeNightRating({ deliveriesCompleted, deliveriesFailed, bestCombo });
      const bonus = computeNightBonus(money, rating);
      return {
        ...state,
        totalMoney: state.totalMoney + money + bonus,
        lastNightSummary: {
          night: state.night,
          money,
          deliveriesCompleted,
          deliveriesFailed,
          bestCombo,
          distanceTraveled,
          bonus,
          rating,
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
      return { ...state, screen: SCREENS.NIGHT_INTRO, night: state.night + 1 };

    case 'GO_TO_MENU':
      return { ...state, screen: SCREENS.MENU };

    default:
      return state;
  }
}
