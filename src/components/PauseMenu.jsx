import { useState } from 'react';
import SettingsScreen from './SettingsScreen.jsx';

/** Pause overlay rendered on top of the still-visible (frozen) gameplay canvas. Settings opens
 * as an internal view swap rather than a separate route, so "Back" naturally returns to the
 * pause menu instead of unpausing outright. */
export default function PauseMenu({ settings, onSettingsChange, onResume, onRestart, onQuitToMenu, onPhotoMode }) {
  const [view, setView] = useState('menu');

  return (
    <div className="pause-overlay">
      <div className="pause-panel">
        {view === 'menu' ? (
          <>
            <p className="pause-eyebrow">Paused</p>
            <h2 className="pause-title">Shift on hold</h2>
            <div className="pause-actions">
              <button className="btn btn-primary" onClick={onResume}>
                Resume
              </button>
              <button className="btn btn-ghost" onClick={onPhotoMode}>
                📸 Photo Mode
              </button>
              <button className="btn btn-ghost" onClick={onRestart}>
                Restart Level
              </button>
              <button className="btn btn-ghost" onClick={() => setView('settings')}>
                Settings
              </button>
              <button className="btn btn-ghost" onClick={onQuitToMenu}>
                Return to Main Menu
              </button>
            </div>
            <p className="pause-note">Restarting or returning to the menu keeps your saved earnings and upgrades intact.</p>
          </>
        ) : (
          <SettingsScreen settings={settings} onChange={onSettingsChange} onBack={() => setView('menu')} variant="pause" />
        )}
      </div>
    </div>
  );
}
