import { useState } from 'react';
import { UPGRADE_CATEGORIES, UPGRADE_CATEGORY_META, UPGRADE_DEFS, upgradeCost } from '../game/engine/constants.js';
import { getDifficulty } from '../game/engine/difficulty.js';
import { formatMoney } from '../game/utils/math.js';
import { playDeniedSound, playPurchaseSound } from '../game/utils/sound.js';

function UpgradeCard({ def, level, totalMoney, costMultiplier, onBuy }) {
  const [feedback, setFeedback] = useState(null); // 'bought' | 'denied' | null

  const maxed = level >= def.maxLevel;
  const cost = maxed ? null : upgradeCost(def, level, costMultiplier);
  const affordable = !maxed && totalMoney >= cost;
  const nextBenefit = maxed ? null : def.benefit(level + 1);

  const handleClick = () => {
    if (affordable) {
      onBuy(def);
      playPurchaseSound();
      setFeedback('bought');
    } else {
      playDeniedSound();
      setFeedback('denied');
    }
    setTimeout(() => setFeedback(null), 420);
  };

  const cardClass = ['upgrade-card', feedback === 'bought' && 'upgrade-card--bought', feedback === 'denied' && 'upgrade-card--denied']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass}>
      <div className="upgrade-icon">{def.icon}</div>
      <div className="upgrade-info">
        <div className="upgrade-info-head">
          <h3>{def.label}</h3>
          <span className="upgrade-level-tag">
            Lv {level}/{def.maxLevel}
          </span>
        </div>
        <p className="upgrade-desc">{def.description}</p>
        <div className="upgrade-levels">
          {Array.from({ length: def.maxLevel }).map((_, i) => (
            <span key={i} className={`level-pip ${i < level ? 'level-pip--filled' : ''}`} />
          ))}
        </div>
        {nextBenefit && <p className="upgrade-next">Next: {nextBenefit}</p>}
      </div>
      <button className="btn btn-upgrade" onClick={handleClick}>
        {maxed ? 'MAX' : formatMoney(cost)}
      </button>
    </div>
  );
}

export default function UpgradeScreen({ totalMoney, upgradeLevels, night, onBuy, onStartNextNight, onQuit }) {
  const costMultiplier = getDifficulty(night).upgradeCostMultiplier;
  const pricesUp = costMultiplier > 1.02;

  return (
    <div className="screen upgrade-screen">
      <h2 className="upgrade-title">Garage</h2>
      <p className="upgrade-subtitle">Balance: {formatMoney(totalMoney)}</p>
      {pricesUp && (
        <p className="upgrade-price-note">
          Parts run {Math.round((costMultiplier - 1) * 100)}% pricier this deep into the run.
        </p>
      )}

      <div className="upgrade-scroll">
        {UPGRADE_CATEGORIES.map((category) => {
          const meta = UPGRADE_CATEGORY_META[category];
          const defs = UPGRADE_DEFS.filter((def) => def.category === category);
          return (
            <section key={category} className="upgrade-category">
              <div className="upgrade-category-header">
                <span className="upgrade-category-icon">{meta.icon}</span>
                <div>
                  <h3>{meta.label}</h3>
                  <p>{meta.blurb}</p>
                </div>
              </div>
              <div className="upgrade-grid">
                {defs.map((def) => (
                  <UpgradeCard
                    key={def.id}
                    def={def}
                    level={upgradeLevels[def.id] || 0}
                    totalMoney={totalMoney}
                    costMultiplier={costMultiplier}
                    onBuy={onBuy}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="upgrade-actions">
        <button className="btn btn-ghost" onClick={onQuit}>
          Quit to Menu
        </button>
        <button className="btn btn-primary" onClick={onStartNextNight}>
          Start Next Level
        </button>
      </div>
    </div>
  );
}
