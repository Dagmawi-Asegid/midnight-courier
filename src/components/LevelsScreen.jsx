import { LEVEL_CAP } from '../game/engine/difficulty.js';

function Stars({ count }) {
  return (
    <div className="level-card-stars">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`level-star ${i <= count ? 'level-star--filled' : ''}`}>
          ★
        </span>
      ))}
    </div>
  );
}

/** Progress map of every level up to the cap: completed levels show your best star rating
 * (replaying one only ever raises it), the very next level is highlighted as playable, and
 * anything beyond that is locked — makes "finish a level to unlock the next one" visible at a
 * glance instead of just implied by the Continue button. */
export default function LevelsScreen({ highestLevel, levelStars, onPlayLevel, onBack }) {
  const nextLevel = highestLevel + 1;

  return (
    <div className="screen levels-screen">
      <h2 className="levels-title">Levels</h2>
      <p className="levels-subtitle">
        {Math.min(highestLevel, LEVEL_CAP)} / {LEVEL_CAP} completed
      </p>

      <div className="levels-grid">
        {Array.from({ length: LEVEL_CAP }, (_, i) => i + 1).map((level) => {
          const completed = level <= highestLevel;
          const isNext = level === nextLevel;
          const locked = !completed && !isNext;
          const stars = levelStars[level] ?? 0;

          return (
            <button
              key={level}
              className={`level-card ${completed ? 'level-card--completed' : ''} ${isNext ? 'level-card--next' : ''} ${locked ? 'level-card--locked' : ''}`}
              disabled={locked}
              onClick={() => onPlayLevel(level)}
            >
              <span className="level-card-number">{locked ? '🔒' : level}</span>
              {completed && <Stars count={stars} />}
              {isNext && <span className="level-card-tag">PLAY</span>}
            </button>
          );
        })}
      </div>

      <button className="btn btn-ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
