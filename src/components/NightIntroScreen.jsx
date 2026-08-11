import { formatMoney, formatTime } from '../game/utils/math.js';

export default function NightIntroScreen({ night, levelCap, totalMoney, nightDuration, challenge, onBegin }) {
  return (
    <div className="screen night-intro-screen">
      <p className="night-intro-eyebrow">Shift Briefing</p>
      <h1 className="night-intro-title">
        Level {night}
        {levelCap && night >= levelCap && <span className="night-intro-cap"> · MAX</span>}
      </h1>
      <p className="night-intro-tagline">{challenge.tagline}</p>

      <div className="night-intro-stats">
        <div className="night-intro-stat">
          <span className="summary-label">Starting Money</span>
          <span className="summary-value">{formatMoney(totalMoney)}</span>
        </div>
        <div className="night-intro-stat">
          <span className="summary-label">Time Tonight</span>
          <span className="summary-value">{formatTime(nightDuration)}</span>
        </div>
      </div>

      {challenge.tags.length > 0 && (
        <div className="night-intro-tags">
          {challenge.tags.map((tag) => (
            <span key={tag.label} className="night-intro-tag">
              {tag.icon} {tag.label}
            </span>
          ))}
        </div>
      )}

      <button className="btn btn-primary" onClick={onBegin}>
        Begin Shift
      </button>
    </div>
  );
}
