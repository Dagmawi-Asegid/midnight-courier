import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { computeStatsFromUpgrades } from './game/engine/constants.js';
import { describeNightChallenge, getDifficulty } from './game/engine/difficulty.js';
import { gameReducer, initialState, SCREENS } from './state/gameReducer.js';
import { saveProgress } from './state/persistence.js';
import { loadSettings, saveSettings } from './state/settings.js';
import { setVolumes } from './game/utils/sound.js';
import MainMenu from './components/MainMenu.jsx';
import NightIntroScreen from './components/NightIntroScreen.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import NightCompleteScreen from './components/NightCompleteScreen.jsx';
import UpgradeScreen from './components/UpgradeScreen.jsx';
import SettingsScreen from './components/SettingsScreen.jsx';
import AchievementsScreen from './components/AchievementsScreen.jsx';
import LevelsScreen from './components/LevelsScreen.jsx';
import './App.css';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [restartToken, setRestartToken] = useState(0);

  const difficulty = useMemo(() => getDifficulty(state.night), [state.night]);
  const stats = useMemo(() => computeStatsFromUpgrades(state.upgradeLevels), [state.upgradeLevels]);
  const nightDuration = difficulty.nightDurationSeconds + (stats.extraTime || 0);
  const challenge = useMemo(() => describeNightChallenge(difficulty), [difficulty]);

  // Any change to career progress (earnings, upgrades, night count, lifetime stats,
  // achievements) is saved right away, so a reload — or just closing the tab — never loses it.
  // Settings live under their own storage key entirely separate from this, so neither can
  // accidentally clobber the other.
  useEffect(() => {
    saveProgress({
      totalMoney: state.totalMoney,
      upgradeLevels: state.upgradeLevels,
      night: state.night,
      stats: state.stats,
      achievements: state.achievements,
      levelStars: state.levelStars,
    });
  }, [state.totalMoney, state.upgradeLevels, state.night, state.stats, state.achievements, state.levelStars]);

  useEffect(() => {
    saveSettings(settings);
    setVolumes(settings.audio.master, settings.audio.sfx);
  }, [settings]);

  const handleSettingsChange = useCallback((section, key, value) => {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }, []);

  const handleStart = useCallback(() => dispatch({ type: 'START_GAME' }), []);
  const handleNewGame = useCallback(() => dispatch({ type: 'NEW_GAME' }), []);
  const handleResetSave = useCallback(() => dispatch({ type: 'RESET_PROGRESS' }), []);
  const handleBeginNight = useCallback(() => dispatch({ type: 'BEGIN_NIGHT' }), []);
  const handleNightEnd = useCallback((summary) => dispatch({ type: 'NIGHT_ENDED', payload: summary }), []);
  const handleContinueToUpgrade = useCallback(() => dispatch({ type: 'GO_TO_UPGRADE' }), []);
  const handleBuyUpgrade = useCallback((def) => dispatch({ type: 'BUY_UPGRADE', payload: { def } }), []);
  const handleStartNextNight = useCallback(() => dispatch({ type: 'START_NEXT_NIGHT' }), []);
  const handleQuit = useCallback(() => dispatch({ type: 'GO_TO_MENU' }), []);
  const handlePlayLevel = useCallback((level) => {
    setShowLevels(false);
    dispatch({ type: 'PLAY_LEVEL', payload: { level } });
  }, []);
  // A restart never touches totalMoney/upgradeLevels/night in the reducer — nothing has been
  // committed there yet for an in-progress night anyway (that only happens on NIGHT_ENDED), so
  // simply remounting GameCanvas with a fresh GameEngine is a complete, side-effect-free "try
  // this night again." The seed is unchanged, so it's the same night layout, not a reroll.
  const handleRestart = useCallback(() => setRestartToken((t) => t + 1), []);

  const overlay = showSettings ? 'settings' : showAchievements ? 'achievements' : showLevels ? 'levels' : null;
  const viewKey = overlay ?? state.screen;
  const hasProgress = state.totalMoney > 0 || state.night > 1 || state.stats.totalDeliveries > 0;

  return (
    <div className="app-root" data-contrast={settings.accessibility.highContrast ? 'high' : 'normal'} data-reduced-flashing={settings.accessibility.reducedFlashing}>
      <div className="screen-transition" key={viewKey}>
        {overlay === 'settings' && (
          <SettingsScreen
            settings={settings}
            onChange={handleSettingsChange}
            onBack={() => setShowSettings(false)}
            onResetSave={handleResetSave}
            variant="menu"
          />
        )}

        {overlay === 'achievements' && (
          <AchievementsScreen achievements={state.achievements} onBack={() => setShowAchievements(false)} />
        )}

        {overlay === 'levels' && (
          <LevelsScreen
            highestLevel={state.stats.highestLevel}
            levelStars={state.levelStars}
            onPlayLevel={handlePlayLevel}
            onBack={() => setShowLevels(false)}
          />
        )}

        {!overlay && state.screen === SCREENS.MENU && (
          <MainMenu
            onStart={handleStart}
            onNewGame={handleNewGame}
            onOpenSettings={() => setShowSettings(true)}
            onOpenAchievements={() => setShowAchievements(true)}
            onOpenLevels={() => setShowLevels(true)}
            hasProgress={hasProgress}
            totalMoney={state.totalMoney}
            night={state.night}
          />
        )}

        {!overlay && state.screen === SCREENS.NIGHT_INTRO && (
          <NightIntroScreen
            night={state.night}
            levelCap={difficulty.levelCap}
            totalMoney={state.totalMoney}
            nightDuration={nightDuration}
            challenge={challenge}
            onBegin={handleBeginNight}
          />
        )}

        {!overlay && state.screen === SCREENS.PLAYING && (
          <GameCanvas
            key={`${state.night}-${restartToken}`}
            stats={stats}
            nightDuration={nightDuration}
            night={state.night}
            difficulty={difficulty}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onNightEnd={handleNightEnd}
            onRestart={handleRestart}
            onQuitToMenu={handleQuit}
          />
        )}

        {!overlay && state.screen === SCREENS.NIGHT_COMPLETE && state.lastNightSummary && (
          <NightCompleteScreen
            summary={state.lastNightSummary}
            totalMoney={state.totalMoney}
            onContinue={handleContinueToUpgrade}
          />
        )}

        {!overlay && state.screen === SCREENS.UPGRADE && (
          <UpgradeScreen
            totalMoney={state.totalMoney}
            upgradeLevels={state.upgradeLevels}
            night={state.night}
            onBuy={handleBuyUpgrade}
            onStartNextNight={handleStartNextNight}
            onQuit={handleQuit}
          />
        )}
      </div>
    </div>
  );
}
