import { formatMoney } from '../game/utils/math.js';

export default function NightCompleteScreen({ summary, totalMoney, onContinue }) {
  return (
    <div className="screen summary-screen">
      <h2 className="summary-title">Night {summary.night} Complete</h2>
      <div className="summary-grid">
        <div className="summary-stat">
          <span className="summary-label">Deliveries</span>
          <span className="summary-value">{summary.deliveriesCompleted}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Earned Tonight</span>
          <span className="summary-value">{formatMoney(summary.money)}</span>
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
