import { ACHIEVEMENTS } from '../state/achievements.js';

export default function AchievementsScreen({ achievements, onBack }) {
  const unlockedCount = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;

  return (
    <div className="screen achievements-screen">
      <h2 className="achievements-title">Achievements</h2>
      <p className="achievements-subtitle">
        {unlockedCount} / {ACHIEVEMENTS.length} unlocked
      </p>

      <div className="achievements-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = !!achievements[a.id];
          return (
            <div key={a.id} className={`achievement-card ${unlocked ? 'achievement-card--unlocked' : ''}`}>
              <span className="achievement-icon">{unlocked ? a.icon : '🔒'}</span>
              <div className="achievement-info">
                <h3>{a.label}</h3>
                <p>{a.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
