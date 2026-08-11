/** Minimal chrome for photo mode — everything else (HUD, prompts) is hidden so the shot is
 * clean. The world is frozen; WASD/arrows pan the camera instead of driving (see
 * GameEngine._updatePhotoCamera), and the scroll wheel zooms (wired in GameCanvas). */
export default function PhotoModeOverlay({ onCapture, onExit }) {
  return (
    <div className="photo-overlay">
      <div className="photo-hint">
        <kbd>WASD</kbd>
        <span>pan</span>
        <kbd>SHIFT</kbd>
        <span>fast pan</span>
        <span>scroll to zoom</span>
        <kbd>ESC</kbd>
        <span>exit</span>
      </div>
      <div className="photo-actions">
        <button className="btn btn-primary" onClick={onCapture}>
          📸 Capture
        </button>
        <button className="btn btn-ghost" onClick={onExit}>
          Exit Photo Mode
        </button>
      </div>
    </div>
  );
}
