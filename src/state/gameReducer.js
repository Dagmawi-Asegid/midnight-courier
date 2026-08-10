import { DEFAULT_UPGRADE_LEVELS, upgradeCost } from '../game/engine/constants.js';
import { loadProgress } from './persistence.js';

export const SCREENS = {
  MENU: 'menu',
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
      // it never resets money/upgrades, so a saved career picks up where it left off.
      return { ...state, screen: SCREENS.PLAYING };

    case 'NIGHT_ENDED': {
      const { money, deliveriesCompleted } = action.payload;
      return {
        ...state,
        totalMoney: state.totalMoney + money,
        lastNightSummary: { money, deliveriesCompleted, night: state.night },
        screen: SCREENS.NIGHT_COMPLETE,
      };
    }

    case 'GO_TO_UPGRADE':
      return { ...state, screen: SCREENS.UPGRADE };

    case 'BUY_UPGRADE': {
      // Cost is recomputed here from the current level rather than trusted from the
      // dispatched payload — the UI's own cost figure can go stale (e.g. rapid clicks
      // firing before a re-render lands), and the reducer must stay the source of truth
      // so a purchase is never charged at a lower, out-of-date price.
      const { def } = action.payload;
      const currentLevel = state.upgradeLevels[def.id] || 0;
      if (currentLevel >= def.maxLevel) return state;
      const cost = upgradeCost(def, currentLevel);
      if (state.totalMoney < cost) return state;
      return {
        ...state,
        totalMoney: state.totalMoney - cost,
        upgradeLevels: { ...state.upgradeLevels, [def.id]: currentLevel + 1 },
      };
    }

    case 'START_NEXT_NIGHT':
      return { ...state, screen: SCREENS.PLAYING, night: state.night + 1 };

    case 'GO_TO_MENU':
      return { ...state, screen: SCREENS.MENU };

    default:
      return state;
  }
}
