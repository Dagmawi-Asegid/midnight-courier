import { formatMoney, formatTime } from '../game/utils/math.js';

function NavCompass({ nav, precision }) {
  if (!nav) return null;
  const deg = (nav.bearing * 180) / Math.PI;
  const rawMeters = Math.max(0, nav.distance / 8);
  // Base Destination Indicator shows a coarse distance; each upgrade level sharpens it.
  const meters = precision >= 1 ? Math.round(rawMeters) : Math.round(rawMeters / 25) * 25;
  const label = nav.kind === 'pickup' ? 'PICKUP' : 'DROP-OFF';
  const close = precision >= 2 && rawMeters < 50;

  return (
    <div className={`nav-compass ${close ? 'nav-compass--close' : ''}`}>
      <div className="nav-dial">
        <div className="nav-arrow" style={{ transform: `rotate(${deg}deg)` }} />
      </div>
      <div className="nav-info">
        <span className="nav-label">{label}</span>
        <span className="nav-distance">
          {meters}m{precision < 1 ? '+' : ''}
        </span>
      </div>
    </div>
  );
}

function ShortcutPing({ ping }) {
  if (!ping) return null;
  const deg = (ping.bearing * 180) / Math.PI;
  const meters = Math.max(0, Math.round(ping.distance / 8));
  return (
    <div className="shortcut-ping">
      <div className="shortcut-ping-arrow" style={{ transform: `rotate(${deg}deg)` }} />
      <span>Shortcut · {meters}m</span>
    </div>
  );
}

function OrderPanel({ order, phase, nav, mapInfoLevel }) {
  if (!order) return null;
  const { type } = order;
  const showTimer = phase === 'toDropoff';
  const timerFraction = showTimer ? Math.max(0, order.timeRemaining / order.timeLimit) : 1;
  const urgent = showTimer && timerFraction < 0.3;
  const showRoute = mapInfoLevel > 0 && nav;

  return (
    <div className="order-panel" style={{ '--order-color': type.color }}>
      <div className="order-header">
        <span className="order-icon">{type.icon}</span>
        <span className="order-label">{type.label}</span>
        <span className="order-pay">${order.potentialPay}</span>
      </div>
      {showRoute && (
        <p className="order-route">
          {mapInfoLevel >= 2 ? `${nav.pickupDistrict} → ${nav.dropoffDistrict}` : `to ${nav.dropoffDistrict}`}
        </p>
      )}
      {showTimer && (
        <div className="order-timer-track">
          <div
            className={`order-timer-fill ${urgent ? 'order-timer-fill--urgent' : ''}`}
            style={{ width: `${timerFraction * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DistrictBadge({ district }) {
  if (!district) return null;
  return (
    <div className="district-badge" key={district.id}>
      {district.label}
    </div>
  );
}

function ComboBadge({ combo }) {
  if (!combo || combo.count <= 0) return null;
  const bonus = Math.round((combo.multiplier - 1) * 100);
  return (
    <div className="combo-badge">
      🔥 COMBO ×{combo.count}
      <span className="combo-bonus">+{bonus}%</span>
    </div>
  );
}

function BoostMeter({ boost }) {
  if (!boost) return null;
  return (
    <div className={`boost-meter ${boost.isBoosting ? 'boost-meter--active' : ''}`}>
      <span className="boost-meter-label">BOOST</span>
      <div className="boost-meter-track">
        <div className="boost-meter-fill" style={{ width: `${boost.meter * 100}%` }} />
      </div>
    </div>
  );
}

export default function HUD({ hud, nightDuration, night }) {
  const urgent = hud.timeRemaining < 15;
  const promptText =
    hud.phase === 'toPickup' ? 'Ride to the pickup — SPACE to accept' : 'Get to the drop-off before time runs out!';

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-pill">
          <span className="hud-label">Night</span>
          <span className="hud-value">{night}</span>
        </div>
        <div className={`hud-pill hud-timer ${urgent ? 'hud-timer--urgent' : ''}`}>
          <span className="hud-label">Time</span>
          <span className="hud-value">{formatTime(hud.timeRemaining)}</span>
        </div>
        <div className="hud-pill">
          <span className="hud-label">Cash</span>
          <span className="hud-value">{formatMoney(hud.money)}</span>
        </div>
        <div className="hud-pill">
          <span className="hud-label">Delivered</span>
          <span className="hud-value">{hud.deliveriesCompleted}</span>
        </div>
        <ComboBadge combo={hud.combo} />
      </div>

      <OrderPanel order={hud.order} phase={hud.phase} nav={hud.nav} mapInfoLevel={hud.mapInfoLevel} />
      <DistrictBadge district={hud.district} />
      <NavCompass nav={hud.nav} precision={hud.navPrecision} />
      <BoostMeter boost={hud.boost} />
      <ShortcutPing ping={hud.shortcutPing} />

      <div className="hud-bottom">
        <div className={`hud-prompt ${hud.carrying ? 'hud-prompt--carrying' : ''}`}>{promptText}</div>
        <div className="hud-controls">WASD / Arrows to ride · SHIFT to boost · SPACE or E to accept</div>
      </div>

      <div className="hud-bar-track">
        <div
          className="hud-bar-fill"
          style={{ width: `${Math.max(0, (hud.timeRemaining / nightDuration) * 100)}%` }}
        />
      </div>
    </div>
  );
}
