import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/GameEngine.js';
import { CITY_SEED } from '../game/engine/constants.js';
import HUD from './HUD.jsx';
import PauseMenu from './PauseMenu.jsx';

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
    case 'timeBonus':
      return { text: `⏱️ +${event.seconds}s time refill!`, kind: 'success' };
    case 'autoSelected':
      return { text: `${event.order.type.icon} Auto-picked: ${event.order.type.label}`, kind: 'info' };
    default:
      return null;
  }
}

export default function GameCanvas({ stats, nightDuration, night, difficulty, settings, onNightEnd, onSettingsChange, onRestart, onQuitToMenu }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [city, setCity] = useState(null);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({
    timeRemaining: nightDuration,
    money: 0,
    deliveriesCompleted: 0,
    speed: 0,
    phase: 'toPickup',
    carrying: false,
    order: null,
    candidates: null,
    selectionProgress: 0,
    nav: null,
    navPrecision: 0,
    mapInfoLevel: 0,
    shortcutPing: null,
    combo: { count: 0, multiplier: 1 },
    boost: { meter: 1, isBoosting: false },
    minimap: null,
  });
  const [toasts, setToasts] = useState([]);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current, {
      citySeed: CITY_SEED,
      nightSeed: night * 7919 + 13,
      stats,
      nightDuration,
      difficulty,
      settings,
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
    setCity(engine.city);
    engine.start();

    return () => engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night]);

  // A separate top-level listener (not InputManager, which only tracks gameplay keys) so Escape
  // works regardless of which movement keys happen to be held at the moment.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Escape') return;
      setPaused((prev) => {
        const next = !prev;
        if (next) engineRef.current?.pause();
        else engineRef.current?.resume();
        return next;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handlePauseClick = () => {
    setPaused(true);
    engineRef.current?.pause();
  };
  const handleResume = () => {
    setPaused(false);
    engineRef.current?.resume();
  };
  const handleSelectDelivery = (index) => engineRef.current?.selectDelivery(index);

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <HUD hud={hud} nightDuration={nightDuration} night={night} city={city} onPause={handlePauseClick} onSelectDelivery={handleSelectDelivery} />
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
      {paused && (
        <PauseMenu
          settings={settings}
          onSettingsChange={onSettingsChange}
          onResume={handleResume}
          onRestart={onRestart}
          onQuitToMenu={onQuitToMenu}
        />
      )}
    </div>
  );
}
