import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/GameEngine.js';
import { CITY_SEED } from '../game/engine/constants.js';
import HUD from './HUD.jsx';

let toastId = 0;

function toastForEvent(event) {
  switch (event.type) {
    case 'accepted':
      return { text: `${event.order.type.icon} ${event.order.type.label} order accepted!`, kind: 'info' };
    case 'delivered': {
      const comboText = event.comboCount > 1 ? ` · Combo ×${event.comboCount}` : '';
      return { text: `+$${event.reward} delivered!${comboText}`, kind: 'success' };
    }
    case 'missed':
      return { text: `Missed delivery — lost $${event.potential}`, kind: 'warning' };
    case 'penalty':
      return { text: `${event.reason} (-${event.seconds}s)`, kind: 'warning' };
    case 'boostRefill':
      return { text: 'Boost refilled!', kind: 'info' };
    default:
      return null;
  }
}

export default function GameCanvas({ stats, nightDuration, night, onNightEnd }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState({
    timeRemaining: nightDuration,
    money: 0,
    deliveriesCompleted: 0,
    phase: 'toPickup',
    carrying: false,
    order: null,
    nav: null,
    navPrecision: 0,
    mapInfoLevel: 0,
    shortcutPing: null,
    combo: { count: 0, multiplier: 1 },
    boost: { meter: 1, isBoosting: false },
  });
  const [toasts, setToasts] = useState([]);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current, {
      citySeed: CITY_SEED,
      nightSeed: night * 7919 + 13,
      stats,
      nightDuration,
      onHudUpdate: (data) => setHud(data),
      onNightEnd: (summary) => onNightEnd(summary),
      onEvent: (event) => {
        if (event.type === 'worldEvent') {
          if (event.phase === 'start') {
            setBanner({ icon: event.def.icon, label: event.def.label });
          } else {
            setBanner((prev) => (prev?.label === event.def.label ? null : prev));
          }
          return;
        }
        const toast = toastForEvent(event);
        if (!toast) return;
        const id = toastId++;
        setToasts((prev) => [...prev, { id, ...toast }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 1800);
      },
    });
    engineRef.current = engine;
    engine.start();

    return () => engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night]);

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <HUD hud={hud} nightDuration={nightDuration} night={night} />
      {banner && (
        <div className="event-banner">
          <span className="event-banner-icon">{banner.icon}</span>
          {banner.label}
        </div>
      )}
      <div className="toast-layer">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
