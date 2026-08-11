import { formatMoney, formatTime } from '../game/utils/math.js';
import Minimap from './Minimap.jsx';

/** Distance-based color: cyan far away, warming to green as the player closes in — a baseline
 * proximity cue every player gets, layered underneath the upgrade-gated exact readout. */
function proximityColor(meters) {
  if (meters < 60) return '#7dff5c';
  if (meters < 160) return '#c8ff9d';
  return '#2fe8ff';
}

/** A proper directional arrowhead (a "dart" shape with a concave back) rather than a plain
 * triangle — the notch at the back is what makes it read unambiguously as "this way" at a
 * glance instead of just being a wedge. Points right at rotate(0deg), matching the bearing
 * convention used by both callers below (0° = +x). */
function DirectionArrow({ deg }) {
  return (
    <svg className="direction-arrow" viewBox="0 0 24 24" style={{ transform: `rotate(${deg}deg)` }}>
      <path d="M22 12 L4 3 L9 12 L4 21 Z" />
    </svg>
  );
}

function NavCompass({ nav, precision }) {
  if (!nav) return null;
  const deg = (nav.bearing * 180) / Math.PI;
  const rawMeters = Math.max(0, nav.distance / 8);
  // Base Destination Indicator shows a coarse distance; each upgrade level sharpens it.
  const meters = precision >= 1 ? Math.round(rawMeters) : Math.round(rawMeters / 25) * 25;
  const label = nav.kind === 'pickup' ? 'PICKUP' : 'DROP-OFF';
  const close = precision >= 2 && rawMeters < 50;
  const color = proximityColor(rawMeters);

  return (
    <div className={`nav-compass ${close ? 'nav-compass--close' : ''}`} style={{ '--nav-color': color }}>
      <div className="nav-dial">
        <DirectionArrow deg={deg} />
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
      <DirectionArrow deg={deg} />
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

/** Up to three candidate jobs offered together so the player can weigh pay vs. distance vs.
 * risk before committing — picking one is a click, but ignoring it entirely is also fine: the
 * thin progress bar shows how long until the game auto-picks the first one for you. Lives in
 * the same top-left slot the order panel occupies once a job is active (that spot is otherwise
 * empty during selection), as a compact vertical list rather than a center-screen dialog, so
 * the player can keep driving and see the road while choosing. */
function DeliverySelectionPanel({ candidates, selectionProgress, onSelect }) {
  if (!candidates || candidates.length === 0) return null;
  return (
    <div className="selection-panel">
      <p className="selection-title">Choose your next job</p>
      <div className="selection-list">
        {candidates.map((c, i) => (
          <button key={i} className="selection-row" style={{ '--order-color': c.type.color }} onClick={() => onSelect(i)}>
            <span className="selection-row-icon">{c.type.icon}</span>
            <span className="selection-row-info">
              <span className="selection-row-label">{c.type.label}</span>
              <span className="selection-row-meta">
                {c.distanceMeters}m · {c.pickupDistrict} → {c.dropoffDistrict}
              </span>
            </span>
            <span className="selection-row-pay">${c.potentialPay}</span>
          </button>
        ))}
      </div>
      <div className="selection-timeout-track">
        <div className="selection-timeout-fill" style={{ width: `${selectionProgress * 100}%` }} />
      </div>
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

function SpeedGauge({ speed }) {
  return (
    <div className="speed-gauge">
      <span className="speed-value">{speed}</span>
      <span className="speed-unit">SPD</span>
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

export default function HUD({ hud, nightDuration, night, city, onPause, onSelectDelivery }) {
  const urgent = hud.timeRemaining < 15;
  const promptText =
    hud.phase === 'selecting'
      ? 'Pick your next delivery'
      : hud.phase === 'toPickup'
        ? 'Ride to the pickup — SPACE to accept'
        : 'Get to the drop-off before time runs out!';

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-pill">
          <span className="hud-label">Level</span>
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

      <button className="btn-icon hud-pause-btn" onClick={onPause} aria-label="Pause" title="Pause (Esc)">
        ⏸
      </button>

      <OrderPanel order={hud.order} phase={hud.phase} nav={hud.nav} mapInfoLevel={hud.mapInfoLevel} />
      <DistrictBadge district={hud.district} />
      <NavCompass nav={hud.nav} precision={hud.navPrecision} />
      <DeliverySelectionPanel candidates={hud.candidates} selectionProgress={hud.selectionProgress} onSelect={onSelectDelivery} />

      <div className="hud-bottom-left">
        <BoostMeter boost={hud.boost} />
        <SpeedGauge speed={hud.speed} />
      </div>

      <div className="hud-bottom-right">
        <ShortcutPing ping={hud.shortcutPing} />
        <Minimap city={city} minimap={hud.minimap} />
      </div>

      <div className="hud-bottom">
        <div className={`hud-prompt ${hud.carrying ? 'hud-prompt--carrying' : ''}`}>{promptText}</div>
        <div className="hud-controls">WASD / Arrows to ride · SHIFT to boost · SPACE or E to accept · ESC to pause</div>
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
