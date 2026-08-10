import { formatMoney } from '../game/utils/math.js';

export default function MainMenu({ onStart, totalMoney, night }) {
  const hasProgress = totalMoney > 0 || night > 1;

  return (
    <div className="screen menu-screen">
      <div className="menu-glow" />
      <h1 className="menu-title">
        MIDNIGHT <span>COURIER</span>
      </h1>
      <p className="menu-subtitle">Deliver the city's secrets before sunrise.</p>

      <button className="btn btn-primary" onClick={onStart}>
        Start Shift
      </button>

      {hasProgress && (
        <p className="menu-progress-hint">
          Resuming saved progress — {formatMoney(totalMoney)} banked, Night {night}
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
