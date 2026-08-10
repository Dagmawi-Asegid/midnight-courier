import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { computeStatsFromUpgrades, NIGHT_BASE_DURATION } from './game/engine/constants.js';
import { gameReducer, initialState, SCREENS } from './state/gameReducer.js';
import { saveProgress } from './state/persistence.js';
import MainMenu from './components/MainMenu.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import NightCompleteScreen from './components/NightCompleteScreen.jsx';
import UpgradeScreen from './components/UpgradeScreen.jsx';
import './App.css';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const stats = useMemo(() => computeStatsFromUpgrades(state.upgradeLevels), [state.upgradeLevels]);
  const nightDuration = NIGHT_BASE_DURATION + (stats.extraTime || 0);

  // Any change to career progress (earnings, upgrades, night count) is saved right away,
  // so a reload — or just closing the tab — never loses it.
  useEffect(() => {
    saveProgress({ totalMoney: state.totalMoney, upgradeLevels: state.upgradeLevels, night: state.night });
  }, [state.totalMoney, state.upgradeLevels, state.night]);

  const handleStart = useCallback(() => dispatch({ type: 'START_GAME' }), []);
  const handleNightEnd = useCallback((summary) => dispatch({ type: 'NIGHT_ENDED', payload: summary }), []);
  const handleContinueToUpgrade = useCallback(() => dispatch({ type: 'GO_TO_UPGRADE' }), []);
  const handleBuyUpgrade = useCallback((def) => dispatch({ type: 'BUY_UPGRADE', payload: { def } }), []);
  const handleStartNextNight = useCallback(() => dispatch({ type: 'START_NEXT_NIGHT' }), []);
  const handleQuit = useCallback(() => dispatch({ type: 'GO_TO_MENU' }), []);

  return (
    <div className="app-root">
      {state.screen === SCREENS.MENU && (
        <MainMenu onStart={handleStart} totalMoney={state.totalMoney} night={state.night} />
      )}

      {state.screen === SCREENS.PLAYING && (
        <GameCanvas
          key={state.night}
          stats={stats}
          nightDuration={nightDuration}
          night={state.night}
          onNightEnd={handleNightEnd}
        />
      )}

      {state.screen === SCREENS.NIGHT_COMPLETE && state.lastNightSummary && (
        <NightCompleteScreen
          summary={state.lastNightSummary}
          totalMoney={state.totalMoney}
          onContinue={handleContinueToUpgrade}
        />
      )}

      {state.screen === SCREENS.UPGRADE && (
        <UpgradeScreen
          totalMoney={state.totalMoney}
          upgradeLevels={state.upgradeLevels}
          onBuy={handleBuyUpgrade}
          onStartNextNight={handleStartNextNight}
          onQuit={handleQuit}
        />
      )}
    </div>
  );
}
