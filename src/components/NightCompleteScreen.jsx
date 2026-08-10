import { formatMoney } from '../game/utils/math.js';

const RATING_LABELS = { 1: 'Rough Night', 2: 'Solid Shift', 3: 'Perfect Run' };

function StarRating({ rating }) {
  return (
    <div className="rating-stars" aria-label={`${rating} out of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`rating-star ${i <= rating ? 'rating-star--filled' : ''}`}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function NightCompleteScreen({ summary, totalMoney, onContinue }) {
  const distanceMeters = Math.round(summary.distanceTraveled / 8);

  return (
    <div className={`screen summary-screen ${summary.gameOver ? 'summary-screen--gameover' : ''}`}>
      {summary.gameOver ? (
        <>
          <p className="gameover-eyebrow">Shift Report</p>
          <h2 className="gameover-title">No Deliveries Tonight</h2>
          <p className="gameover-tagline">The city didn't see a single package make it home. Regroup and gear up.</p>
        </>
      ) : (
        <>
          <h2 className="summary-title">Night {summary.night} Complete</h2>
          <StarRating rating={summary.rating} />
          <p className="summary-rating-label">{RATING_LABELS[summary.rating]}</p>
        </>
      )}

      <div className="summary-grid">
        <div className="summary-stat">
          <span className="summary-label">Delivered</span>
          <span className="summary-value">{summary.deliveriesCompleted}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Failed</span>
          <span className="summary-value">{summary.deliveriesFailed}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Best Combo</span>
          <span className="summary-value">×{summary.bestCombo}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Distance</span>
          <span className="summary-value">{distanceMeters}m</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Earned</span>
          <span className="summary-value">{formatMoney(summary.money)}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Bonus</span>
          <span className="summary-value">{formatMoney(summary.bonus)}</span>
        </div>
        <div className="summary-stat summary-stat--highlight">
          <span className="summary-label">Total Savings</span>
          <span className="summary-value">{formatMoney(totalMoney)}</span>
        </div>
      </div>

      <button className="btn btn-primary" onClick={onContinue}>
        Choose Upgrades
      </button>
    </div>
  );
}
