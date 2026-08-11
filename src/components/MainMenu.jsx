import { useState } from 'react';
import { formatMoney } from '../game/utils/math.js';

export default function MainMenu({ onStart, onNewGame, onOpenSettings, onOpenAchievements, onOpenLevels, hasProgress, totalMoney, night }) {
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);

  return (
    <div className="screen menu-screen">
      <div className="menu-glow" />
      <div className="menu-scanlines" />
      <h1 className="menu-title">
        MIDNIGHT <span>COURIER</span>
      </h1>
      <p className="menu-subtitle">Deliver the city's secrets before sunrise.</p>

      {confirmingNewGame ? (
        <div className="menu-confirm">
          <p>Erase your saved progress and start over?</p>
          <div className="menu-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmingNewGame(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onNewGame}>
              Yes, start over
            </button>
          </div>
        </div>
      ) : (
        <div className="menu-actions">
          <button className="btn btn-primary menu-cta" onClick={hasProgress ? onStart : onNewGame}>
            {hasProgress ? 'Continue' : 'New Game'}
          </button>
          {hasProgress && (
            <button className="btn btn-ghost" onClick={() => setConfirmingNewGame(true)}>
              New Game
            </button>
          )}
          <button className="btn btn-ghost" onClick={onOpenLevels}>
            Levels
          </button>
          <button className="btn btn-ghost" onClick={onOpenAchievements}>
            Achievements
          </button>
          <button className="btn btn-ghost" onClick={onOpenSettings}>
            Settings
          </button>
        </div>
      )}

      {hasProgress && !confirmingNewGame && (
        <p className="menu-progress-hint">
          Resuming saved progress — {formatMoney(totalMoney)} banked, Level {night}
        </p>
      )}

      <div className="menu-instructions">
        <div className="instruction-row">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
          <span>or arrow keys to ride</span>
        </div>
        <div className="instruction-row">
          <kbd>SPACE</kbd>
          <span>or</span>
          <kbd>E</kbd>
          <span>to pick up / deliver</span>
        </div>
        <p className="instruction-note">
          Accept a delivery, race it across town, drop it off before the night ends, then spend your
          earnings on upgrades before the next shift.
        </p>
      </div>
    </div>
  );
}
